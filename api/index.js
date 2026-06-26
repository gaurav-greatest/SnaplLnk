const mongoose = require('mongoose');
const app = require('../app');
const connectDB = require('../config/database');

module.exports = async (req, res) => {
  // Ensure we connect to MongoDB if not already connected
  if (mongoose.connection.readyState === 0) {
    await connectDB();
  }
  // Pass control to Express app
  return app(req, res);
};
