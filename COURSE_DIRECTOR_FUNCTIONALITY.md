# Course Director Functionality Documentation

## Overview
The ticketing system now includes comprehensive course director functionality that allows party users to be assigned as course directors for specific courses and manage examination resit forms submitted by students.

## How It Works

### 1. Course Director Assignment
- **Super Admin Role**: Only super admins can assign users as course directors
- **Assignment Process**: 
  - Go to Super Admin Panel → Examination Resit System tab
  - Create/Edit courses and assign a course director from the available party users
  - The course director field is required when creating a course

### 2. Course Director Access Control
- **Navigation**: Course directors get an "Examination Resit" tab in the main navigation
- **Route**: Course directors are directed to `/examination-resit-course-director`
- **Access Check**: The system verifies if a party user is assigned as a course director to any course

### 3. Course Director Dashboard Features

#### Assigned Courses Display
- Shows all courses where the user is assigned as course director
- Displays course name and code
- If no courses are assigned, shows a warning message

#### Pending Approvals Tab
- Lists all resit forms with "pending" status for the director's assigned courses
- Shows student information, course details, module, exam type, and medical status
- Provides Approve/Reject buttons for each form

#### Approval History Tab
- Shows all previously approved/rejected forms for the director's courses
- Displays review dates and final status

#### Approval/Rejection Workflow
- Click Approve or Reject button on any pending form
- Enter approval message or rejection reason
- Form status is updated and moved to approval history
- Students can see the updated status of their forms

### 4. Backend Implementation

#### Models
- **Course**: Contains `courseDirector` field referencing User
- **ResitForm**: Contains `courseDirector` field and approval tracking
- **User**: Role-based access control with 'party' role

#### API Endpoints
- `GET /api/resit-forms/is-course-director` - Check if user is course director
- `GET /api/resit-forms/pending-approvals` - Get pending forms for course director
- `GET /api/resit-forms/approval-history` - Get approval history
- `POST /api/resit-forms/:id/approve` - Approve a resit form
- `POST /api/resit-forms/:id/reject` - Reject a resit form
- `GET /api/resit-forms/debug-course-assignments` - Debug endpoint for troubleshooting

#### Access Control Middleware
- `checkCourseDirector` middleware ensures only course directors can access protected endpoints
- Verifies user is assigned as course director to at least one course
- Super admins have full access
- Students can only access their own forms

### 5. Frontend Implementation

#### Layout Navigation
- Dynamic navigation based on user role and course director status
- Separate routes for students/super admin vs course directors
- Real-time status checking with refresh capability

#### Course Director Dashboard
- Responsive design with tabbed interface
- Real-time data loading and updates
- Form approval modal with validation
- Debug tools for troubleshooting

### 6. User Experience Flow

#### For Super Admins
1. Create courses and assign course directors
2. Monitor all resit forms across the system
3. Manage course director assignments

#### For Course Directors
1. Log in and see "Examination Resit" navigation tab
2. View assigned courses on dashboard
3. Review pending resit forms from students
4. Approve or reject forms with notes
5. Track approval history

#### For Students
1. Submit resit forms for specific courses
2. Forms are automatically assigned to course director
3. Receive status updates (pending → approved/rejected)
4. View approval/rejection notes

### 7. Security Features

#### Role-Based Access Control
- Students: Can only see their own forms
- Course Directors: Can only see forms for their assigned courses
- Super Admins: Full system access

#### Data Validation
- Course director assignment verification
- Form ownership validation
- Input sanitization and validation

### 8. Troubleshooting

#### Debug Tools
- **Debug Button**: Available on course director dashboard
- **Console Logging**: Detailed logging for course director status checks
- **API Endpoints**: Debug endpoints for troubleshooting assignments

#### Common Issues
1. **No Navigation Tab**: Check if user is assigned as course director to any course
2. **Access Denied**: Verify course director assignment in super admin panel
3. **No Forms Showing**: Check if there are pending forms for assigned courses

### 9. Testing the System

#### Prerequisites
1. Create a party user (course director candidate)
2. Create a course and assign the party user as course director
3. Have a student submit a resit form for that course

#### Test Steps
1. Log in as course director
2. Verify "Examination Resit" tab appears
3. Navigate to course director dashboard
4. Check assigned courses are displayed
5. Review pending forms (if any)
6. Test approve/reject functionality

## Technical Notes

### Database Relationships
- User (party) ← Course (courseDirector)
- Course ← ResitForm (course)
- ResitForm → User (student, courseDirector)

### Performance Considerations
- Course director status is cached in frontend state
- Database queries are optimized with proper indexing
- Lazy loading for form data

### Future Enhancements
- Email notifications for course directors
- Bulk approval operations
- Advanced reporting and analytics
- Mobile-responsive improvements


