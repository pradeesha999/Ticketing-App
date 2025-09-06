const express = require('express');
const router = express.Router();
const Batch = require('../models/Batch');
const Course = require('../models/Course');
const auth = require('../middleware/authMiddleware');

// Get all batches (Super Admin only)
router.get('/', auth('superadmin'), async (req, res) => {
  try {

    const batches = await Batch.find()
      .populate('course', 'name code')
      .sort({ createdAt: -1 });
    
    res.json(batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get batches by course
router.get('/course/:courseId', auth(), async (req, res) => {
  try {
    const batches = await Batch.find({ course: req.params.courseId })
      .populate('course', 'name code')
      .sort({ startYear: -1 });
    
    res.json(batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get batches for course director
router.get('/my-batches', auth(), async (req, res) => {
  try {
    // Get courses where user is course director
    const courses = await Course.find({ courseDirector: req.user.id });
    const courseIds = courses.map(course => course._id);
    
    const batches = await Batch.find({ course: { $in: courseIds } })
      .populate('course', 'name code')
      .sort({ startYear: -1 });
    
    res.json(batches);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new batch (Super Admin only)
router.post('/', auth('superadmin'), async (req, res) => {
  try {

    const { name, code, course, startYear, endYear } = req.body;

    // Validate required fields
    if (!name || !code || !course || !startYear || !endYear) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if course exists
    const courseExists = await Course.findById(course);
    if (!courseExists) {
      return res.status(400).json({ error: 'Course not found' });
    }

    // Check if batch code already exists for this course
    const existingBatch = await Batch.findOne({ course, code });
    if (existingBatch) {
      return res.status(400).json({ error: 'Batch code already exists for this course' });
    }

    const batch = new Batch({
      name,
      code,
      course,
      startYear,
      endYear
    });

    await batch.save();
    
    const populatedBatch = await Batch.findById(batch._id)
      .populate('course', 'name code');
    
    res.status(201).json(populatedBatch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update batch (Super Admin only)
router.put('/:id', auth('superadmin'), async (req, res) => {
  try {

    const { name, code, course, startYear, endYear, isActive } = req.body;
    const batchId = req.params.id;

    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Check if course exists if provided
    if (course) {
      const courseExists = await Course.findById(course);
      if (!courseExists) {
        return res.status(400).json({ error: 'Course not found' });
      }
    }

    // Check if batch code already exists for this course (excluding current batch)
    if (code && (code !== batch.code || course !== batch.course)) {
      const existingBatch = await Batch.findOne({ course: course || batch.course, code });
      if (existingBatch && existingBatch._id.toString() !== batchId) {
        return res.status(400).json({ error: 'Batch code already exists for this course' });
      }
    }

    const updatedBatch = await Batch.findByIdAndUpdate(
      batchId,
      { name, code, course, startYear, endYear, isActive },
      { new: true }
    ).populate('course', 'name code');

    res.json(updatedBatch);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete batch (Super Admin only)
router.delete('/:id', auth('superadmin'), async (req, res) => {
  try {
    const batchId = req.params.id;
    
    // Check if batch exists
    const batch = await Batch.findById(batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    // Check for dependencies before deletion
    const Module = require('../models/Module');
    const moduleCount = await Module.countDocuments({ batch: batchId });
    
    if (moduleCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete batch. It has ${moduleCount} module(s) assigned to it. Please delete all modules first.` 
      });
    }

    // Delete the batch
    await Batch.findByIdAndDelete(batchId);
    
    res.json({ message: 'Batch deleted successfully' });
  } catch (err) {
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
