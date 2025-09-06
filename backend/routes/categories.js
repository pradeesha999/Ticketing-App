const express = require('express');
const IssueCategory = require('../models/IssueCategory');
const Department = require('../models/Department');
const auth = require('../middleware/authMiddleware');

const router = express.Router();

// Public: list active categories for student dropdown
router.get('/', async (req, res) => {
  try {
    const categories = await IssueCategory.find({ isActive: true })
      .populate('department', 'name')
      .sort({ ordering: 1, name: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: list all categories (including inactive)
router.get('/all', auth('superadmin'), async (req, res) => {
  try {
    const categories = await IssueCategory.find()
      .populate('department', 'name')
      .sort({ ordering: 1, name: 1 });
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: create category
router.post('/', auth('superadmin'), async (req, res) => {
  try {
    const { name, description, department, isActive, ordering } = req.body;
    if (!name || !department) {
      return res.status(400).json({ error: 'name and department are required' });
    }

    const dept = await Department.findById(department);
    if (!dept) return res.status(400).json({ error: 'Invalid department' });

    // Generate slug from name
    const slug = name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    const category = new IssueCategory({ 
      name, 
      description, 
      department, 
      isActive, 
      ordering,
      slug 
    });
    
    await category.save();
    const populated = await IssueCategory.findById(category._id).populate('department', 'name');
    res.status(201).json(populated);
  } catch (err) {
    console.error('Error creating category:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: update category
router.put('/:id', auth('superadmin'), async (req, res) => {
  try {
    const { name, description, department, isActive, ordering } = req.body;
    if (department) {
      const dept = await Department.findById(department);
      if (!dept) return res.status(400).json({ error: 'Invalid department' });
    }
    const update = { name, description, department, isActive, ordering };
    const category = await IssueCategory.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('department', 'name');
    if (!category) return res.status(404).json({ error: 'Category not found' });
    res.json(category);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;


