const mongoose = require('mongoose');
const app = require('../app');
const connectDB = require('../config/database');

module.exports = async (req, res) => {
  try {
    // Ensure we connect to MongoDB if not already connected
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }
    // Pass control to Express app
    return app(req, res);
  } catch (error) {
    console.error('❌ Database connection failed in serverless function:', error.message);
    res.status(500).json({
      success: false,
      error: 'Database connection failed. Please verify that MONGO_URI is set correctly in Vercel Environment Variables and that access from anywhere (0.0.0.0/0) is allowed in your MongoDB Atlas Network Access settings.',
      details: error.message
    });
  }
};
