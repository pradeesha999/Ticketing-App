const mongoose = require('mongoose');

const IssueCategorySchema = new mongoose.Schema({
  name: { type: String, unique: true },
  slug: { type: String, unique: true },
  description: { type: String },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  isActive: { type: Boolean, default: true },
  ordering: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

IssueCategorySchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('IssueCategory', IssueCategorySchema);


