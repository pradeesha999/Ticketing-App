const mongoose = require('mongoose');
const User = require('./backend/models/User');
const Course = require('./backend/models/Course');

// MongoDB connection string
const MONGODB_URI = 'mongodb://localhost:27017/ticketing-system';

async function testCourseDirectorLogic() {
  try {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    // Test 1: Find a party user who might be a course director
    const partyUsers = await User.find({ role: 'party' }).limit(5);
    console.log(`\nFound ${partyUsers.length} party users:`);
    
    for (const user of partyUsers) {
      console.log(`\n--- User: ${user.name} (${user.email}) ---`);
      
      // Check if they are assigned as course director to any course
      const courses = await Course.find({ courseDirector: user._id });
      console.log(`  Courses assigned: ${courses.length}`);
      
      if (courses.length > 0) {
        console.log('  Assigned courses:');
        courses.forEach(course => {
          console.log(`    - ${course.name} (${course.code})`);
        });
        console.log(`  → This user IS a course director`);
      } else {
        console.log(`  → This user is NOT a course director (no courses assigned)`);
      }
    }

    // Test 2: Check all courses and their directors
    console.log('\n\n--- All Courses and Their Directors ---');
    const allCourses = await Course.find().populate('courseDirector', 'name email');
    
    for (const course of allCourses) {
      console.log(`\nCourse: ${course.name} (${course.code})`);
      if (course.courseDirector) {
        console.log(`  Director: ${course.courseDirector.name} (${course.courseDirector.email})`);
      } else {
        console.log(`  Director: None assigned`);
      }
    }

    // Test 3: Find users who are course directors but have no active courses
    console.log('\n\n--- Users Who Are Course Directors ---');
    const courseDirectors = await Course.distinct('courseDirector');
    console.log(`Total unique course directors: ${courseDirectors.length}`);
    
    for (const directorId of courseDirectors) {
      const user = await User.findById(directorId);
      const courses = await Course.find({ courseDirector: directorId });
      
      if (user) {
        console.log(`\n${user.name} (${user.email}):`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Courses: ${courses.length}`);
        courses.forEach(course => {
          console.log(`    - ${course.name} (${course.code})`);
        });
      }
    }

  } catch (error) {
    console.error('Error during testing:', error);
  } finally {
    // Close the connection
    await mongoose.connection.close();
    console.log('\nMongoDB connection closed');
  }
}

// Run the test
testCourseDirectorLogic();


