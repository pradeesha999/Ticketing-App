const express = require('express');
const router = express.Router();
const MedicalSubmission = require('../models/MedicalSubmission');
const User = require('../models/User');
const Department = require('../models/Department');
const auth = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorMiddleware');

// Middleware to check if user is from Examination Department
const checkExaminationDepartment = async (req, res, next) => {
  try {
    console.log('🔍 BACKEND DEBUG: checkExaminationDepartment called');
    console.log('🔍 User info:', {
      id: req.user._id,
      role: req.user.role,
      department: req.user.department,
      departmentId: req.user.department?._id || req.user.department
    });
    
    if (req.user.role === 'superadmin') {
      console.log('🔍 Super admin access granted');
      return next(); // Super admins have access
    }
    
    if (req.user.role === 'party') {
      console.log('🔍 Party user, checking department...');
      // Check if user belongs to Exam Department (the actual name in the database)
      if (req.user.department) {
        console.log('🔍 User has department, looking it up...');
        const department = await Department.findById(req.user.department);
        console.log('🔍 Found department:', department);
        if (department && department.name === 'Exam Department') {
          console.log('🔍 Exam Department access granted');
          return next();
        } else {
          console.log('🔍 Department name mismatch:', department?.name, '!==', 'Exam Department');
        }
      } else {
        console.log('🔍 User has no department');
      }
    }
    
    console.log('🔍 Access denied');
    return res.status(403).json({ error: 'Access denied. Only Exam Department users can access this.' });
  } catch (error) {
    console.error('Error in examination department check:', error);
    res.status(500).json({ error: 'Error checking department access' });
  }
};

// Get all medical submissions (Examination Department users only)
router.get('/', auth(), checkExaminationDepartment, async (req, res) => {
  try {
    const submissions = await MedicalSubmission.find()
      .populate('student', 'name email')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get pending medical submissions (Examination Department users only)
router.get('/pending', auth(), checkExaminationDepartment, async (req, res) => {
  try {
    const submissions = await MedicalSubmission.find({ status: 'pending' })
      .populate('student', 'name email')
      .sort({ createdAt: -1 });
    
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get approved medical submissions (Examination Department users only)
router.get('/approved', auth(), checkExaminationDepartment, async (req, res) => {
  try {
    const submissions = await MedicalSubmission.find({ status: 'approved' })
      .populate('student', 'name email')
      .populate('reviewedBy', 'name email')
      .sort({ reviewedAt: -1 });
    
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get rejected medical submissions (Examination Department users only)
router.get('/rejected', auth(), checkExaminationDepartment, async (req, res) => {
  try {
    const submissions = await MedicalSubmission.find({ status: 'rejected' })
      .populate('student', 'name email')
      .populate('reviewedBy', 'name email')
      .sort({ reviewedAt: -1 });
    
    res.json(submissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get specific medical submission with full details (Examination Department users only)
router.get('/:id', auth(), checkExaminationDepartment, async (req, res) => {
  try {
    const submission = await MedicalSubmission.findById(req.params.id)
      .populate('student', 'name email')
      .populate('reviewedBy', 'name email');
    
    if (!submission) {
      return res.status(404).json({ error: 'Medical submission not found' });
    }
    
    res.json(submission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Approve medical submission (Examination Department users only)
router.post('/:id/approve', auth(), checkExaminationDepartment, async (req, res) => {
  try {
    const { reviewNotes } = req.body;
    const submissionId = req.params.id;
    
    const submission = await MedicalSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Medical submission not found' });
    }
    
    if (submission.status !== 'pending') {
      return res.status(400).json({ error: 'Can only approve pending submissions' });
    }
    
    // Update submission status
    submission.status = 'approved';
    submission.reviewNotes = reviewNotes || 'Approved by examination department';
    submission.reviewedBy = req.user.id;
    submission.reviewedAt = new Date();
    
    await submission.save();
    
    const populatedSubmission = await MedicalSubmission.findById(submissionId)
      .populate('student', 'name email')
      .populate('reviewedBy', 'name email');
    
    res.json({
      message: 'Medical submission approved successfully',
      submission: populatedSubmission
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject medical submission (Examination Department users only)
router.post('/:id/reject', auth(), checkExaminationDepartment, async (req, res) => {
  try {
    const { reviewNotes } = req.body;
    const submissionId = req.params.id;
    
    if (!reviewNotes || reviewNotes.trim() === '') {
      return res.status(400).json({ error: 'Review notes are required for rejection' });
    }
    
    const submission = await MedicalSubmission.findById(submissionId);
    if (!submission) {
      return res.status(404).json({ error: 'Medical submission not found' });
    }
    
    if (submission.status !== 'pending') {
      return res.status(400).json({ error: 'Can only reject pending submissions' });
    }
    
    // Update submission status
    submission.status = 'rejected';
    submission.reviewNotes = reviewNotes;
    submission.reviewedBy = req.user.id;
    submission.reviewedAt = new Date();
    
    await submission.save();
    
    const populatedSubmission = await MedicalSubmission.findById(submissionId)
      .populate('student', 'name email')
      .populate('reviewedBy', 'name email');
    
    res.json({
      message: 'Medical submission rejected successfully',
      submission: populatedSubmission
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get medical submission statistics (Examination Department users only)
router.get('/stats/overview', auth(), checkExaminationDepartment, async (req, res) => {
  try {
    const total = await MedicalSubmission.countDocuments();
    const pending = await MedicalSubmission.countDocuments({ status: 'pending' });
    const approved = await MedicalSubmission.countDocuments({ status: 'approved' });
    const rejected = await MedicalSubmission.countDocuments({ status: 'rejected' });
    
    res.json({
      total,
      pending,
      approved,
      rejected
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
