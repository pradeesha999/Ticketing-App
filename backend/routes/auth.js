const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');
const { userValidation, sanitizeInput } = require('../middleware/validationMiddleware');
const { asyncHandler } = require('../middleware/errorMiddleware');
require('dotenv').config();

const router = express.Router();

// Register
router.post('/register', 
  sanitizeInput,
  userValidation.create,
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ name, email, password: hashedPassword, role });
    await user.save();
    
    res.status(201).json({ message: 'User registered successfully' });
  })
);

// Login
router.post('/login', 
  sanitizeInput,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '1d'
    });

    // For party users, include department information
    if (user.role === 'party' && user.department) {
      const Department = require('../models/Department');
      const department = await Department.findById(user.department);
      res.json({ 
        id: user._id,
        token, 
        role: user.role, 
        name: user.name, 
        isAdmin: user.isAdmin,
        department: department ? { _id: department._id, name: department.name } : null
      });
    } else {
      res.json({ id: user._id, token, role: user.role, name: user.name, isAdmin: user.isAdmin });
    }
  })
);

// Verify token endpoint
router.get('/verify', 
  auth(), 
  asyncHandler(async (req, res) => {
    // If we get here, the token is valid (auth middleware passed)
    let userData = req.user;
    
    // For party users, include department information
    if (req.user.role === 'party' && req.user.department) {
      const Department = require('../models/Department');
      const department = await Department.findById(req.user.department);
      userData = {
        ...req.user.toObject(),
        department: department ? { _id: department._id, name: department.name } : null
      };
    }
    
    res.json({ valid: true, user: userData });
  })
);

module.exports = router;
