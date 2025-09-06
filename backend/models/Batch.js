const mongoose = require('mongoose');

const BatchSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  startYear: { type: Number, required: true },
  endYear: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
BatchSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Compound index to ensure unique batch per course
BatchSchema.index({ course: 1, code: 1 }, { unique: true });

// Pre-delete hook to check for dependencies
BatchSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    const Module = mongoose.model('Module');
    const moduleCount = await Module.countDocuments({ batch: this._id });
    
    if (moduleCount > 0) {
      throw new Error(`Cannot delete batch. It has ${moduleCount} module(s) assigned to it. Please delete all modules first.`);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-delete hook for findOneAndDelete operations
BatchSchema.pre('findOneAndDelete', async function(next) {
  try {
    const batchId = this.getQuery()._id;
    const Module = mongoose.model('Module');
    const moduleCount = await Module.countDocuments({ batch: batchId });
    
    if (moduleCount > 0) {
      throw new Error(`Cannot delete batch. It has ${moduleCount} module(s) assigned to it. Please delete all modules first.`);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Post-delete hook to clean up any remaining references
BatchSchema.post('findOneAndDelete', async function(doc) {
  try {
    if (doc) {
      const batchId = doc._id;
      
      // Clean up any remaining resit forms that might reference this batch
      const ResitForm = mongoose.model('ResitForm');
      await ResitForm.deleteMany({ batch: batchId });
      
      console.log(`Cleaned up resit forms for deleted batch: ${batchId}`);
    }
  } catch (error) {
    console.error('Error in post-delete cleanup:', error);
  }
});

module.exports = mongoose.model('Batch', BatchSchema);
