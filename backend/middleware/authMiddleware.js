const jwt = require('jsonwebtoken');
const User = require('../models/User');
require('dotenv').config();

function auth(requiredRole) {
  return async (req, res, next) => {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'No token provided' });

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      console.log('=== AUTH MIDDLEWARE DEBUG ===');
      console.log('Token decoded role:', decoded.role);
      console.log('Token decoded ID:', decoded.id);
      console.log('Required role(s):', requiredRole);
      
      // Handle both single role and array of roles
      if (requiredRole) {
        if (Array.isArray(requiredRole)) {
          // If requiredRole is an array, check if user's role is in the array
          console.log('Checking if role', decoded.role, 'is in array', requiredRole);
          if (!requiredRole.includes(decoded.role)) {
            console.log('Access denied: role not in required array');
            return res.status(403).json({ error: 'Access denied' });
          }
          console.log('Role check passed for array');
        } else {
          // If requiredRole is a string, check for exact match
          console.log('Checking if role', decoded.role, 'equals', requiredRole);
          if (decoded.role !== requiredRole) {
            console.log('Access denied: role mismatch');
            return res.status(403).json({ error: 'Access denied' });
          }
          console.log('Role check passed for string');
        }
      }
      
      // Fetch full user data including department
      try {
        console.log('Fetching user data from database...');
        const user = await User.findById(decoded.id).populate('department', 'name');
        if (!user) {
          console.log('User not found in database');
          return res.status(401).json({ error: 'User not found' });
        }
        console.log('User found:', user.name, 'Role:', user.role, 'Department:', user.department?.name);
        req.user = user;
      } catch (dbError) {
        console.error('Error fetching user data:', dbError);
        // Fallback to decoded token data if database fetch fails
        console.log('Falling back to token data');
        req.user = decoded;
      }
      
      console.log('=== END AUTH MIDDLEWARE DEBUG ===');
      next();
    } catch (err) {
      console.error('JWT verification error:', err);
      res.status(401).json({ error: 'Invalid token' });
    }
  };
}

module.exports = auth;
