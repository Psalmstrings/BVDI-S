const mongoose = require('mongoose');

let mongoMemoryServer = null;

const connectDB = async () => {
  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/bvdi';

  // 1. Attempt connecting to local/remote MongoDB URI
  try {
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
    });
    console.log(`[Database] MongoDB Connected successfully`);
    return;
  } catch (err) {
    console.warn(`[Database] Local MongoDB server not reached at ${mongoUri}. Attempting MongoMemoryServer fallback...`);
  }

  // 2. Fallback to MongoMemoryServer
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    mongoMemoryServer = await MongoMemoryServer.create({
      binary: {
        version: '4.4.29',
      },
    });
    const memoryUri = mongoMemoryServer.getUri();
    const conn = await mongoose.connect(memoryUri);
    console.log(`[Database] MongoMemoryServer connected successfully at ${memoryUri}`);
  } catch (error) {
    console.error(`[Database] Failed to connect to MongoDB: ${error.message}`);
    console.error(`[Database] Please ensure MongoDB service is running locally on mongodb://127.0.0.1:27017/bvdi`);
    process.exit(1);
  }
};

module.exports = connectDB;
