const mongoose = require('mongoose');

const LogSchema = new mongoose.Schema({
  timestamp: { 
    type: Date, 
    default: Date.now,
    index: true 
  },
  level: { 
    type: String, 
    enum: ['info', 'warn', 'error', 'debug'], 
    default: 'info',
    index: true 
  },
  category: { 
    type: String, 
    enum: ['auth', 'ticket', 'medical', 'resit', 'system', 'security', 'performance'], 
    required: true,
    index: true 
  },
  action: { 
    type: String, 
    required: true 
  },
  description: { 
    type: String, 
    required: true 
  },
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    index: true 
  },
  userRole: { 
    type: String, 
    enum: ['student', 'party', 'admin', 'superadmin'] 
  },
  userEmail: { 
    type: String 
  },
  ipAddress: { 
    type: String 
  },
  userAgent: { 
    type: String 
  },
  requestMethod: { 
    type: String 
  },
  requestUrl: { 
    type: String 
  },
  requestBody: { 
    type: mongoose.Schema.Types.Mixed 
  },
  responseStatus: { 
    type: Number 
  },
  responseTime: { 
    type: Number // in milliseconds
  },
  errorMessage: { 
    type: String 
  },
  errorStack: { 
    type: String 
  },
  metadata: { 
    type: mongoose.Schema.Types.Mixed 
  }
}, {
  timestamps: true
});

// Index for efficient querying
LogSchema.index({ timestamp: -1, category: 1, level: 1 });
LogSchema.index({ userId: 1, timestamp: -1 });
LogSchema.index({ category: 1, action: 1 });

module.exports = mongoose.model('Log', LogSchema);

