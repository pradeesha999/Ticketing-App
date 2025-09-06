const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const User = require('../models/User');
const auth = require('../middleware/authMiddleware');

// Get all courses (Super Admin only)
router.get('/', auth('superadmin'), async (req, res) => {
  try {

    const courses = await Course.find()
      .populate('courseDirector', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get available courses for students (public endpoint)
router.get('/available', auth(), async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const courses = await Course.find({ isActive: true })
      .populate('courseDirector', 'name email')
      .sort({ name: 1 });
    
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get courses for course director
router.get('/my-courses', auth(), async (req, res) => {
  try {
    const courses = await Course.find({ courseDirector: req.user.id })
      .populate('courseDirector', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new course (Super Admin only)
router.post('/', auth('superadmin'), async (req, res) => {
  try {

    const { name, code, description, courseDirector } = req.body;

    // Validate required fields
    if (!name || !code || !courseDirector) {
      return res.status(400).json({ error: 'Name, code, and course director are required' });
    }

    // Check if course director exists
    const director = await User.findById(courseDirector);
    if (!director) {
      return res.status(400).json({ error: 'Course director not found' });
    }

    // Check if course code already exists
    const existingCourse = await Course.findOne({ code });
    if (existingCourse) {
      return res.status(400).json({ error: 'Course code already exists' });
    }

    const course = new Course({
      name,
      code,
      description,
      courseDirector
    });

    await course.save();
    
    const populatedCourse = await Course.findById(course._id)
      .populate('courseDirector', 'name email');
    
    res.status(201).json(populatedCourse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update course (Super Admin only)
router.put('/:id', auth('superadmin'), async (req, res) => {
  try {

    const { name, code, description, courseDirector, isActive } = req.body;
    const courseId = req.params.id;

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check if course director exists if provided
    if (courseDirector) {
      const director = await User.findById(courseDirector);
      if (!director) {
        return res.status(400).json({ error: 'Course director not found' });
      }
    }

    // Check if course code already exists (excluding current course)
    if (code && code !== course.code) {
      const existingCourse = await Course.findOne({ code });
      if (existingCourse) {
        return res.status(400).json({ error: 'Course code already exists' });
      }
    }

    const updatedCourse = await Course.findByIdAndUpdate(
      courseId,
      { name, code, description, courseDirector, isActive },
      { new: true }
    ).populate('courseDirector', 'name email');

    res.json(updatedCourse);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete course (Super Admin only)
router.delete('/:id', auth('superadmin'), async (req, res) => {
  try {
    const courseId = req.params.id;
    
    // Check if course exists
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Check for dependencies before deletion
    const Batch = require('../models/Batch');
    const batchCount = await Batch.countDocuments({ course: courseId });
    
    if (batchCount > 0) {
      return res.status(400).json({ 
        error: `Cannot delete course. It has ${batchCount} batch(es) assigned to it. Please delete all batches first.` 
      });
    }

    // Delete the course
    await Course.findByIdAndDelete(courseId);
    
    res.json({ message: 'Course deleted successfully' });
  } catch (err) {
    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
