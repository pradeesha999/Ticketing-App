const mongoose = require('mongoose');

const ResitFormSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  batch: { type: mongoose.Schema.Types.ObjectId, ref: 'Batch' },
  module: { type: mongoose.Schema.Types.ObjectId, ref: 'Module' },
  examType: { type: String },
  pastExamDates: [{ type: Date }], // Array of past exam dates (max 3)
  phoneNumber: { type: String },
  isMedical: { type: Boolean, default: false },
  medicalSubmission: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalSubmission' }, // Only required if isMedical is true
  medicalSubmissionRef: { type: String }, // Human-readable reference ID (e.g., "MED792046588")
  status: { 
    type: String, 
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

// Validation hooks removed

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
