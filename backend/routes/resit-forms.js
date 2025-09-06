const express = require('express');
const router = express.Router();
const { asyncHandler } = require('../middleware/errorMiddleware');
const { sanitizeInput } = require('../middleware/validationMiddleware');

// Import models with error handling
let ResitForm, Course, Batch, Module, User, MedicalSubmission, Department;

try {
  ResitForm = require('../models/ResitForm');
  Course = require('../models/Course');
  Batch = require('../models/Batch');
  Module = require('../models/Module');
  User = require('../models/User');
  MedicalSubmission = require('../models/MedicalSubmission');
  Department = require('../models/Department');
} catch (error) {
  console.error('Error loading models:', error);
}

const auth = require('../middleware/authMiddleware');

// Middleware to check if user is a course director
const checkCourseDirector = async (req, res, next) => {
  try {
    console.log('Course director check for user:', req.user.id, 'role:', req.user.role);
    
    if (req.user.role === 'superadmin') {
      console.log('Super admin access granted');
      return next(); // Super admins have access
    }
    
    if (req.user.role === 'student') {
      console.log('Student access granted');
      return next(); // Students have access
    }
    
    if (req.user.role === 'party') {
      console.log('Party user, checking if course director...');
      
      // Check if user is assigned as course director to any course
      const courses = await Course.find({ courseDirector: req.user.id });
      console.log('Courses where user is course director:', courses.length);
      
      if (courses.length === 0) {
        console.log('User is not a course director for any course');
        return res.status(403).json({ error: 'Access denied. Only course directors can access examination resits.' });
      }
      
      console.log('Course director check passed');
      return next();
    }
    
    console.log('Invalid user role:', req.user.role);
    return res.status(403).json({ error: 'Access denied. Invalid user role.' });
  } catch (error) {
    console.error('Error in course director check:', error);
    res.status(500).json({ error: 'Error checking course director access' });
  }
};

