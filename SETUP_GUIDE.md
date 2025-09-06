# Course Director Functionality Setup Guide

## Quick Setup for Testing

### 1. Start the Backend Server
```bash
cd backend
npm install
npm start
```

### 2. Start the Frontend Development Server
```bash
cd frontend
npm install
npm run dev
```

### 3. Database Setup
Make sure MongoDB is running and accessible. The system will create the necessary collections automatically.

### 4. Create Test Data

#### Step 1: Create a Super Admin User
1. Go to the application in your browser
2. Register a new user or use an existing one
3. Manually update the user role to 'superadmin' in the database:
```javascript
// In MongoDB shell or MongoDB Compass
db.users.updateOne(
  { email: "your-email@example.com" },
  { $set: { role: "superadmin" } }
)
```

#### Step 2: Create a Party User (Course Director Candidate)
1. Log in as super admin
2. Go to Super Admin Panel
3. Create a new user with role 'party'
4. Assign them to a department (e.g., "Computer Science")

#### Step 3: Create a Course and Assign Course Director
1. In Super Admin Panel, go to "Examination Resit System" tab
2. Create a new course
3. Assign the party user as the course director
4. Save the course

#### Step 4: Create Test Student and Submit Form
1. Create a student user
2. Log in as student
3. Go to Examination Resit
4. Submit a resit form for the course you created

### 5. Test Course Director Functionality

#### Step 1: Log in as Course Director
1. Log in with the party user credentials
2. Verify you see the "Examination Resit" navigation tab
3. Click on it to go to the course director dashboard

#### Step 2: Verify Dashboard
1. Check that your assigned course is displayed
2. Look for any pending resit forms
3. Test the approve/reject functionality

### 6. Troubleshooting

#### Issue: No "Examination Resit" Tab
- Check if the user is assigned as course director to any course
- Use the debug button on the course director dashboard
- Check browser console for error messages

#### Issue: Access Denied
- Verify the user has 'party' role
- Check if they're assigned to any courses
- Ensure the course is active

#### Issue: No Forms Showing
- Check if there are pending resit forms for the assigned courses
- Verify the forms are in 'pending' status
- Check if the forms are properly linked to the course

### 7. API Testing

#### Test Course Director Status
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/resit-forms/is-course-director
```

#### Test Pending Approvals
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/resit-forms/pending-approvals
```

#### Debug Course Assignments
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:3000/api/resit-forms/debug-course-assignments
```

### 8. Database Queries for Debugging

#### Check Course Director Assignments
```javascript
// Find all courses with their directors
db.courses.find().populate('courseDirector')

// Find courses for a specific user
db.courses.find({ courseDirector: ObjectId("USER_ID") })

// Find all resit forms for a course
db.resitforms.find({ course: ObjectId("COURSE_ID") })
```

#### Check User Roles
```javascript
// Find all party users
db.users.find({ role: "party" })

// Find users by department
db.users.find({ department: ObjectId("DEPARTMENT_ID") })
```

### 9. Expected Behavior

#### For Course Directors
- ✅ See "Examination Resit" navigation tab
- ✅ Access course director dashboard
- ✅ View assigned courses
- ✅ See pending resit forms for their courses
- ✅ Approve/reject forms with notes
- ✅ View approval history

#### For Students
- ✅ Submit resit forms for available courses
- ✅ See form status updates
- ✅ View approval/rejection notes

#### For Super Admins
- ✅ Create/edit courses
- ✅ Assign course directors
- ✅ Monitor all resit forms
- ✅ Manage the entire system

### 10. Performance Notes

- Course director status is cached in frontend
- Database queries are optimized with proper indexing
- Real-time updates for form status changes
- Responsive design for mobile and desktop

## Support

If you encounter any issues:
1. Check the browser console for error messages
2. Use the debug tools in the course director dashboard
3. Verify database connections and user permissions
4. Check the backend server logs for API errors


