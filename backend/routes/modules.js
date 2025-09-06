const express = require('express');
const router = express.Router();
const Module = require('../models/Module');
const Batch = require('../models/Batch');
const Course = require('../models/Course');
const auth = require('../middleware/authMiddleware');

// Get all modules (Super Admin only)
router.get('/', auth('superadmin'), async (req, res) => {
  try {

    const modules = await Module.find()
      .populate('batch', 'name code')
      .populate('course', 'name code')
      .sort({ createdAt: -1 });
    
    res.json(modules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get modules by batch
router.get('/batch/:batchId', auth(), async (req, res) => {
  try {
    const modules = await Module.find({ batch: req.params.batchId })
      .populate('batch', 'name code')
      .populate('course', 'name code')
      .sort({ name: 1 });
    
    res.json(modules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get modules for course director
router.get('/my-modules', auth(), async (req, res) => {
  try {
    // Get courses where user is course director
    const courses = await Course.find({ courseDirector: req.user.id });
    const courseIds = courses.map(course => course._id);
    
    const modules = await Module.find({ course: { $in: courseIds } })
      .populate('batch', 'name code')
      .populate('course', 'name code')
      .sort({ name: 1 });
    
    res.json(modules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new module (Super Admin only)
router.post('/', auth('superadmin'), async (req, res) => {
  try {

    const { name, code, batch, course, credits } = req.body;

    // Validate required fields
    if (!name || !code || !batch || !course || !credits) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if batch exists
    const batchExists = await Batch.findById(batch);
    if (!batchExists) {
      return res.status(400).json({ error: 'Batch not found' });
    }

    // Check if course exists
    const courseExists = await Course.findById(course);
    if (!courseExists) {
      return res.status(400).json({ error: 'Course not found' });
    }

    // Check if module code already exists for this batch
    const existingModule = await Module.findOne({ batch, code });
    if (existingModule) {
      return res.status(400).json({ error: 'Module code already exists for this batch' });
    }

    const module = new Module({
      name,
      code,
      batch,
      course,
      credits
    });

    await module.save();
    
    const populatedModule = await Module.findById(module._id)
      .populate('batch', 'name code')
      .populate('course', 'name code');
    
    res.status(201).json(populatedModule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update module (Super Admin only)
router.put('/:id', auth('superadmin'), async (req, res) => {
  try {

    const { name, code, batch, course, credits, isActive } = req.body;
    const moduleId = req.params.id;

    const module = await Module.findById(moduleId);
    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    // Check if batch exists if provided
    if (batch) {
      const batchExists = await Batch.findById(batch);
      if (!batchExists) {
        return res.status(400).json({ error: 'Batch not found' });
      }
    }

    // Check if course exists if provided
    if (course) {
      const courseExists = await Course.findById(course);
      if (!courseExists) {
        return res.status(400).json({ error: 'Course not found' });
      }
    }

    // Check if module code already exists for this batch (excluding current module)
    if (code && (code !== module.code || batch !== module.batch)) {
      const existingModule = await Module.findOne({ batch: batch || module.batch, code });
      if (existingModule && existingModule._id.toString() !== moduleId) {
        return res.status(400).json({ error: 'Module code already exists for this batch' });
      }
    }

    const updatedModule = await Module.findByIdAndUpdate(
      moduleId,
      { name, code, batch, course, credits, isActive },
      { new: true }
    ).populate('batch', 'name code').populate('course', 'name code');

    res.json(updatedModule);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete module (Super Admin only)
router.delete('/:id', auth('superadmin'), async (req, res) => {
  try {
    const moduleId = req.params.id;
    
    // Check if module exists
    const module = await Module.findById(moduleId);
    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    // Check for dependencies before deletion
    const ResitForm = require('../models/ResitForm');
    const resitFormCount = await ResitForm.countDocuments({ module: moduleId });
    
    if (resitFormCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete module. It has ${resitFormCount} resit form(s) assigned to it. Please delete all resit forms first.` 
      });
    }

    // Delete the module
    await Module.findByIdAndDelete(moduleId);
    
    res.json({ message: 'Module deleted successfully' });
  } catch (err) {
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      return res.status(500).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
