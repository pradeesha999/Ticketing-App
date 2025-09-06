const mongoose = require('mongoose');
require('dotenv').config();

// Connect to database
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/ticketing-system', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}

// View all collections and their documents
async function viewDatabase() {
  try {
    const db = mongoose.connection.db;
    
    // Get all collections
    const collections = await db.listCollections().toArray();
    console.log('\n📊 DATABASE OVERVIEW');
    console.log('='.repeat(50));
    console.log(`Database: ${db.databaseName}`);
    console.log(`Total Collections: ${collections.length}`);
    console.log('='.repeat(50));
    
    // Loop through each collection
    for (const collection of collections) {
      const collectionName = collection.name;
      const count = await db.collection(collectionName).countDocuments();
      
      console.log(`\n📁 Collection: ${collectionName}`);
      console.log(`   Documents: ${count}`);
      console.log('-'.repeat(40));
      
      if (count > 0) {
        // Show first 3 documents as examples
        const sampleDocs = await db.collection(collectionName).find({}).limit(3).toArray();
        
        sampleDocs.forEach((doc, index) => {
          console.log(`   Document ${index + 1}:`);
          console.log(JSON.stringify(doc, null, 4));
          console.log('');
        });
        
        if (count > 3) {
          console.log(`   ... and ${count - 3} more documents`);
        }
      }
      console.log('='.repeat(50));
    }
    
  } catch (error) {
    console.error('❌ Error viewing database:', error.message);
  }
}

// View specific collection
async function viewCollection(collectionName) {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection(collectionName);
    const count = await collection.countDocuments();
    
    console.log(`\n📁 Collection: ${collectionName}`);
    console.log(`   Total Documents: ${count}`);
    console.log('='.repeat(50));
    
    if (count > 0) {
      const documents = await collection.find({}).toArray();
      documents.forEach((doc, index) => {
        console.log(`\nDocument ${index + 1}:`);
        console.log(JSON.stringify(doc, null, 2));
        console.log('-'.repeat(30));
      });
    }
    
  } catch (error) {
    console.error('❌ Error viewing collection:', error.message);
  }
}

// Main function
async function main() {
  await connectDB();
  
  const args = process.argv.slice(2);
  
  if (args.length > 0) {
    // View specific collection
    await viewCollection(args[0]);
  } else {
    // View all collections
    await viewDatabase();
  }
  
  await mongoose.disconnect();
  console.log('\n🔌 Disconnected from database');
}

// Run the script
main().catch(console.error);
