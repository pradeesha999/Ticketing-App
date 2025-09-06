const mongoose = require('mongoose');
require('dotenv').config();

// Test Atlas connection
async function testAtlasConnection() {
  try {
    console.log('Testing MongoDB Atlas connection...');
    console.log('Connection string:', process.env.MONGO_URI?.replace(/\/\/.*@/, '//***:***@'));
    
    // Connect to Atlas
    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    
    console.log('✅ Successfully connected to MongoDB Atlas!');
    
    // Test database operations
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    console.log('📊 Available collections:', collections.map(c => c.name));
    
    // Test a simple query
    const userCount = await db.collection('users').countDocuments();
    console.log(`👥 Total users in database: ${userCount}`);
    
    const ticketCount = await db.collection('tickets').countDocuments();
    console.log(`🎫 Total tickets in database: ${ticketCount}`);
    
    console.log('🎉 Atlas connection test completed successfully!');
    
  } catch (error) {
    console.error('❌ Atlas connection failed:', error.message);
    console.error('Full error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from Atlas');
  }
}

// Run the test
testAtlasConnection();
