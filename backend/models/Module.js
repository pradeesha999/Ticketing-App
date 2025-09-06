const mongoose = require('mongoose');

const ModuleSchema = new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  credits: { type: Number, required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
ModuleSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Compound index to ensure unique module per batch
ModuleSchema.index({ batch: 1, code: 1 }, { unique: true });

// Pre-delete hook to check for dependencies
ModuleSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    const ResitForm = mongoose.model('ResitForm');
    const resitFormCount = await ResitForm.countDocuments({ module: this._id });
    
    if (resitFormCount > 0) {
      throw new Error(`Cannot delete module. It has ${resitFormCount} resit form(s) assigned to it. Please delete all resit forms first.`);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-delete hook for findOneAndDelete operations
ModuleSchema.pre('findOneAndDelete', async function(next) {
  try {
    const moduleId = this.getQuery()._id;
    const ResitForm = mongoose.model('ResitForm');
    const resitFormCount = await ResitForm.countDocuments({ module: moduleId });
    
    if (resitFormCount > 0) {
      throw new Error(`Cannot delete module. It has ${resitFormCount} resit form(s) assigned to it. Please delete all resit forms first.`);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Post-delete hook to clean up any remaining references
ModuleSchema.post('findOneAndDelete', async function(doc) {
  try {
    if (doc) {
      const moduleId = doc._id;
      
      // Clean up any remaining resit forms that might reference this module
      const ResitForm = mongoose.model('ResitForm');
      await ResitForm.deleteMany({ module: moduleId });
      
      console.log(`Cleaned up resit forms for deleted module: ${moduleId}`);
    }
  } catch (error) {
    console.error('Error in post-delete cleanup:', error);
  }
});

module.exports = mongoose.model('Module', ModuleSchema);
