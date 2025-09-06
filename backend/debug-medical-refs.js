const mongoose = require('mongoose');
require('dotenv').config();

const ResitForm = require('./models/ResitForm');
const MedicalSubmission = require('./models/MedicalSubmission');

async function debugMedicalRefs() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Check all medical submissions
    const medicalSubmissions = await MedicalSubmission.find({});
    console.log(`\nFound ${medicalSubmissions.length} medical submissions:`);
    medicalSubmissions.forEach(ms => {
      console.log(`- ID: ${ms._id}, Reference: ${ms.referenceId}, Condition: ${ms.medicalCondition}`);
    });

    // Check all resit forms
    const resitForms = await ResitForm.find({});
    console.log(`\nFound ${resitForms.length} resit forms:`);
    
    const medicalForms = resitForms.filter(f => f.isMedical);
    console.log(`\nFound ${medicalForms.length} medical resit forms:`);
    
    medicalForms.forEach(form => {
      console.log(`\nForm ID: ${form._id}`);
      console.log(`- isMedical: ${form.isMedical}`);
      console.log(`- medicalSubmission: ${form.medicalSubmission}`);
      console.log(`- medicalSubmissionRef: ${form.medicalSubmissionRef}`);
      console.log(`- medicalSubmissionId (old field): ${form.medicalSubmissionId}`);
    });

    // Check if any forms need the reference ID set
    const formsNeedingRef = medicalForms.filter(f => !f.medicalSubmissionRef && f.medicalSubmission);
    console.log(`\nForms needing reference ID: ${formsNeedingRef.length}`);
    
    for (const form of formsNeedingRef) {
      const medical = await MedicalSubmission.findById(form.medicalSubmission);
      if (medical) {
        console.log(`Form ${form._id} should have ref: ${medical.referenceId}`);
      }
    }

  } catch (error) {
    console.error('Debug failed:', error);
  } finally {
    await mongoose.disconnect();
    console.log('\nDisconnected from MongoDB');
  }
}

// Run the debug
debugMedicalRefs();

