const express = require('express');
const router = express.Router();
const Log = require('../models/Log');
const auth = require('../middleware/authMiddleware');
const Logger = require('../services/logger');

// Get all logs (Super Admin only)
router.get('/', auth('superadmin'), async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      level,
      category,
      action,
      userId,
      startDate,
      endDate,
      search
    } = req.query;

    const query = {};

    // Filter by level
    if (level) {
      query.level = level;
    }

    // Filter by category
    if (category) {
      query.category = category;
    }

    // Filter by action
    if (action) {
      query.action = { $regex: action, $options: 'i' };
    }

    // Filter by user
    if (userId) {
      query.userId = userId;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) {
        query.timestamp.$gte = new Date(startDate);
      }
      if (endDate) {
        query.timestamp.$lte = new Date(endDate);
      }
    }

    // Search in description
    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { action: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (page - 1) * limit;

    const logs = await Log.find(query)
      .populate('userId', 'name email role')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Log.countDocuments(query);

    // Log the log viewing action
    Logger.logSystem({
      action: 'logs_viewed',
      description: `Super admin viewed logs with filters: ${JSON.stringify(req.query)}`,
      ...Logger.extractUserInfo(req),
      metadata: {
        filters: req.query,
        resultsCount: logs.length,
        totalCount: total
      }
    });

    res.json({
      logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalLogs: total,
        hasNextPage: skip + logs.length < total,
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    Logger.logError({
      action: 'logs_fetch_error',
      description: 'Error fetching logs',
      ...Logger.extractUserInfo(req),
      errorMessage: err.message,
      errorStack: err.stack
    });
    res.status(500).json({ error: err.message });
  }
});

// Get log statistics (Super Admin only)
router.get('/stats', auth('superadmin'), async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};
    
    if (startDate || endDate) {
      if (startDate) dateFilter.$gte = new Date(startDate);
      if (endDate) dateFilter.$lte = new Date(endDate);
    }

    const stats = await Log.aggregate([
      { $match: Object.keys(dateFilter).length > 0 ? { timestamp: dateFilter } : {} },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          errorCount: {
            $sum: { $cond: [{ $eq: ['$level', 'error'] }, 1, 0] }
          },
          warningCount: {
            $sum: { $cond: [{ $eq: ['$level', 'warn'] }, 1, 0] }
          },
          infoCount: {
            $sum: { $cond: [{ $eq: ['$level', 'info'] }, 1, 0] }
          },
          avgResponseTime: { $avg: '$responseTime' }
        }
      }
    ]);

    const categoryStats = await Log.aggregate([
      { $match: Object.keys(dateFilter).length > 0 ? { timestamp: dateFilter } : {} },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    const topActions = await Log.aggregate([
      { $match: Object.keys(dateFilter).length > 0 ? { timestamp: dateFilter } : {} },
      {
        $group: {
          _id: '$action',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const topUsers = await Log.aggregate([
      { $match: Object.keys(dateFilter).length > 0 ? { timestamp: dateFilter } : {} },
      {
        $group: {
          _id: '$userEmail',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Log the stats viewing action
    Logger.logSystem({
      action: 'logs_stats_viewed',
      description: 'Super admin viewed log statistics',
      ...Logger.extractUserInfo(req),
      metadata: {
        dateFilter: req.query
      }
    });

    res.json({
      summary: stats[0] || {
        totalLogs: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        avgResponseTime: 0
      },
      categoryStats,
      topActions,
      topUsers
    });
  } catch (err) {
    Logger.logError({
      action: 'logs_stats_error',
      description: 'Error fetching log statistics',
      ...Logger.extractUserInfo(req),
      errorMessage: err.message,
      errorStack: err.stack
    });
    res.status(500).json({ error: err.message });
  }
});

// Clear old logs (Super Admin only)
router.delete('/clear', auth('superadmin'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - parseInt(days));

    const result = await Log.deleteMany({
      timestamp: { $lt: cutoffDate }
    });

    // Log the log clearing action
    Logger.logSystem({
      action: 'logs_cleared',
      description: `Cleared logs older than ${days} days`,
      ...Logger.extractUserInfo(req),
      metadata: {
        cutoffDate,
        deletedCount: result.deletedCount
      }
    });

    res.json({
      message: `Successfully cleared ${result.deletedCount} logs older than ${days} days`,
      deletedCount: result.deletedCount
    });
  } catch (err) {
    Logger.logError({
      action: 'logs_clear_error',
      description: 'Error clearing old logs',
      ...Logger.extractUserInfo(req),
      errorMessage: err.message,
      errorStack: err.stack
    });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;

