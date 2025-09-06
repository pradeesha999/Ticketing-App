const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const User = require('./models/User');
const Department = require('./models/Department');
const Ticket = require('./models/Ticket');
const IssueCategory = require('./models/IssueCategory');
const Counter = require('./models/Counter');

async function cleanupDatabase() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');

    // Remove everything
    await Promise.all([
      User.deleteMany({}),
      Department.deleteMany({}),
      Ticket.deleteMany({}),
      IssueCategory.deleteMany({}),
      Counter.deleteMany({}),
    ]);
    console.log('Cleared users, departments, tickets, categories, counters');

    // Recreate super admin with known credentials
    const hashedPassword = await bcrypt.hash('password123', 10);
    const superAdmin = await User.create({
      name: 'Super Admin',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'superadmin',
      isActive: true
    });
    console.log('Recreated super admin:', superAdmin.email);
  } catch (err) {
    console.error('Cleanup failed:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

cleanupDatabase();



