const mongoose = require('mongoose');

const connectDB = async (retries = 3) => {
  while (retries > 0) {
    try {
      const conn = await mongoose.connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 30000, // 30s timeout for cloud cold starts
        connectTimeoutMS: 30000,
      });
      console.log(`✅ MongoDB connected: ${conn.connection.host}`);
      return conn;
    } catch (error) {
      retries -= 1;
      console.error(`❌ MongoDB connection error: ${error.message}`);
      if (retries === 0) throw error;
      console.log(`⏳ Retrying MongoDB connection in 5s... (${retries} attempts left)`);
      await new Promise((res) => setTimeout(res, 5000));
    }
  }
};

module.exports = connectDB;
