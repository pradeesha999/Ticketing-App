const mongoose = require('mongoose');
const User = require('./backend/models/User');
const Course = require('./backend/models/Course');
const Batch = require('./backend/models/Batch');
const Module = require('./backend/models/Module');
const ResitForm = require('./backend/models/ResitForm');

// MongoDB connection string
const MONGODB_URI = 'mongodb://localhost:27017/ticketing-system';

async function cleanupOrphanedData() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all course IDs that exist
    const existingCourseIds = await Course.find({}, '_id');
    const existingCourseIdStrings = existingCourseIds.map(course => course._id.toString());
    console.log(`Found ${existingCourseIdStrings.length} existing courses`);

    // Find batches with non-existent course references
    const orphanedBatches = await Batch.find({
      course: { $nin: existingCourseIdStrings }
    });
    console.log(`Found ${orphanedBatches.length} orphaned batches`);

    if (orphanedBatches.length > 0) {
      console.log('Orphaned batches:');
      orphanedBatches.forEach(batch => {
        console.log(`  - Batch: ${batch.name} (${batch.code}) - Course ID: ${batch.course}`);
      });

      // Delete orphaned batches
      const batchIds = orphanedBatches.map(batch => batch._id);
      await Batch.deleteMany({ _id: { $in: batchIds } });
      console.log(`Deleted ${orphanedBatches.length} orphaned batches`);
    }

    // Find modules with non-existent batch references
    const existingBatchIds = await Batch.find({}, '_id');
    const existingBatchIdStrings = existingBatchIds.map(batch => batch._id.toString());
    
    const orphanedModules = await Module.find({
      batch: { $nin: existingBatchIdStrings }
    });
    console.log(`Found ${orphanedModules.length} orphaned modules`);

    if (orphanedModules.length > 0) {
      console.log('Orphaned modules:');
      orphanedModules.forEach(module => {
        console.log(`  - Module: ${module.name} (${module.code}) - Batch ID: ${module.batch}`);
      });

      // Delete orphaned modules
      const moduleIds = orphanedModules.map(module => module._id);
      await Module.deleteMany({ _id: { $in: moduleIds } });
      console.log(`Deleted ${orphanedModules.length} orphaned modules`);
    }

    // Find resit forms with non-existent module references
    const existingModuleIds = await Module.find({}, '_id');
    const existingModuleIdStrings = existingModuleIds.map(module => module._id.toString());
    
    const orphanedResitForms = await ResitForm.find({
      module: { $nin: existingModuleIdStrings }
    });
    console.log(`Found ${orphanedResitForms.length} orphaned resit forms`);

    if (orphanedResitForms.length > 0) {
      console.log('Orphaned resit forms:');
      orphanedResitForms.forEach(form => {
        console.log(`  - Resit Form ID: ${form._id} - Module ID: ${form.module}`);
      });

      // Delete orphaned resit forms
      const resitFormIds = orphanedResitForms.map(form => form._id);
      await ResitForm.deleteMany({ _id: { $in: resitFormIds } });
      console.log(`Deleted ${orphanedResitForms.length} orphaned resit forms`);
    }

    // Find resit forms with non-existent course references
    const orphanedResitFormsByCourse = await ResitForm.find({
      course: { $nin: existingCourseIdStrings }
    });
    console.log(`Found ${orphanedResitFormsByCourse.length} resit forms with orphaned course references`);

    if (orphanedResitFormsByCourse.length > 0) {
      console.log('Resit forms with orphaned course references:');
      orphanedResitFormsByCourse.forEach(form => {
        console.log(`  - Resit Form ID: ${form._id} - Course ID: ${form.course}`);
      });

      // Delete orphaned resit forms
      const resitFormIds = orphanedResitFormsByCourse.map(form => form._id);
      await ResitForm.deleteMany({ _id: { $in: resitFormIds } });
      console.log(`Deleted ${orphanedResitFormsByCourse.length} resit forms with orphaned course references`);
    }

    // Update course director status for users who are no longer course directors
    const allUsers = await User.find({ role: 'party' });
    let updatedUsers = 0;

    for (const user of allUsers) {
      const courseCount = await Course.countDocuments({ courseDirector: user._id });
      if (courseCount === 0) {
        // This user is no longer a course director for any course
        console.log(`User ${user.name} (${user.email}) is no longer a course director`);
        updatedUsers++;
      }
    }

    console.log(`\nCleanup completed successfully!`);
    console.log(`- Deleted ${orphanedBatches.length} orphaned batches`);
    console.log(`- Deleted ${orphanedModules.length} orphaned modules`);
    console.log(`- Deleted ${orphanedResitForms.length + orphanedResitFormsByCourse.length} orphaned resit forms`);
    console.log(`- Found ${updatedUsers} users who are no longer course directors`);

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
}

// Run the cleanup
cleanupOrphanedData();


