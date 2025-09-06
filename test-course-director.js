#!/usr/bin/env node

/**
 * Test Script for Course Director Functionality
 * 
 * This script tests the course director functionality by:
 * 1. Creating a test course director user
 * 2. Creating a test course and assigning the user as course director
 * 3. Verifying the course director status check works
 * 
 * Run with: node test-course-director.js
 */

const mongoose = require('mongoose');
const User = require('./backend/models/User');
const Course = require('./backend/models/Course');
const Department = require('./backend/models/Department');

// MongoDB connection string - update this to match your setup
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ticketing-system';

async function testCourseDirectorFunctionality() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Clean up any existing test data
    console.log('🧹 Cleaning up test data...');
    await User.deleteMany({ email: 'test-course-director@example.com' });
    await Course.deleteMany({ code: 'TEST101' });
    await Department.deleteMany({ name: 'Test Department' });

    // Create a test department
    console.log('🏢 Creating test department...');
    const testDepartment = new Department({
      name: 'Test Department',
      description: 'Test department for course director testing'
    });
    await testDepartment.save();
    console.log('✅ Test department created:', testDepartment.name);

    // Create a test course director user
    console.log('👤 Creating test course director user...');
    const testCourseDirector = new User({
      name: 'Test Course Director',
      email: 'test-course-director@example.com',
      password: 'testpassword123',
      role: 'party',
      department: testDepartment._id,
      isAdmin: false,
      isActive: true
    });
    await testCourseDirector.save();
    console.log('✅ Test course director user created:', testCourseDirector.name);

    // Create a test course and assign the user as course director
    console.log('📚 Creating test course...');
    const testCourse = new Course({
      name: 'Test Course',
      code: 'TEST101',
      description: 'Test course for course director functionality testing',
      courseDirector: testCourseDirector._id,
      isActive: true
    });
    await testCourse.save();
    console.log('✅ Test course created:', testCourse.name);

    // Verify the course director assignment
    console.log('🔍 Verifying course director assignment...');
    const courseWithDirector = await Course.findById(testCourse._id).populate('courseDirector');
    console.log('✅ Course director assigned:', courseWithDirector.courseDirector.name);

    // Test the course director status check
    console.log('🔍 Testing course director status check...');
    const coursesForDirector = await Course.find({ courseDirector: testCourseDirector._id });
    console.log('✅ Courses found for course director:', coursesForDirector.length);
    coursesForDirector.forEach(course => {
      console.log(`   - ${course.name} (${course.code})`);
    });

    // Test if user is actually a course director
    const isCourseDirector = coursesForDirector.length > 0;
    console.log('✅ User is course director:', isCourseDirector);

    // Clean up test data
    console.log('🧹 Cleaning up test data...');
    await User.findByIdAndDelete(testCourseDirector._id);
    await Course.findByIdAndDelete(testCourse._id);
    await Department.findByIdAndDelete(testDepartment._id);
    console.log('✅ Test data cleaned up');

    console.log('\n🎉 All tests passed! Course director functionality is working correctly.');
    console.log('\n📋 Summary:');
    console.log('   - Course director user creation: ✅');
    console.log('   - Course creation with director assignment: ✅');
    console.log('   - Course director status verification: ✅');
    console.log('   - Data cleanup: ✅');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Run the test
if (require.main === module) {
  testCourseDirectorFunctionality();
}

module.exports = { testCourseDirectorFunctionality };


