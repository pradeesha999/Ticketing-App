const express = require('express');
const mongoose = require('mongoose');
const os = require('os');
const { performance } = require('perf_hooks');

const router = express.Router();

// Health check endpoint
router.get('/', async (req, res) => {
  const startTime = performance.now();
  
  try {
    // Check database connection
    const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
    
    // Check memory usage
    const memUsage = process.memoryUsage();
    const memUsageMB = {
      rss: Math.round(memUsage.rss / 1024 / 1024),
      heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
      external: Math.round(memUsage.external / 1024 / 1024)
    };
    
    // Check system info
    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      nodeVersion: process.version,
      uptime: Math.round(process.uptime()),
      cpuUsage: process.cpuUsage(),
      loadAverage: os.loadavg()
    };
    
    // Check environment
    const environment = {
      nodeEnv: process.env.NODE_ENV || 'development',
      port: process.env.PORT || 5000,
      timestamp: new Date().toISOString()
    };
    
    const responseTime = performance.now() - startTime;
    
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      responseTime: `${responseTime.toFixed(2)}ms`,
      database: {
        status: dbStatus,
        connection: mongoose.connection.readyState === 1
      },
      memory: memUsageMB,
      system: systemInfo,
      environment
    };
    
    // Set appropriate status code
    const statusCode = dbStatus === 'connected' ? 200 : 503;
    
    res.status(statusCode).json(healthStatus);
    
  } catch (error) {
    const responseTime = performance.now() - startTime;
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
      responseTime: `${responseTime.toFixed(2)}ms`
    });
  }
});

// Detailed health check
router.get('/detailed', async (req, res) => {
  try {
    // Check database collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map(col => col.name);
    
    // Check database stats
    const dbStats = await mongoose.connection.db.stats();
    
    // Check active connections
    const activeConnections = mongoose.connection.db.serverConfig.connections().length;
    
    const detailedStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        collections: collectionNames,
        stats: {
          collections: dbStats.collections,
          dataSize: dbStats.dataSize,
          storageSize: dbStats.storageSize,
          indexes: dbStats.indexes,
          indexSize: dbStats.indexSize
        },
        connections: {
          active: activeConnections,
          max: mongoose.connection.db.serverConfig.options.maxPoolSize || 100
        }
      },
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      system: {
        platform: os.platform(),
        arch: os.arch(),
        cpus: os.cpus().length,
        totalMemory: os.totalmem(),
        freeMemory: os.freemem(),
        loadAverage: os.loadavg()
      }
    };
    
    res.json(detailedStatus);
    
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Readiness probe (for Kubernetes)
router.get('/ready', async (req, res) => {
  try {
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        status: 'not ready',
        reason: 'Database not connected',
        timestamp: new Date().toISOString()
      });
    }
    
    // Check if we can perform a simple database operation
    await mongoose.connection.db.admin().ping();
    
    res.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      reason: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Liveness probe (for Kubernetes)
router.get('/live', (req, res) => {
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Metrics endpoint (for Prometheus-style monitoring)
router.get('/metrics', (req, res) => {
  const memUsage = process.memoryUsage();
  
  const metrics = `# HELP nodejs_heap_size_total Process heap size from Node.js in bytes.
# TYPE nodejs_heap_size_total gauge
nodejs_heap_size_total ${memUsage.heapTotal}

# HELP nodejs_heap_size_used Process heap size used from Node.js in bytes.
# TYPE nodejs_heap_size_used gauge
nodejs_heap_size_used ${memUsage.heapUsed}

# HELP nodejs_external_memory_bytes Node.js external memory size in bytes.
# TYPE nodejs_external_memory_bytes gauge
nodejs_external_memory_bytes ${memUsage.external}

# HELP nodejs_heap_size_total_bytes Process heap size from Node.js in bytes.
# TYPE nodejs_heap_size_total_bytes gauge
nodejs_heap_size_total_bytes ${memUsage.heapTotal}

# HELP nodejs_heap_size_used_bytes Process heap size used from Node.js in bytes.
# TYPE nodejs_heap_size_used_bytes gauge
nodejs_heap_size_used_bytes ${memUsage.heapUsed}

# HELP nodejs_external_memory_bytes Node.js external memory size in bytes.
# TYPE nodejs_external_memory_bytes gauge
nodejs_external_memory_bytes ${memUsage.external}

# HELP nodejs_process_cpu_seconds_total Total user and CPU time spent in seconds.
# TYPE nodejs_process_cpu_seconds_total counter
nodejs_process_cpu_seconds_total ${(process.cpuUsage().user + process.cpuUsage().system) / 1000000}

# HELP nodejs_process_start_time_seconds Start time of the process since unix epoch in seconds.
# TYPE nodejs_process_start_time_seconds gauge
nodejs_process_start_time_seconds ${process.uptime()}

# HELP nodejs_process_resident_memory_bytes Resident memory size in bytes.
# TYPE nodejs_process_resident_memory_bytes gauge
nodejs_process_resident_memory_bytes ${memUsage.rss}`;

  res.set('Content-Type', 'text/plain');
  res.send(metrics);
});

module.exports = router;
