const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = 3001;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ticketing-system')
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection failed:', err));

// Import models
const User = require('./models/User');
const Ticket = require('./models/Ticket');
const Department = require('./models/Department');
const MedicalSubmission = require('./models/MedicalSubmission');
const ResitForm = require('./models/ResitForm');
const Course = require('./models/Course');
const Batch = require('./models/Batch');
const Module = require('./models/Module');
const IssueCategory = require('./models/IssueCategory');
const Log = require('./models/Log');

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Serve HTML page
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Database Viewer - Ticketing System</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { background: #2c3e50; color: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .header h1 { font-size: 24px; margin-bottom: 10px; }
        .header p { opacity: 0.8; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 30px; }
        .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
        .stat-card h3 { color: #2c3e50; margin-bottom: 10px; }
        .stat-number { font-size: 32px; font-weight: bold; color: #3498db; }
        .collections { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
        .collection-card { background: white; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); overflow: hidden; }
        .collection-header { background: #34495e; color: white; padding: 15px; font-weight: bold; }
        .collection-content { padding: 15px; }
        .collection-item { padding: 10px; border-bottom: 1px solid #eee; font-size: 14px; }
        .collection-item:last-child { border-bottom: none; }
        .btn { background: #3498db; color: white; border: none; padding: 10px 20px; border-radius: 4px; cursor: pointer; margin: 5px; }
        .btn:hover { background: #2980b9; }
        .json-viewer { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 10px; margin: 10px 0; font-family: monospace; font-size: 12px; white-space: pre-wrap; max-height: 300px; overflow-y: auto; }
        .loading { text-align: center; padding: 20px; color: #666; }
        .error { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 4px; margin: 10px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🗄️ Database Viewer</h1>
            <p>Ticketing System - Local MongoDB Database</p>
        </div>
        
        <div class="stats" id="stats">
            <div class="loading">Loading statistics...</div>
        </div>
        
        <div class="collections" id="collections">
            <div class="loading">Loading collections...</div>
        </div>
    </div>

    <script>
        async function loadStats() {
            try {
                const response = await fetch('/api/stats');
                const stats = await response.json();
                
                const statsHtml = Object.entries(stats).map(([collection, count]) => `
                    <div class="stat-card">
                        <h3>${collection}</h3>
                        <div class="stat-number">${count}</div>
                    </div>
                `).join('');
                
                document.getElementById('stats').innerHTML = statsHtml;
            } catch (error) {
                document.getElementById('stats').innerHTML = `<div class="error">Error loading stats: ${error.message}</div>`;
            }
        }
        
        async function loadCollections() {
            try {
                const response = await fetch('/api/collections');
                const collections = await response.json();
                
                const collectionsHtml = Object.entries(collections).map(([name, data]) => `
                    <div class="collection-card">
                        <div class="collection-header">${name} (${data.count} documents)</div>
                        <div class="collection-content">
                            <button class="btn" onclick="viewCollection('${name}')">View All</button>
                            <button class="btn" onclick="viewSample('${name}')">View Sample</button>
                            <div id="content-${name}"></div>
                        </div>
                    </div>
                `).join('');
                
                document.getElementById('collections').innerHTML = collectionsHtml;
            } catch (error) {
                document.getElementById('collections').innerHTML = `<div class="error">Error loading collections: ${error.message}</div>`;
            }
        }
        
        async function viewCollection(collectionName) {
            try {
                const response = await fetch(`/api/collection/${collectionName}`);
                const data = await response.json();
                
                const content = document.getElementById(`content-${collectionName}`);
                content.innerHTML = `
                    <div class="json-viewer">${JSON.stringify(data, null, 2)}</div>
                `;
            } catch (error) {
                const content = document.getElementById(`content-${collectionName}`);
                content.innerHTML = `<div class="error">Error: ${error.message}</div>`;
            }
        }
        
        async function viewSample(collectionName) {
            try {
                const response = await fetch(`/api/collection/${collectionName}?limit=3`);
                const data = await response.json();
                
                const content = document.getElementById(`content-${collectionName}`);
                content.innerHTML = `
                    <div class="json-viewer">${JSON.stringify(data, null, 2)}</div>
                `;
            } catch (error) {
                const content = document.getElementById(`content-${collectionName}`);
                content.innerHTML = `<div class="error">Error: ${error.message}</div>`;
            }
        }
        
        // Load data on page load
        loadStats();
        loadCollections();
    </script>
</body>
</html>
  `);
});

// API Routes
app.get('/api/stats', async (req, res) => {
  try {
    const stats = {
      users: await User.countDocuments(),
      tickets: await Ticket.countDocuments(),
      departments: await Department.countDocuments(),
      medicalSubmissions: await MedicalSubmission.countDocuments(),
      resitForms: await ResitForm.countDocuments(),
      courses: await Course.countDocuments(),
      batches: await Batch.countDocuments(),
      modules: await Module.countDocuments(),
      issueCategories: await IssueCategory.countDocuments(),
      logs: await Log.countDocuments()
    };
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/collections', async (req, res) => {
  try {
    const collections = {
      users: { count: await User.countDocuments() },
      tickets: { count: await Ticket.countDocuments() },
      departments: { count: await Department.countDocuments() },
      medicalSubmissions: { count: await MedicalSubmission.countDocuments() },
      resitForms: { count: await ResitForm.countDocuments() },
      courses: { count: await Course.countDocuments() },
      batches: { count: await Batch.countDocuments() },
      modules: { count: await Module.countDocuments() },
      issueCategories: { count: await IssueCategory.countDocuments() },
      logs: { count: await Log.countDocuments() }
    };
    res.json(collections);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/collection/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    
    let data;
    switch (name) {
      case 'users':
        data = await User.find().limit(limit).lean();
        break;
      case 'tickets':
        data = await Ticket.find().populate('submittedBy assignedTo department category').limit(limit).lean();
        break;
      case 'departments':
        data = await Department.find().populate('assignedParty').limit(limit).lean();
        break;
      case 'medicalSubmissions':
        data = await MedicalSubmission.find().populate('student reviewedBy').limit(limit).lean();
        break;
      case 'resitForms':
        data = await ResitForm.find().populate('student course batch module courseDirector medicalSubmission').limit(limit).lean();
        break;
      case 'courses':
        data = await Course.find().populate('courseDirector').limit(limit).lean();
        break;
      case 'batches':
        data = await Batch.find().populate('course').limit(limit).lean();
        break;
      case 'modules':
        data = await Module.find().populate('batch course').limit(limit).lean();
        break;
      case 'issueCategories':
        data = await IssueCategory.find().populate('department').limit(limit).lean();
        break;
      case 'logs':
        data = await Log.find().populate('userId').limit(limit).lean();
        break;
      default:
        return res.status(404).json({ error: 'Collection not found' });
    }
    
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Database UI running at http://localhost:${PORT}`);
  console.log(`📊 View your database data in the browser!`);
});
