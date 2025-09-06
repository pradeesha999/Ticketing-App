import { writable } from 'svelte/store';
import axios from 'axios';

// Create stores for authentication state
export const user = writable(null);
export const isAuthenticated = writable(false);
export const isLoading = writable(false);
export const isInitializing = writable(true);

// API base URL
const API_BASE_URL = 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Add request interceptor to include auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      logout();
    }
    return Promise.reject(error);
  }
);

// Login function
export async function login(email, password) {
  try {
    isLoading.set(true);
    const response = await api.post('/auth/login', { email, password });
    const { token, role, name, isAdmin } = response.data;
    
    // Store token and user info
    const userData = { id: response.data.id, role, name, email, isAdmin, department: response.data.department };
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    
    // Set user data directly from login response (department is already populated)
    user.set(userData);
    
    isAuthenticated.set(true);
    
    return { success: true, role };
  } catch (error) {
    console.error('Login error:', error);
    return { 
      success: false, 
      error: error.response?.data?.error || 'Login failed' 
    };
  } finally {
    isLoading.set(false);
  }
}

// Logout function
export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  user.set(null);
  isAuthenticated.set(false);
}

// Check if user is already logged in (on app start)
export async function initializeAuth() {
  try {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    
    if (token && userData) {
      try {
        const userInfo = JSON.parse(userData);
        
        // Verify token with server
        try {
          await api.get('/auth/verify');
          // Token is valid, restore user session
          
          // Use stored user data (department is already populated from login)
          user.set(userInfo);
          isAuthenticated.set(true);
        } catch (error) {
          // Token is invalid, clear everything
          console.log('Token verification failed, logging out');
          logout();
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
        logout();
      }
    }
  } finally {
    isInitializing.set(false);
  }
}

// Export the API instance for other modules
export { api };
