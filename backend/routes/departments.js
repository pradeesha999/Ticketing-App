const express = require('express');
const Department = require('../models/Department');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { sanitizeInput } = require('../middleware/validationMiddleware');

const router = express.Router();

// Get all departments
router.get('/', auth(), asyncHandler(async (req, res) => {
  const departments = await Department.find()
    .populate('assignedParty', 'name email')
    .sort({ name: 1 });
  res.json(departments);
}));

// Create department (Super Admin)
router.post('/', auth('superadmin'), sanitizeInput, asyncHandler(async (req, res) => {
  const { name, description, assignedParty } = req.body;

  // Validate required fields
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Department name is required' });
  }

  // Handle empty string for assignedParty
  const departmentData = {
    name: name.trim(),
    description: description ? description.trim() : undefined,
    assignedParty: assignedParty && assignedParty.trim() !== '' ? assignedParty : undefined
  };

  const department = new Department(departmentData);
  await department.save();
  
  const populatedDepartment = await Department.findById(department._id)
    .populate('assignedParty', 'name email');
  
  res.status(201).json(populatedDepartment);
}));

// Update department (Super Admin)
router.put('/:id', auth('superadmin'), sanitizeInput, asyncHandler(async (req, res) => {
  const { name, description, assignedParty } = req.body;

  // Validate required fields
  if (!name || name.trim().length === 0) {
    return res.status(400).json({ error: 'Department name is required' });
  }

  // Handle empty string for assignedParty
  const updateData = {
    name: name.trim(),
    description: description ? description.trim() : undefined,
    assignedParty: assignedParty && assignedParty.trim() !== '' ? assignedParty : undefined
  };

  const department = await Department.findByIdAndUpdate(
    req.params.id,
    updateData,
    { new: true }
  ).populate('assignedParty', 'name email');
  
  if (!department) return res.status(404).json({ error: 'Department not found' });
  
  res.json(department);
}));

// Delete department (Super Admin)
router.delete('/:id', auth('superadmin'), asyncHandler(async (req, res) => {
  const department = await Department.findByIdAndDelete(req.params.id);
  if (!department) return res.status(404).json({ error: 'Department not found' });
  
  res.json({ message: 'Department deleted successfully' });
}));

// Get parties for assignment
router.get('/parties', auth('superadmin'), asyncHandler(async (req, res) => {
  const parties = await User.find({ role: 'party' }).select('name email');
  res.json(parties);
}));

module.exports = router;
