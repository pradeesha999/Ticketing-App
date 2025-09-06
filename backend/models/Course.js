const mongoose = require('mongoose');

const CourseSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  code: { type: String, required: true, unique: true },
  description: { type: String },
  courseDirector: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
CourseSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Pre-delete hook to check for dependencies
CourseSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    const Batch = mongoose.model('Batch');
    const batchCount = await Batch.countDocuments({ course: this._id });
    
    if (batchCount > 0) {
      throw new Error(`Cannot delete course. It has ${batchCount} batch(es) assigned to it. Please delete all batches first.`);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-delete hook for findOneAndDelete operations
CourseSchema.pre('findOneAndDelete', async function(next) {
  try {
    const courseId = this.getQuery()._id;
    const Batch = mongoose.model('Batch');
    const batchCount = await Batch.countDocuments({ course: courseId });
    
    if (batchCount > 0) {
      throw new Error(`Cannot delete course. It has ${batchCount} batch(es) assigned to it. Please delete all batches first.`);
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Post-delete hook to clean up any remaining references
CourseSchema.post('findOneAndDelete', async function(doc) {
  try {
    if (doc) {
      const courseId = doc._id;
      
      // Clean up any remaining resit forms that might reference this course
      const ResitForm = mongoose.model('ResitForm');
      await ResitForm.deleteMany({ course: courseId });
      
      console.log(`Cleaned up resit forms for deleted course: ${courseId}`);
    }
  } catch (error) {
    console.error('Error in post-delete cleanup:', error);
  }
});

module.exports = mongoose.model('Course', CourseSchema);
