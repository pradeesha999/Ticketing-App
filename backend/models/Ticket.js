const mongoose = require('mongoose');

const TicketSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  status: { 
    type: String, 
    enum: ['Issued', 'Seen', 'In Progress', 'Resolved', 'Denounced'], 
    default: 'Issued' 
  },
  priority: { 
    type: String, 
    enum: ['Low', 'Medium', 'High', 'Critical'], 
    default: 'Medium' 
  },
  ticketNumber: { type: String, unique: true },
  category: { type: mongoose.Schema.Types.ObjectId, ref: 'IssueCategory' },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  resolution: { type: String },
  resolvedAt: { type: Date },
  messages: [{
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now }
  }],
  // Approval workflow
  approvalStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
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
