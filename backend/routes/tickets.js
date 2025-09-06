const express = require('express');
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Department = require('../models/Department');
const IssueCategory = require('../models/IssueCategory');
const Counter = require('../models/Counter');
const auth = require('../middleware/authMiddleware');
const Logger = require('../services/logger');
// Validation middleware removed
const { asyncHandler } = require('../middleware/errorMiddleware');

const router = express.Router();

// Get all tickets (Super Admin)
router.get('/', auth('superadmin'), asyncHandler(async (req, res) => {
  const { search, status, priority, department, assignedTo } = req.query;
  let query = {};
  
  // Search filter
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  // Status filter
  if (status) {
    query.status = status;
  }
  
  // Priority filter
  if (priority) {
    query.priority = priority;
  }
  
  // Department filter
  if (department) {
    query.department = department;
  }
  
  // Assigned to filter
  if (assignedTo) {
    query.assignedTo = assignedTo;
  }
  
  const tickets = await Ticket.find(query)
    .populate('submittedBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('department', 'name')
    .sort({ createdAt: -1 });
  res.json(tickets);
}));

// Get tickets for specific user (Student/Party)
router.get('/my-tickets', auth(), asyncHandler(async (req, res) => {
  try {
    let tickets;
    if (req.user.role === 'student') {
      tickets = await Ticket.find({ submittedBy: req.user.id })
        .populate('assignedTo', 'name email')
        .populate('department', 'name')
        .populate('messages.sender', 'name')
        .populate('approvalAdmin', 'name email')
        .populate('approvalRequestedBy', 'name email')
        .populate('approvalReviewedBy', 'name email')
        .sort({ createdAt: -1 });
    } else if (req.user.role === 'party') {
      tickets = await Ticket.find({ assignedTo: req.user.id })
        .populate('submittedBy', 'name email')
        .populate('department', 'name')
        .populate('messages.sender', 'name')
        .populate('approvalAdmin', 'name email')
        .populate('approvalRequestedBy', 'name email')
        .populate('approvalReviewedBy', 'name email')
        .sort({ createdAt: -1 });
    }
    res.json(tickets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}));

// Create new ticket (Student)
router.post('/', auth('student'), asyncHandler(async (req, res) => {
  try {
    const { title, description, categoryId, department: overrideDepartmentId, assignedTo: overrideAssignedTo } = req.body;
    
    // Validate required fields
    if (!title || !description || !categoryId) {
      return res.status(400).json({ error: 'Title, description, and category are required' });
    }
    
    if (title.length < 5 || title.length > 200) {
      return res.status(400).json({ error: 'Title must be between 5 and 200 characters' });
    }
    
    if (description.length < 10 || description.length > 2000) {
      return res.status(400).json({ error: 'Description must be between 10 and 2000 characters' });
    }

    const category = await IssueCategory.findById(categoryId).populate('department', 'name slug');
    if (!category || !category.isActive) {
      return res.status(400).json({ error: 'Invalid or inactive category' });
    }

    let departmentId = category.department?._id;

    // Special handling for 'Other' category: require department and allow selecting party
    if (category.slug === 'other') {
      if (!overrideDepartmentId) {
        return res.status(400).json({ error: 'Department is required for Other category' });
      }
      // Validate department
      const dept = await Department.findById(overrideDepartmentId);
      if (!dept) {
        return res.status(400).json({ error: 'Invalid department' });
      }
      departmentId = overrideDepartmentId;
    }

    if (!departmentId) {
      return res.status(400).json({ error: 'Category is not mapped to a department' });
    }

    // Generate ticket number YYYYMMDDNNNN
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    const key = `tickets:${yyyy}${mm}${dd}`;
    const counter = await Counter.findOneAndUpdate(
      { _id: key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const ticketNumber = `${yyyy}${mm}${dd}${String(counter.seq).padStart(4, '0')}`;

    const ticket = new Ticket({
      title,
      description,
      category: category._id,
      priority: 'Medium',
      department: departmentId,
      submittedBy: req.user.id,
      ticketNumber
    });

    // Log ticket creation
    Logger.logTicket({
      action: 'ticket_created',
      description: `New ticket created: ${ticketNumber} - ${title}`,
      ...Logger.extractUserInfo(req),
      metadata: {
        ticketNumber,
        title,
        category: category.name,
        department: category.department?.name,
        priority: 'Medium'
      }
    });

    // For 'Other', if a party is selected, validate and assign
    if (category.slug === 'other' && overrideAssignedTo) {
      const party = await User.findById(overrideAssignedTo);
      if (!party || party.role !== 'party') {
        return res.status(400).json({ error: 'Invalid party ID' });
      }
      // Optional: ensure party belongs to chosen department if set
      if (party.department && party.department.toString() !== departmentId.toString()) {
        return res.status(400).json({ error: 'Selected party does not belong to the chosen department' });
      }
      ticket.assignedTo = overrideAssignedTo;
      ticket.status = 'Seen';
    } else {
      // Auto-assign to department's assigned party if available, or find best available party
      const dept = await Department.findById(departmentId);
      if (dept && dept.assignedParty) {
        ticket.assignedTo = dept.assignedParty;
        ticket.status = 'Seen';
      } else {
        // Find party with lowest active ticket count in this department
        const departmentParties = await User.find({ 
          role: 'party', 
          department: departmentId, 
          isActive: true 
        });
        
        if (departmentParties.length > 0) {
          // Get active ticket counts for each party
          const partyLoads = await Promise.all(
            departmentParties.map(async (party) => {
              const activeTicketCount = await Ticket.countDocuments({
                assignedTo: party._id,
                status: { $in: ['Issued', 'Seen', 'In Progress'] }
              });
              return { partyId: party._id, count: activeTicketCount };
            })
          );
          
          // Find parties with lowest load
          const minLoad = Math.min(...partyLoads.map(p => p.count));
          const lowestLoadParties = partyLoads.filter(p => p.count === minLoad);
          
          // Randomly select from lowest load parties
          const selectedParty = lowestLoadParties[Math.floor(Math.random() * lowestLoadParties.length)];
          ticket.assignedTo = selectedParty.partyId;
          ticket.status = 'Seen';
        } else {
          // If no department-specific parties, try to find any available party (including admins)
          const availableParties = await User.find({ 
            role: 'party', 
            isActive: true 
          });
          
          if (availableParties.length > 0) {
            // Get active ticket counts for each party
            const partyLoads = await Promise.all(
              availableParties.map(async (party) => {
                const activeTicketCount = await Ticket.countDocuments({
                  assignedTo: party._id,
                  status: { $in: ['Issued', 'Seen', 'In Progress'] }
                });
                return { partyId: party._id, count: activeTicketCount };
              })
            );
            
            // Find parties with lowest load
            const minLoad = Math.min(...partyLoads.map(p => p.count));
            const lowestLoadParties = partyLoads.filter(p => p.count === minLoad);
            
            // Randomly select from lowest load parties
            const selectedParty = lowestLoadParties[Math.floor(Math.random() * lowestLoadParties.length)];
            ticket.assignedTo = selectedParty.partyId;
            ticket.status = 'Seen';
          }
        }
      }
    }

    await ticket.save();

    const populatedTicket = await Ticket.findById(ticket._id)
      .populate('submittedBy', 'name email')
      .populate('department', 'name')
      .populate('assignedTo', 'name email')
      .populate('category', 'name');

    res.status(201).json(populatedTicket);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}));

// Update ticket status (Party)
router.patch('/:id/status', auth('party'), asyncHandler(async (req, res) => {
  const { status, resolution } = req.body;

  // Validate status
  if (!status) {
    return res.status(400).json({ error: 'Status is required' });
  }

  // Only allow defined statuses
  const allowed = ['Seen', 'In Progress', 'Resolved', 'Denounced'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  // Validate resolution if provided
  if (resolution && (resolution.length < 5 || resolution.length > 1000)) {
    return res.status(400).json({ error: 'Resolution must be between 5 and 1000 characters' });
  }

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  
  if (!ticket.assignedTo || ticket.assignedTo.toString() !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to update this ticket' });
  }

  ticket.status = status;
  if (resolution) ticket.resolution = resolution;
  
  // Set resolvedAt timestamp when status is changed to 'Resolved'
  if (status === 'Resolved' && !ticket.resolvedAt) {
    ticket.resolvedAt = new Date();
  }
  
  await ticket.save();
  
  const updatedTicket = await Ticket.findById(ticket._id)
    .populate('submittedBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('department', 'name');
  
  res.json(updatedTicket);
}));

// Add message to ticket
router.post('/:id/messages', auth(), asyncHandler(async (req, res) => {
  const { message } = req.body;

  // Validate message
  if (!message || message.trim().length === 0) {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (message.length > 1000) {
    return res.status(400).json({ error: 'Message must be less than 1000 characters' });
  }

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  
  // Check if user is authorized to add messages
  const isAuthorized = req.user.role === 'superadmin' || 
                      ticket.submittedBy.toString() === req.user.id ||
                      ticket.assignedTo?.toString() === req.user.id;
  
  if (!isAuthorized) {
    return res.status(403).json({ error: 'Not authorized to add messages to this ticket' });
  }

  ticket.messages.push({
    sender: req.user.id,
    message: message.trim()
  });
  await ticket.save();
  
  const updatedTicket = await Ticket.findById(ticket._id)
    .populate('submittedBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('department', 'name')
    .populate('messages.sender', 'name');
  
  res.json(updatedTicket);
}));

// Assign ticket to party (Super Admin)
router.patch('/:id/assign', auth('superadmin'), asyncHandler(async (req, res) => {
  const { assignedTo } = req.body;

  if (!assignedTo) {
    return res.status(400).json({ error: 'Assigned party ID is required' });
  }

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const party = await User.findById(assignedTo);
  if (!party || party.role !== 'party') {
    return res.status(400).json({ error: 'Invalid party ID' });
  }

  ticket.assignedTo = assignedTo;
  ticket.status = 'Seen';
  await ticket.save();
  
  const updatedTicket = await Ticket.findById(ticket._id)
    .populate('submittedBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('department', 'name');
  
  res.json(updatedTicket);
}));

// Reassign ticket to different party (Party who currently owns the ticket)
router.patch('/:id/reassign', auth('party'), asyncHandler(async (req, res) => {
  const { assignedTo } = req.body;

  if (!assignedTo) {
    return res.status(400).json({ error: 'New assigned party ID is required' });
  }

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  // Check if ticket is resolved or denounced - these tickets cannot be reassigned
  if (ticket.status === 'Resolved' || ticket.status === 'Denounced') {
    return res.status(400).json({ error: 'Cannot reassign a resolved or denounced ticket' });
  }

  // Only the currently assigned party can reassign
  if (!ticket.assignedTo || ticket.assignedTo.toString() !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to reassign this ticket' });
  }

  const newParty = await User.findById(assignedTo);
  if (!newParty || newParty.role !== 'party') {
    return res.status(400).json({ error: 'Invalid party ID' });
  }

  ticket.assignedTo = assignedTo;
  if (!['In Progress', 'Resolved', 'Denounced'].includes(ticket.status)) {
    ticket.status = 'Seen';
  }
  await ticket.save();

  const updatedTicket = await Ticket.findById(ticket._id)
    .populate('submittedBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('department', 'name');

  res.json(updatedTicket);
}));

// Update ticket priority (Super Admin)
router.patch('/:id/priority', auth('superadmin'), asyncHandler(async (req, res) => {
  const { priority } = req.body;

  if (!priority) {
    return res.status(400).json({ error: 'Priority is required' });
  }

  const allowedPriorities = ['Low', 'Medium', 'High', 'Critical'];
  if (!allowedPriorities.includes(priority)) {
    return res.status(400).json({ error: 'Invalid priority level' });
  }

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  ticket.priority = priority;
  await ticket.save();
  
  const updatedTicket = await Ticket.findById(ticket._id)
    .populate('submittedBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('department', 'name');
  
  res.json(updatedTicket);
}));

// Request admin approval (Party on assigned ticket)
router.post('/:id/approval/request', 
  auth('party'), 
  asyncHandler(async (req, res) => {
    const { adminId, notes } = req.body;
    
    if (!adminId) {
      return res.status(400).json({ error: 'Admin ID is required' });
    }

    if (notes && (notes.length < 5 || notes.length > 500)) {
      return res.status(400).json({ error: 'Notes must be between 5 and 500 characters' });
    }
    
    const ticket = await Ticket.findById(req.params.id);
    if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
    
    // Check if ticket is resolved or denounced - these tickets cannot request approval
    if (ticket.status === 'Resolved' || ticket.status === 'Denounced') {
      return res.status(400).json({ error: 'Cannot request approval for a resolved or denounced ticket' });
    }
    
    if (!ticket.assignedTo || ticket.assignedTo.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Not authorized to request approval for this ticket' });
    }

    const admin = await User.findById(adminId);
    if (!admin || admin.role !== 'party' || admin.isAdmin !== true) {
      return res.status(400).json({ error: 'Invalid admin ID' });
    }

    ticket.approvalStatus = 'pending';
    ticket.approvalAdmin = adminId;
    ticket.approvalRequestedBy = req.user.id;
    ticket.approvalRequestedAt = new Date();
    ticket.approvalNotes = notes || undefined;

    await ticket.save();

    const updated = await Ticket.findById(ticket._id)
      .populate('approvalAdmin', 'name email')
      .populate('approvalRequestedBy', 'name email')
      .populate('submittedBy', 'name email')
      .populate('assignedTo', 'name email')
      .populate('department', 'name');

    res.json(updated);
  })
);

// Admin: approve
router.post('/:id/approval/approve', auth(), asyncHandler(async (req, res) => {
  const { notes } = req.body;
  
  if (req.user.role !== 'party') return res.status(403).json({ error: 'Access denied' });
  const me = await User.findById(req.user.id);
  if (!me || me.isAdmin !== true) return res.status(403).json({ error: 'Access denied' });

  if (notes && (notes.length < 5 || notes.length > 500)) {
    return res.status(400).json({ error: 'Notes must be between 5 and 500 characters' });
  }

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.approvalStatus !== 'pending' || ticket.approvalAdmin?.toString() !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized or no pending approval for this ticket' });
  }

  ticket.approvalStatus = 'approved';
  ticket.approvalReviewedBy = req.user.id;
  ticket.approvalReviewedAt = new Date();
  ticket.approvalNotes = notes || ticket.approvalNotes;
  await ticket.save();

  const updated = await Ticket.findById(ticket._id)
    .populate('submittedBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('department', 'name')
    .populate('approvalAdmin', 'name email')
    .populate('approvalRequestedBy', 'name email')
    .populate('approvalReviewedBy', 'name email');

  res.json(updated);
}));

// Admin: reject
router.post('/:id/approval/reject', auth(), asyncHandler(async (req, res) => {
  const { notes } = req.body;
  
  if (req.user.role !== 'party') return res.status(403).json({ error: 'Access denied' });
  const me = await User.findById(req.user.id);
  if (!me || me.isAdmin !== true) return res.status(403).json({ error: 'Access denied' });

  if (notes && (notes.length < 5 || notes.length > 500)) {
    return res.status(400).json({ error: 'Notes must be between 5 and 500 characters' });
  }

  const ticket = await Ticket.findById(req.params.id);
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.approvalStatus !== 'pending' || ticket.approvalAdmin?.toString() !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized or no pending approval for this ticket' });
  }

  ticket.approvalStatus = 'rejected';
  ticket.approvalReviewedBy = req.user.id;
  ticket.approvalReviewedAt = new Date();
  ticket.approvalNotes = notes || ticket.approvalNotes;
  await ticket.save();

  const updated = await Ticket.findById(ticket._id)
    .populate('submittedBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('department', 'name')
    .populate('approvalAdmin', 'name email')
    .populate('approvalRequestedBy', 'name email')
    .populate('approvalReviewedBy', 'name email');

  res.json(updated);
}));

// Admin: list tickets awaiting my approval (moved to end to avoid route conflicts)
router.get('/approvals/pending', auth(), asyncHandler(async (req, res) => {
  // Only party users with isAdmin can see this
  if (req.user.role !== 'party') return res.status(403).json({ error: 'Access denied' });

  const me = await User.findById(req.user.id);
  if (!me || me.isAdmin !== true) return res.status(403).json({ error: 'Access denied' });

  const tickets = await Ticket.find({ approvalStatus: 'pending', approvalAdmin: req.user.id })
    .populate('submittedBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('department', 'name')
    .populate('approvalRequestedBy', 'name email');
  res.json(tickets);
}));

// Admin: list approval history
router.get('/approvals/history', auth(), asyncHandler(async (req, res) => {
  // Only party users with isAdmin can see this
  if (req.user.role !== 'party') return res.status(403).json({ error: 'Access denied' });

  const me = await User.findById(req.user.id);
  if (!me || me.isAdmin !== true) return res.status(403).json({ error: 'Access denied' });

  const tickets = await Ticket.find({ 
    approvalAdmin: req.user.id,
    approvalStatus: { $in: ['approved', 'rejected'] }
  })
    .populate('submittedBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('department', 'name')
    .populate('approvalRequestedBy', 'name email')
    .populate('approvalReviewedBy', 'name email')
    .sort({ approvalReviewedAt: -1 });
  res.json(tickets);
}));

// Get single ticket
router.get('/:id', auth(), asyncHandler(async (req, res) => {
  const ticket = await Ticket.findById(req.params.id)
    .populate('submittedBy', 'name email')
    .populate('assignedTo', 'name email')
    .populate('department', 'name')
    .populate('messages.sender', 'name');
  
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  
  // Check authorization
  const isAuthorized = req.user.role === 'superadmin' || 
                      ticket.submittedBy.toString() === req.user.id ||
                      ticket.assignedTo?.toString() === req.user.id;
  
  if (!isAuthorized) {
    return res.status(403).json({ error: 'Not authorized to view this ticket' });
  }
  
  res.json(ticket);
}));

module.exports = router;
