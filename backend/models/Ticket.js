const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  title: { type: String },
  description: { type: String },
  status: { 
    type: String, 
    default: 'Issued' 
  },
  priority: { 
    type: String, 
    default: 'Medium' 
  },
  ticketNumber: { type: String, unique: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'IssueCategory' },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  resolution: { type: String },
  resolvedAt: { type: Date },
  messages: [{
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    message: { type: String },
    timestamp: { type: Date, default: Date.now }
  }],
  // Approval workflow
  approvalStatus: { type: String, default: 'none' },
  approvalAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalRequestedAt: { type: Date },
  approvalReviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvalReviewedAt: { type: Date },
  approvalNotes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
TicketSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('Ticket', TicketSchema);
