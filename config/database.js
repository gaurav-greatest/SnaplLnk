const mongoose = require('mongoose');

/**
 * MongoDB connection with production-ready options.
 *
 * Connection Pool (SDE Highlight):
 * Mongoose maintains a pool of reusable TCP connections, avoiding the overhead
 * of creating a new connection on each request. maxPoolSize controls concurrency.
 */
const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri) {
    throw new Error('MONGO_URI is not defined in environment variables.');
  }

  // Proactively apply Google DNS fallback for MongoDB Atlas (+srv) URIs 
  // to bypass Windows-specific Node.js DNS SRV resolution bugs.
  if (mongoUri.startsWith('mongodb+srv://')) {
    try {
      const dns = require('dns');
      dns.setServers(['8.8.8.8', '8.8.4.4']);
    } catch (dnsErr) {
      console.warn('⚠️  Could not apply Google DNS configuration:', dnsErr.message);
    }
  }

  const connectOptions = {
    maxPoolSize: 10,          // Max concurrent connections in the pool
    serverSelectionTimeoutMS: 5000,  // Fail fast if no server found
    socketTimeoutMS: 45000,   // Close idle sockets after 45s
    family: 4,                // Use IPv4 (avoids dual-stack issues on some hosts)
  };

  let conn;
  try {
    conn = await mongoose.connect(mongoUri, connectOptions);
    console.log(`✅  MongoDB connected: ${conn.connection.host}`);
  } catch (error) {
    throw new Error(`MongoDB connection error: ${error.message}`);
  }

  // Graceful connection event listeners
  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️   MongoDB disconnected. Attempting to reconnect...');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('✅  MongoDB reconnected.');
  });
};

module.exports = connectDB;
