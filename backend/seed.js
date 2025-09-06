const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Department = require('./models/Department');
const Ticket = require('./models/Ticket');
const IssueCategory = require('./models/IssueCategory');

async function seedDatabase() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Clear existing data
    await User.deleteMany({});
    await Department.deleteMany({});
    await Ticket.deleteMany({});
    await IssueCategory.deleteMany({});
    console.log('Cleared existing data');

    // Create users
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const superAdmin = await User.create({
      name: 'Super Admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'superadmin',
      isActive: true
    });

    const student1 = await User.create({
      name: 'John Student',
      email: 'john@student.com',
      password: hashedPassword,
      role: 'student',
      isActive: true
    });

    const student2 = await User.create({
      name: 'Jane Student',
      email: 'jane@student.com',
      password: hashedPassword,
      role: 'student',
      isActive: true
    });

    const party1 = await User.create({
      name: 'IT Support Team',
      email: 'it@support.com',
      password: hashedPassword,
      role: 'party',
      isActive: true
    });

    const party2 = await User.create({
      name: 'Facilities Management',
      email: 'facilities@example.com',
      password: hashedPassword,
      role: 'party',
      isActive: true
    });

    // Admins (party users with admin privileges)
    const admin1 = await User.create({
      name: 'General Admin',
      email: 'general.admin@example.com',
      password: hashedPassword,
      role: 'party',
      isAdmin: true,
      isActive: true
    });

    const admin2 = await User.create({
      name: 'IT Department Admin',
      email: 'it.admin@example.com',
      password: hashedPassword,
      role: 'party',
      isAdmin: true,
      isActive: true
    });

    console.log('Created users');

    // Create departments
    const itDept = await Department.create({
      name: 'Information Technology',
      description: 'Handles all IT-related issues and support',
      assignedParty: party1._id
    });

    const facilitiesDept = await Department.create({
      name: 'Facilities Management',
      description: 'Handles building maintenance and facilities issues',
      assignedParty: party2._id
    });

    const academicDept = await Department.create({
      name: 'Academic Affairs',
      description: 'Handles academic-related inquiries and issues'
    });

    const examinationDept = await Department.create({
      name: 'Examination Department',
      description: 'Handles examination-related issues, resit requests, and medical submissions',
      assignedParty: party1._id
    });

    console.log('Created departments');

    // Update admin2 with department assignment
    await User.findByIdAndUpdate(admin2._id, { department: itDept._id });

    // Create categories (mapping needs real departments; using heuristics)
    const categoriesData = [
      { name: 'Letter request', slug: 'letter-request', department: academicDept._id },
      { name: 'General issues', slug: 'general-issues', department: academicDept._id },
      { name: 'Exam issues', slug: 'exam-issues', department: academicDept._id },
      { name: 'Lms issues', slug: 'lms-issues', department: itDept._id },
      { name: 'Quality of service', slug: 'quality-of-service', department: facilitiesDept._id },
      { name: 'Certificate collection', slug: 'certificate-collection', department: academicDept._id },
      { name: 'Email, wifi and 365 issues', slug: 'email-wifi-365-issues', department: itDept._id },
      { name: 'Other', slug: 'other', department: academicDept._id }
    ];
    const categories = await IssueCategory.insertMany(categoriesData);
    const [letterReq, generalIssues, examIssues, lmsIssues, qos, certCollection, itIssues, otherCat] = categories;
    console.log('Created categories');

    // Create sample tickets
    await Ticket.create([
      {
        ticketNumber: '202408220001',
        title: 'Computer not working',
        description: 'My laptop won\'t turn on. I tried charging it but it still doesn\'t work.',
        status: 'Issued',
        priority: 'High',
        category: itIssues._id,
        submittedBy: student1._id,
        department: itDept._id
      },
      {
        ticketNumber: '202408220002',
        title: 'Room temperature too cold',
        description: 'The air conditioning in room 201 is set too low. It\'s freezing in here.',
        status: 'Seen',
        priority: 'Medium',
        category: qos._id,
        submittedBy: student2._id,
        assignedTo: party2._id,
        department: facilitiesDept._id
      },
      {
        ticketNumber: '202408220003',
        title: 'Need software installation',
        description: 'I need Adobe Photoshop installed on my computer for my design class.',
        status: 'Resolving',
        priority: 'Medium',
        category: lmsIssues._id,
        submittedBy: student1._id,
        assignedTo: party1._id,
        department: itDept._id
      },
      {
        ticketNumber: '202408220004',
        title: 'Broken chair in library',
        description: 'There\'s a broken chair in the library on the second floor.',
        status: 'Resolved',
        priority: 'Low',
        category: qos._id,
        submittedBy: student2._id,
        assignedTo: party2._id,
        department: facilitiesDept._id,
        resolution: 'Chair has been replaced with a new one.'
      }
    ]);

    console.log('Created sample tickets');
    console.log('Database seeded successfully!');

    // Display created data
    console.log('\nCreated Users:');
    console.log('Super Admin:', superAdmin.email);
    console.log('Students:', student1.email, student2.email);
    console.log('Parties:', party1.email, party2.email);
    console.log('Admins:', admin1.email, admin2.email);

    console.log('\nLogin Credentials:');
    console.log('Email: admin@example.com, Password: password123');
    console.log('Email: john@student.com, Password: password123');
    console.log('Email: jane@student.com, Password: password123');
    console.log('Email: it@support.com, Password: password123');
    console.log('Email: facilities@example.com, Password: password123');
    console.log('Email: general.admin@example.com, Password: password123');
    console.log('Email: it.admin@example.com, Password: password123');

  } catch (error) {
    console.error('Error seeding database:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

seedDatabase();
