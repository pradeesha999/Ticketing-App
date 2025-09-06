const express = require('express');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// Get all users (Super Admin)
router.get('/', auth('superadmin'), async (req, res) => {
  try {
    const { search, role, department, active } = req.query;
    let query = {};
    
    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Role filter
    if (role) {
      query.role = role;
    }
    
    // Department filter
    if (department) {
      query.department = department;
    }
    
    // Active status filter
    if (active !== undefined) {
      query.isActive = active === 'true';
    }
    
    const users = await User.find(query)
      .populate('department', 'name')
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get users by role (Super Admin)
router.get('/role/:role', auth('superadmin'), async (req, res) => {
  try {
    const users = await User.find({ role: req.params.role }).select('-password').sort({ name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List admins - accessible to superadmin and party users
router.get('/admins', auth('party'), async (req, res) => {
  try {
    console.log('Admins request from user:', req.user.role, req.user.name);
    
    let query = { role: 'party', isAdmin: true, isActive: true };
    
    // For now, show all admin users for approval requests
    // This allows any party user to request approval from any admin
    console.log('Showing all admin users for approval requests');
    
    const admins = await User.find(query)
      .populate('department', 'name')
      .select('name email department');
    
    console.log('Found admins:', admins.length);
    res.json(admins);
  } catch (err) {
    console.error('Error in admins route:', err);
    res.status(500).json({ error: err.message });
  }
});

// Public to authenticated: list all party users for course director selection
router.get('/course-directors', auth(), async (req, res) => {
  try {
    const courseDirectors = await User.find({ role: 'party', isActive: true })
      .populate('department', 'name')
      .select('name email department isAdmin')
      .sort({ name: 1 });
    
    // Format the response to show department and admin status
    const formattedDirectors = courseDirectors.map(director => ({
      _id: director._id,
      name: director.name,
      email: director.email,
      department: director.department ? director.department.name : 'No Department',
      isAdmin: director.isAdmin,
      displayName: `${director.name}${director.department ? ` (${director.department.name})` : ''}${director.isAdmin ? ' [Admin]' : ''}`
    }));
    
    res.json(formattedDirectors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List available parties for reassignment - accessible to all authenticated users
router.get('/available-parties', auth(), async (req, res) => {
  try {
    console.log('=== AVAILABLE PARTIES REQUEST START ===');
    console.log('User:', req.user.name, 'Role:', req.user.role, 'Department:', req.user.department?.name);
    
    let query = { role: 'party', isActive: true };
    
    // For now, show all active party users for reassignment
    // This allows any party user to reassign to any other party user
    console.log('Showing all active party users for reassignment');
    
    const parties = await User.find(query)
      .populate('department', 'name')
      .select('name email department isAdmin')
      .sort({ name: 1 });
    
    console.log('Found parties:', parties.length);
    
    const formattedParties = parties.map(party => ({
      _id: party._id,
      name: party.name,
      email: party.email,
      department: party.department ? party.department.name : 'No Department',
      isAdmin: party.isAdmin,
      displayName: `${party.name}${party.department ? ` (${party.department.name})` : ''}${party.isAdmin ? ' [Admin]' : ''}`
    }));
    
    console.log('=== AVAILABLE PARTIES REQUEST END ===');
    res.json(formattedParties);
  } catch (err) {
    console.error('Error in available-parties route:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single user by ID (for authenticated users to get their own data)
router.get('/:id', auth(), async (req, res) => {
  try {
    // Users can only get their own data, or super admins can get any user's data
    if (req.user.role !== 'superadmin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: 'Access denied. You can only view your own profile.' });
    }
    
    const user = await User.findById(req.params.id)
      .populate('department', 'name')
      .select('-password');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Public to authenticated: list all party users with their departments
router.get('/parties-with-departments', auth(), async (req, res) => {
  try {
    const parties = await User.find({ role: 'party', isActive: true })
      .populate('department', 'name')
      .select('name email department isAdmin')
      .sort({ name: 1 });
    res.json(parties);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Get users by department (accessible to all authenticated users)
router.get('/department/:departmentId', auth(), async (req, res) => {
  try {
    // Check if departmentId is valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(req.params.departmentId)) {
      return res.status(400).json({ error: 'Invalid department ID' });
    }
    
    const users = await User.find({ department: req.params.departmentId })
      .populate('department', 'name')
      .select('-password')
      .sort({ name: 1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create user (Super Admin)
router.post('/', auth('superadmin'), async (req, res) => {
  const { name, email, password, role, department, isAdmin } = req.body;

  try {
    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'Name, email, password, and role are required' });
    }
    
    // Department is required only for party users without admin privileges
    if (role === 'party' && !department && !isAdmin) {
      return res.status(400).json({ error: 'Department is required for party users' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    // Only set department if provided (for party/admin users optionally)
    const userData = { name, email, password: hashedPassword, role };
    if (department) {
      userData.department = department;
    }
    if (role === 'party' && typeof isAdmin === 'boolean') {
      userData.isAdmin = isAdmin;
    }
    const user = new User(userData);
    await user.save();
    
    const userResponse = await User.findById(user._id)
      .populate('department', 'name')
      .select('-password');
    
    res.status(201).json(userResponse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user (Super Admin)
router.put('/:id', auth('superadmin'), async (req, res) => {
  const { name, email, role, password, department, isActive, isAdmin } = req.body;

  try {
    // Validate required fields
    if (!name || !email || !role) {
      return res.status(400).json({ error: 'Name, email, and role are required' });
    }
    
    // Department is required only for party users without admin privileges
    if (role === 'party' && !department && !isAdmin) {
      return res.status(400).json({ error: 'Department is required for party users' });
    }

    const updateData = { name, email, role, isActive };
    
    // Only set department if provided (for party/admin users optionally)
    if (department) {
      updateData.department = department;
    } else if (role !== 'party') {
      // Clear department for non-party users
      updateData.department = null;
    }
    if (role === 'party' && typeof isAdmin === 'boolean') {
      updateData.isAdmin = isAdmin;
    } else if (role !== 'party') {
      updateData.isAdmin = false;
    }
    
    // Only hash password if it's provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true }
    ).populate('department', 'name').select('-password');
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user (Super Admin)
router.delete('/:id', auth('superadmin'), async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get current user profile
router.get('/profile', auth(), async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .populate('department', 'name')
      .select('-password');
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update current user profile
router.put('/profile', auth(), async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const updateData = { name, email };
    
    // Only hash password if it's provided
    if (password) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true }
    ).populate('department', 'name').select('-password');
    
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
