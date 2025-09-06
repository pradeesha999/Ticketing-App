# Ticketing System Backend

A Node.js + Express + MongoDB backend for the ticketing system.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the backend directory with the following variables:
```
PORT=5000
MONGO_URI=mongodb://localhost:27017/ticketing-system
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
```

3. Make sure MongoDB is running locally or update the MONGO_URI to point to your MongoDB instance.

4. Seed the database with initial data:
```bash
npm run seed
```

5. Start the development server:
```bash
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user

### Users (Super Admin only)
- `GET /api/users` - Get all users
- `GET /api/users/role/:role` - Get users by role
- `POST /api/users` - Create new user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user
- `GET /api/users/profile` - Get current user profile

### Tickets
- `GET /api/tickets` - Get all tickets (Super Admin)
- `GET /api/tickets/my-tickets` - Get user's tickets (Student/Party)
- `POST /api/tickets` - Create new ticket (Student)
- `PATCH /api/tickets/:id/status` - Update ticket status (Party)
- `POST /api/tickets/:id/messages` - Add message to ticket
- `PATCH /api/tickets/:id/assign` - Assign ticket to party (Super Admin)
- `GET /api/tickets/:id` - Get single ticket

### Departments
- `GET /api/departments` - Get all departments
- `POST /api/departments` - Create department (Super Admin)
- `PUT /api/departments/:id` - Update department (Super Admin)
- `DELETE /api/departments/:id` - Delete department (Super Admin)
- `GET /api/departments/parties` - Get parties for assignment (Super Admin)

## User Roles

- **superadmin**: Can manage all users, departments, and tickets
- **student**: Can create tickets and view their own tickets
- **party**: Can view assigned tickets and update their status

## Ticket Status Workflow

1. **Issued**: Student submits ticket
2. **Seen**: Party acknowledges the ticket
3. **Resolving**: Party is working on the ticket
4. **Resolved**: Ticket is completed

## Sample Login Credentials

After running the seed script, you can use these credentials:

- **Super Admin**: admin@example.com / password123
- **Student 1**: john@student.com / password123
- **Student 2**: jane@student.com / password123
- **IT Support**: it@support.com / password123
- **Facilities**: facilities@example.com / password123
