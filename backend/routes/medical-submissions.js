const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const MedicalSubmission = require('../models/MedicalSubmission');
const User = require('../models/User');
const Department = require('../models/Department');
const auth = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorMiddleware');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads', 'medical-submissions');
    try {
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    } catch (error) {
      console.error('Error creating upload directory:', error);
      cb(error);
    }
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 10 // Max 10 files
  },
  fileFilter: function (req, file, cb) {
    // Allow only certain file types
    const allowedTypes = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowedTypes.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, JPG, JPEG, PNG files are allowed.'));
    }
  }
});

// Middleware to check if user is from Examination Department
const checkExaminationDepartment = async (req, res, next) => {
  try {
    if (req.user.role === 'superadmin') {
      return next(); // Super admins have access
    }
    
    if (req.user.role === 'party') {
      // Check if user belongs to Examination Department
      if (req.user.department) {
        const department = await Department.findById(req.user.department);
        if (department && department.name === 'Examination Department') {
          return next();
        }
      }
    }
    
    return res.status(403).json({ error: 'Access denied. Only Examination Department users can access this.' });
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

// Submit new medical submission (Students only)
router.post('/', auth('student'), (req, res, next) => {
  upload.array('documents', 10)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      // A Multer error occurred when uploading
      console.error('Multer error:', err);
      return res.status(400).json({ error: `File upload error: ${err.message}` });
    } else if (err) {
      // An unknown error occurred when uploading
      console.error('Unknown upload error:', err);
      return res.status(400).json({ error: `Upload error: ${err.message}` });
    }
    
    // Everything went fine, proceed with the request
    next();
  });
}, async (req, res) => {
  try {
    const { medicalCondition, startDate, endDate } = req.body;
    const uploadedFiles = req.files || [];
    
    console.log('Received data:', { medicalCondition, startDate, endDate, filesCount: uploadedFiles.length });
    
    if (!medicalCondition || !startDate || !endDate) {
      return res.status(400).json({ error: 'Medical condition, start date, and end date are required' });
    }
    
    // Process uploaded files
    const documents = uploadedFiles.map(file => ({
      filename: file.filename,
      originalName: file.originalname,
      path: file.path,
      uploadedAt: new Date()
    }));
    
    // Generate reference ID
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const referenceId = `MED${timestamp}${random}`;
    
    const submission = new MedicalSubmission({
      student: req.user.id,
      medicalCondition,
      startDate,
      endDate,
      documents,
      referenceId,
      status: 'pending'
    });
    
    await submission.save();
    
    const populatedSubmission = await MedicalSubmission.findById(submission._id)
      .populate('student', 'name email');
    
    res.status(201).json({
      message: 'Medical submission submitted successfully',
      submission: populatedSubmission
    });
  } catch (err) {
    console.error('Error creating medical submission:', err);
    // Clean up uploaded files if there's an error
    if (req.files) {
      req.files.forEach(file => {
        if (fs.existsSync(file.path)) {
          try {
            fs.unlinkSync(file.path);
          } catch (unlinkErr) {
            console.error('Error deleting file:', unlinkErr);
          }
        }
      });
    }
    res.status(500).json({ error: err.message });
  }
});

// Get student's own medical submissions (Students only)
router.get('/my-submissions', auth('student'), async (req, res) => {
  try {
    const submissions = await MedicalSubmission.find({ student: req.user.id })
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

// Download document
router.get('/download/:filename', auth(), async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '..', 'uploads', 'medical-submissions', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Check if user has access to this file
    if (req.user.role === 'student') {
      // Students can only download their own documents
      const submission = await MedicalSubmission.findOne({
        'documents.filename': filename,
        student: req.user.id
      });
      
      if (!submission) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }
    
    res.download(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
