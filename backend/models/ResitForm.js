const mongoose = require('mongoose');

const ResitFormSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true },
  module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module', required: true },
  examType: { type: String, enum: ['Coursework', 'Exam'], required: true },
  pastExamDates: [{ type: Date, required: true }], // Array of past exam dates (max 3)
  phoneNumber: { type: String, required: true },
  isMedical: { type: Boolean, default: false },
  medicalSubmission: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalSubmission' }, // Only required if isMedical is true
  medicalSubmissionRef: { type: String }, // Human-readable reference ID (e.g., "MED792046588")
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  courseDirector: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  reviewNotes: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
ResitFormSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Validation for past exam dates (max 3)
ResitFormSchema.pre('save', function(next) {
  if (this.pastExamDates && this.pastExamDates.length > 3) {
    return next(new Error('Maximum 3 past exam dates allowed'));
  }
  next();
});

// Validation for medical submission
ResitFormSchema.pre('save', function(next) {
  if (this.isMedical && !this.medicalSubmission) {
    return next(new Error('Medical submission is required when marking as medical'));
  }
  next();
});

// Set medical submission reference ID when medical submission is set
ResitFormSchema.pre('save', async function(next) {
  if (this.isMedical && this.medicalSubmission && !this.medicalSubmissionRef) {
    try {
      const MedicalSubmission = require('./MedicalSubmission');
      const medicalDoc = await MedicalSubmission.findById(this.medicalSubmission);
      if (medicalDoc) {
        this.medicalSubmissionRef = medicalDoc.referenceId;
      }
    } catch (error) {
      console.error('Error setting medical submission reference:', error);
    }
  }
  next();
});

module.exports = mongoose.model('ResitForm', ResitFormSchema);
