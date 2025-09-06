const mongoose = require('mongoose');
require('dotenv').config();

const ResitForm = require('./models/ResitForm');
const MedicalSubmission = require('./models/MedicalSubmission');

async function migrateMedicalRefs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find all resit forms that have medicalSubmission but no medicalSubmissionRef
    const resitForms = await ResitForm.find({
      isMedical: true,
      $or: [
        { medicalSubmission: { $exists: true, $ne: null } },
        { medicalSubmissionId: { $exists: true, $ne: null } }
      ],
      $or: [
        { medicalSubmissionRef: { $exists: false } },
        { medicalSubmissionRef: null }
      ]
    });

    console.log(`Found ${resitForms.length} resit forms to migrate`);

    for (const form of resitForms) {
      try {
        let medicalSubmissionId = form.medicalSubmission || form.medicalSubmissionId;
        
        if (!medicalSubmissionId) {
          console.log(`No medical submission ID found for form ${form._id}`);
          continue;
        }

        // Get the medical submission to get its reference ID
        const medicalSubmission = await MedicalSubmission.findById(medicalSubmissionId);
        if (medicalSubmission && medicalSubmission.referenceId) {
          // Update the resit form with the reference ID and ensure medicalSubmission field is set
          const updateData = {
            medicalSubmissionRef: medicalSubmission.referenceId
          };
          
          // If we have the old medicalSubmissionId field, also set the new medicalSubmission field
          if (form.medicalSubmissionId && !form.medicalSubmission) {
            updateData.medicalSubmission = form.medicalSubmissionId;
          }
          
          await ResitForm.findByIdAndUpdate(form._id, updateData);
          console.log(`Updated form ${form._id} with medical ref: ${medicalSubmission.referenceId}`);
        } else {
          console.log(`Medical submission not found for form ${form._id}`);
        }
      } catch (error) {
        console.error(`Error updating form ${form._id}:`, error);
      }
    }

    console.log('Migration completed');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the migration
migrateMedicalRefs();
