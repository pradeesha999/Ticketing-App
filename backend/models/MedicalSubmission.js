const mongoose = require('mongoose');

const MedicalSubmissionSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  medicalCondition: { type: String, required: true }, // e.g., "Dengue", "Fever", "Accident"
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  documents: [{ 
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    path: { type: String, required: true },
    uploadedAt: { type: Date, default: Date.now }
  }],
  referenceId: { type: String, required: true, unique: true, index: true }, // Auto-generated
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected'], 
    default: 'pending' 
  },
  reviewNotes: { type: String }, // Message from exam department
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Update the updatedAt field before saving
MedicalSubmissionSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Indexes for better query performance
MedicalSubmissionSchema.index({ student: 1, createdAt: -1 });
MedicalSubmissionSchema.index({ status: 1, createdAt: -1 });
MedicalSubmissionSchema.index({ reviewedBy: 1, reviewedAt: -1 });

// Generate reference ID before saving
MedicalSubmissionSchema.pre('save', function(next) {
  if (this.isNew && !this.referenceId) {
    let referenceId;
    let isUnique = false;
    
    // Keep generating until we get a unique ID
    while (!isUnique) {
      const timestamp = Date.now().toString().slice(-6);
      const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
      referenceId = `MED${timestamp}${random}`;
      
      // Check if this ID already exists (synchronous check for now)
      try {
        const existingSubmission = this.constructor.findOne({ referenceId }).exec();
        if (!existingSubmission) {
          isUnique = true;
        }
      } catch (error) {
        // If there's an error, just use the generated ID
        isUnique = true;
      }
    }
    
    this.referenceId = referenceId;
  }
  next();
});

module.exports = mongoose.model('MedicalSubmission', MedicalSubmissionSchema);
