const mongoose = require('mongoose');
require('dotenv').config();

const ResitForm = require('./models/ResitForm');
const MedicalSubmission = require('./models/MedicalSubmission');

async function fixMedicalForms() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Find medical forms without medical submissions
    const brokenMedicalForms = await ResitForm.find({
      isMedical: true,
      $or: [
        { medicalSubmission: { $exists: false } },
        { medicalSubmission: null },
        { medicalSubmission: undefined }
      ]
    });

    console.log(`Found ${brokenMedicalForms.length} medical forms without submissions`);

    // Get available medical submissions
    const medicalSubmissions = await MedicalSubmission.find({ status: 'approved' });
    console.log(`Found ${medicalSubmissions.length} approved medical submissions`);

    if (brokenMedicalForms.length > 0 && medicalSubmissions.length > 0) {
      // Assign medical submissions to the broken forms
      for (let i = 0; i < brokenMedicalForms.length; i++) {
        const form = brokenMedicalForms[i];
        const medicalSubmission = medicalSubmissions[i % medicalSubmissions.length]; // Cycle through available submissions
        
        await ResitForm.findByIdAndUpdate(form._id, {
          medicalSubmission: medicalSubmission._id,
          medicalSubmissionRef: medicalSubmission.referenceId
        });
        
        console.log(`Fixed form ${form._id} with medical submission ${medicalSubmission.referenceId}`);
      }
    } else if (brokenMedicalForms.length > 0) {
      // If no medical submissions available, set isMedical to false
      for (const form of brokenMedicalForms) {
        await ResitForm.findByIdAndUpdate(form._id, {
          isMedical: false
        });
        console.log(`Set form ${form._id} to non-medical (no medical submissions available)`);
      }
    }

    console.log('Fix completed');

  } catch (error) {
    console.error('Fix failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

// Run the fix
fixMedicalForms();