// Get all resit forms (Super Admin only)
router.get('/', auth('superadmin'), async (req, res) => {
  try {

    const resitForms = await ResitForm.find()
      .populate('student', 'name email')
      .populate('course', 'name code')
      .populate('batch', 'name code')
      .populate('module', 'name code')
      .populate('courseDirector', 'name email')
      .populate('medicalSubmission', 'referenceId medicalCondition startDate endDate')
      .sort({ createdAt: -1 });
    
    res.json(resitForms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if user is a course director
router.get('/is-course-director', auth(), async (req, res) => {
  try {
    console.log('Checking course director status for user:', req.user.id, req.user.name, 'role:', req.user.role);
    
    if (req.user.role === 'superadmin') {
      console.log('User is superadmin, returning true');
      return res.json({ isCourseDirector: true });
    }
    
    if (req.user.role === 'student') {
      console.log('User is student, returning false');
      return res.json({ isCourseDirector: false });
    }
    
    if (req.user.role === 'party') {
      console.log('User is party, checking course director assignments...');
      
      // First check if user is assigned as course director to any course
      const courses = await Course.find({ courseDirector: req.user.id });
      console.log('Courses found for course director:', courses.length);
      courses.forEach(course => {
        console.log('  Course:', course.name, 'ID:', course._id);
      });
      
      if (courses.length > 0) {
        console.log('User is course director, returning true');
        return res.json({ 
          isCourseDirector: true,
          courseCount: courses.length,
          courses: courses.map(c => ({ id: c._id, name: c.name, code: c.code }))
        });
      }
      
      // If no courses found, user is NOT a course director
      console.log('User is not course director, returning false');
      return res.json({ 
        isCourseDirector: false,
        courseCount: 0,
        note: 'No courses assigned - not a course director'
      });
    }
    
    console.log('User role not recognized, returning false');
    return res.json({ 
      isCourseDirector: false,
      courseCount: 0,
      note: 'Invalid user role'
    });
  } catch (err) {
    console.error('Error checking course director status:', err);
    res.status(500).json({ error: err.message });
  }
});

// Debug route to see what courses a user is assigned to
router.get('/debug-course-assignments', auth(), async (req, res) => {
  try {
    console.log('Debug course assignments for user:', req.user.id, req.user.name, 'role:', req.user.role);
    
    if (req.user.role !== 'party') {
      return res.json({ 
        message: 'Only party users can be course directors',
        role: req.user.role
      });
    }
    
    // Get courses where user is course director
    const courses = await Course.find({ courseDirector: req.user.id });
    console.log('Courses found for course director:', courses.length);
    
    // Get user's department info
    let departmentInfo = null;
    if (req.user.department) {
      const department = await Department.findById(req.user.department);
      departmentInfo = department ? { id: department._id, name: department.name } : null;
    }
    
    res.json({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      department: departmentInfo,
      courseCount: courses.length,
      courses: courses.map(c => ({
        id: c._id,
        name: c.name,
        code: c.code,
        isActive: c.isActive
      })),
      isCourseDirector: courses.length > 0
    });
  } catch (err) {
    console.error('Error in debug route:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get courses where user is course director
router.get('/my-courses', auth(), async (req, res) => {
  try {
    if (req.user.role === 'superadmin') {
      // Super admins can see all courses
      const allCourses = await Course.find({ isActive: true }).select('name code description');
      return res.json({ courses: allCourses });
    }
    
    if (req.user.role === 'student') {
      return res.json({ courses: [] });
    }
    
    if (req.user.role === 'party') {
      // Get courses where user is course director
      const courses = await Course.find({ 
        courseDirector: req.user.id,
        isActive: true 
      }).select('name code description');
      
      return res.json({ courses });
    }
    
    return res.json({ courses: [] });
  } catch (err) {
    console.error('Error getting courses:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get resit forms for student
router.get('/my-forms', auth(), async (req, res) => {
  try {
    if (req.user.role !== 'student') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const resitForms = await ResitForm.find({ student: req.user.id })
      .populate('course', 'name code')
      .populate('batch', 'name code')
      .populate('module', 'name code')
      .populate('courseDirector', 'name email')
      .populate('medicalSubmission', 'referenceId medicalCondition startDate endDate')
      .sort({ createdAt: -1 });
    
    res.json(resitForms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get resit forms for course director
router.get('/pending-approvals', auth(), checkCourseDirector, async (req, res) => {
  try {
    console.log('Pending approvals request from user:', req.user.id, 'role:', req.user.role);
    
    // Get courses where user is course director
    const courses = await Course.find({ courseDirector: req.user.id });
    console.log('Courses found for course director:', courses.length);
    courses.forEach(course => {
      console.log('Course:', course.name, 'ID:', course._id);
    });
    
    const courseIds = courses.map(course => course._id);
    console.log('Course IDs:', courseIds);
    
    // Find all pending resit forms for these courses
    const resitForms = await ResitForm.find({ 
      course: { $in: courseIds },
      status: 'pending'
    })
      .populate('student', 'name email')
      .populate('course', 'name code')
      .populate('batch', 'name code')
      .populate('module', 'name code')
      .populate('medicalSubmission', 'referenceId medicalCondition startDate endDate')
      .sort({ createdAt: -1 });
    
    console.log('Pending resit forms found:', resitForms.length);
    resitForms.forEach(form => {
      console.log('Form:', form._id, 'Course:', form.course?.name, 'Status:', form.status, 'Created:', form.createdAt);
    });
    
    // Also check for any resit forms that might not have the correct status
    const allForms = await ResitForm.find({ 
      course: { $in: courseIds }
    }).select('_id status course createdAt');
    
    console.log('All resit forms for these courses:', allForms.length);
    allForms.forEach(form => {
      console.log('Form:', form._id, 'Status:', form.status, 'Course:', form.course, 'Created:', form.createdAt);
    });
    
    res.json(resitForms);
  } catch (err) {
    console.error('Error in pending approvals:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get resit forms history for course director
router.get('/approval-history', auth(), checkCourseDirector, async (req, res) => {
  try {
    // Get courses where user is course director
    const courses = await Course.find({ courseDirector: req.user.id });
    const courseIds = courses.map(course => course._id);
    
    const resitForms = await ResitForm.find({ 
      course: { $in: courseIds },
      status: { $in: ['approved', 'rejected'] }
    })
      .populate('student', 'name email')
      .populate('course', 'name code')
      .populate('batch', 'name code')
      .populate('module', 'name code')
      .populate('courseDirector', 'name email')
      .populate('medicalSubmission', 'referenceId medicalCondition startDate endDate')
      .sort({ reviewedAt: -1 });
    
    res.json(resitForms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create new resit form (Student only)
router.post('/', auth('student'), sanitizeInput, asyncHandler(async (req, res) => {
  // Check if models are loaded
  if (!ResitForm || !Course || !Batch || !Module || !User || !MedicalSubmission || !Department) {
    console.error('Models not loaded:', { ResitForm: !!ResitForm, Course: !!Course, Batch: !!Batch, Module: !!Module, User: !!User, MedicalSubmission: !!MedicalSubmission, Department: !!Department });
    return res.status(500).json({ error: 'Server configuration error' });
  }

    console.log('Received resit form data:', req.body);

    const { 
      course, 
      batch, 
      module, 
      examType, 
      pastExamDates, 
      phoneNumber, 
      isMedical, 
      medicalSubmission 
    } = req.body;

    // Clean up medicalSubmission field - convert empty string to null
    const cleanMedicalSubmission = medicalSubmission && medicalSubmission.trim() !== '' ? medicalSubmission : null;

    // Validate required fields
    if (!course || !batch || !module || !examType || !pastExamDates || !phoneNumber) {
      return res.status(400).json({ error: 'All required fields must be provided' });
    }

    // Clean up and validate course, batch, and module IDs
    if (!course.toString().match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid course ID format' });
    }
    if (!batch.toString().match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid batch ID format' });
    }
    if (!module.toString().match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ error: 'Invalid module ID format' });
    }

    // Validate exam type
    if (!['Coursework', 'Exam'].includes(examType)) {
      return res.status(400).json({ error: 'Invalid exam type. Must be either "Coursework" or "Exam"' });
    }

    // Validate phone number format: must be exactly 10 digits
    if (!/^\d{10}$/.test(phoneNumber)) {
      return res.status(400).json({ error: 'Phone number must be exactly 10 digits (numbers only)' });
    }

    // Validate past exam dates
    if (!Array.isArray(pastExamDates) || pastExamDates.length === 0) {
      return res.status(400).json({ error: 'Past exam dates must be an array with at least one date' });
    }
    if (pastExamDates.length > 3) {
      return res.status(400).json({ error: 'Maximum 3 past exam dates allowed' });
    }

    // Ensure past exam dates are valid Date objects
    const validatedPastExamDates = pastExamDates.map(dateStr => {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        throw new Error('Invalid exam date format');
      }
      return date;
    });

    // Validate medical submission if medical
    if (isMedical && !cleanMedicalSubmission) {
      return res.status(400).json({ error: 'Medical submission is required when marking as medical' });
    }

    // If medical submission is provided, validate it exists and belongs to the student
    if (cleanMedicalSubmission) {
      const medicalDoc = await MedicalSubmission.findById(cleanMedicalSubmission);
      if (!medicalDoc) {
        return res.status(400).json({ error: 'Medical submission not found' });
      }
      if (medicalDoc.student.toString() !== req.user.id) {
        return res.status(403).json({ error: 'Medical submission does not belong to you' });
      }
      if (medicalDoc.status !== 'approved') {
        return res.status(400).json({ error: 'Medical submission must be approved' });
      }
    }

    // Check if course exists
    const courseExists = await Course.findById(course);
    if (!courseExists) {
      return res.status(400).json({ error: 'Course not found' });
    }
    console.log('Course found:', courseExists.name, 'Course Director:', courseExists.courseDirector);

    // Check if batch exists
    const batchExists = await Batch.findById(batch);
    if (!batchExists) {
      return res.status(400).json({ error: 'Batch not found' });
    }

    // Check if module exists
    const moduleExists = await Module.findById(module);
    if (!moduleExists) {
      return res.status(400).json({ error: 'Module not found' });
    }

    // Check if course has a course director assigned
    if (!courseExists.courseDirector) {
      return res.status(400).json({ error: 'Course does not have a course director assigned' });
    }

    const resitForm = new ResitForm({
      student: req.user.id,
      course,
      batch,
      module,
      examType,
      pastExamDates: validatedPastExamDates,
      phoneNumber,
      isMedical,
      medicalSubmission: cleanMedicalSubmission,
      courseDirector: courseExists.courseDirector
    });

    console.log('Saving resit form...');
    await resitForm.save();
    console.log('Resit form saved successfully, ID:', resitForm._id);
    
    console.log('Populating form data...');
    const populatedForm = await ResitForm.findById(resitForm._id)
      .populate('course', 'name code')
      .populate('batch', 'name code')
      .populate('module', 'name code')
      .populate('courseDirector', 'name email');
    
    console.log('Form populated successfully');
    res.status(201).json(populatedForm);
}));

// Approve resit form (Course Director only)
router.post('/:id/approve', auth('party'), checkCourseDirector, async (req, res) => {
  try {
    const { reviewNotes } = req.body;
    const formId = req.params.id;

    const resitForm = await ResitForm.findById(formId);
    if (!resitForm) {
      return res.status(404).json({ error: 'Resit form not found' });
    }

    // Check if user is course director for this course
    const course = await Course.findOne({ 
      _id: resitForm.course, 
      courseDirector: req.user.id 
    });
    if (!course) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedForm = await ResitForm.findByIdAndUpdate(
      formId,
      {
        status: 'approved',
        reviewedAt: new Date(),
        reviewNotes,
        courseDirector: req.user.id
      },
      { new: true }
    )
      .populate('student', 'name email')
      .populate('course', 'name code')
      .populate('batch', 'name code')
      .populate('module', 'name code')
      .populate('courseDirector', 'name email');

    res.json(updatedForm);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject resit form (Course Director only)
router.post('/:id/reject', auth('party'), checkCourseDirector, async (req, res) => {
  try {
    const { reviewNotes } = req.body;
    const formId = req.params.id;

    const resitForm = await ResitForm.findById(formId);
    if (!resitForm) {
      return res.status(404).json({ error: 'Resit form not found' });
    }

    // Check if user is course director for this course
    const course = await Course.findOne({ 
      _id: resitForm.course, 
      courseDirector: req.user.id 
    });
    if (!course) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedForm = await ResitForm.findByIdAndUpdate(
      formId,
      {
        status: 'rejected',
        reviewedAt: new Date(),
        reviewNotes,
        courseDirector: req.user.id
      },
      { new: true }
    )
      .populate('student', 'name email')
      .populate('course', 'name code')
      .populate('batch', 'name code')
      .populate('module', 'name code')
      .populate('courseDirector', 'name email');

    res.json(updatedForm);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single resit form
router.get('/:id', auth(), checkCourseDirector, async (req, res) => {
  try {
    const resitForm = await ResitForm.findById(req.params.id)
      .populate('student', 'name email')
      .populate('course', 'name code')
      .populate('batch', 'name code')
      .populate('module', 'name code')
      .populate('courseDirector', 'name email');

    if (!resitForm) {
      return res.status(404).json({ error: 'Resit form not found' });
    }

    // Check access permissions
    if (req.user.role === 'student' && resitForm.student.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (req.user.role !== 'superadmin') {
      const course = await Course.findOne({ 
        _id: resitForm.course, 
        courseDirector: req.user.id 
      });
      if (!course) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json(resitForm);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
