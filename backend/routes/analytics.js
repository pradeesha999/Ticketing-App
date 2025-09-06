const express = require('express');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Department = require('../models/Department');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// Get dashboard analytics (Super Admin)
router.get('/dashboard', auth('superadmin'), async (req, res) => {
  try {
    const [
      totalTickets,
      totalUsers,
      totalDepartments,
      ticketsByStatus,
      ticketsByPriority,
      ticketsByDepartment,
      recentTickets,
      userDistribution
    ] = await Promise.all([
      Ticket.countDocuments(),
      User.countDocuments({ isActive: true }),
      Department.countDocuments(),
      Ticket.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Ticket.aggregate([
        { $group: { _id: '$priority', count: { $sum: 1 } } }
      ]),
      Ticket.aggregate([
        { $lookup: { from: 'departments', localField: 'department', foreignField: '_id', as: 'dept' } },
        { $unwind: '$dept' },
        { $group: { _id: '$dept.name', count: { $sum: 1 } } }
      ]),
      Ticket.find()
        .populate('submittedBy', 'name')
        .populate('department', 'name')
        .sort({ createdAt: -1 })
        .limit(10),
      User.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: '$role', count: { $sum: 1 } } }
      ])
    ]);

    res.json({
      totalTickets,
      totalUsers,
      totalDepartments,
      ticketsByStatus,
      ticketsByPriority,
      ticketsByDepartment,
      recentTickets,
      userDistribution
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get department analytics
router.get('/departments', auth('superadmin'), async (req, res) => {
  try {
    const departmentStats = await Ticket.aggregate([
      { $lookup: { from: 'departments', localField: 'department', foreignField: '_id', as: 'dept' } },
      { $unwind: '$dept' },
      {
        $group: {
          _id: '$dept.name',
          totalTickets: { $sum: 1 },
          resolvedTickets: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
          avgResolutionTime: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'Resolved'] },
                { $subtract: ['$updatedAt', '$createdAt'] },
                null
              ]
            }
          }
        }
      }
    ]);

    res.json(departmentStats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export tickets data (CSV)
router.get('/export/tickets', auth('superadmin'), async (req, res) => {
  try {
    const { format = 'csv' } = req.query;
    
    const tickets = await Ticket.find()
      .populate('submittedBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('department', 'name')
      .sort({ createdAt: -1 });

    if (format === 'csv') {
      const csvData = tickets.map(ticket => ({
        ID: ticket._id,
        Title: ticket.title,
        Description: ticket.description,
        Status: ticket.status,
        Priority: ticket.priority,
        Category: ticket.category,
        SubmittedBy: ticket.submittedBy?.name || '',
        AssignedTo: ticket.assignedTo?.name || '',
        Department: ticket.department?.name || '',
        CreatedAt: ticket.createdAt,
        UpdatedAt: ticket.updatedAt
      }));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=tickets.csv');
      
      // Convert to CSV
      const csv = [
        Object.keys(csvData[0]).join(','),
        ...csvData.map(row => Object.values(row).map(value => `"${value}"`).join(','))
      ].join('\n');
      
      res.send(csv);
    } else {
      res.json(tickets);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get student dashboard analytics
router.get('/student-dashboard', auth('student'), async (req, res) => {
  try {
          const [
        myTickets,
        ticketsByStatus,
        recentTickets
      ] = await Promise.all([
        Ticket.countDocuments({ submittedBy: req.user.id }),
              Ticket.aggregate([
          { $match: { submittedBy: req.user.id } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Ticket.find({ submittedBy: req.user.id })
        .populate('assignedTo', 'name')
        .populate('department', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    res.json({
      totalTickets: myTickets,
      ticketsByStatus,
      recentTickets
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get party dashboard analytics
router.get('/party-dashboard', auth('party'), async (req, res) => {
  try {
          const [
        assignedTickets,
        ticketsByStatus,
        recentTickets
      ] = await Promise.all([
        Ticket.countDocuments({ assignedTo: req.user.id }),
              Ticket.aggregate([
          { $match: { assignedTo: req.user.id } },
          { $group: { _id: '$status', count: { $sum: 1 } } }
        ]),
        Ticket.find({ assignedTo: req.user.id })
        .populate('submittedBy', 'name')
        .populate('department', 'name')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    res.json({
      totalTickets: assignedTickets,
      ticketsByStatus,
      recentTickets
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
