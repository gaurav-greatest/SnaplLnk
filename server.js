require('dotenv').config();

const app = require('./app');
const connectDB = require('./config/database');

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';

/**
 * Server Entry Point
 *
 * SDE Highlight:
 * Graceful shutdown ensures in-flight requests complete before the process exits.
 * This is critical for zero-downtime deployments (e.g., rolling restarts on Railway/Render).
 */

let server;

const startServer = async () => {
  // Connect to MongoDB before accepting traffic
  await connectDB();

  server = app.listen(PORT, () => {
    console.log('');
    console.log('┌────────────────────────────────────────┐');
    console.log('│       URL Shortener API  🚀             │');
    console.log('├────────────────────────────────────────┤');
    console.log(`│  Port:   ${PORT}                           │`);
    console.log(`│  Env:    ${NODE_ENV.padEnd(30)}│`);
    console.log(`│  Docs:   http://localhost:${PORT}/api/health │`);
    console.log('└────────────────────────────────────────┘');
    console.log('');
  });

  // Handle unhandled promise rejections (e.g., DB query failures)
  process.on('unhandledRejection', (err) => {
    console.error('🔥  Unhandled Promise Rejection:', err.message);
    gracefulShutdown('UNHANDLED_REJECTION');
  });

  // Handle uncaught exceptions (e.g., coding bugs that slip through)
  process.on('uncaughtException', (err) => {
    console.error('🔥  Uncaught Exception:', err.message);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
  });
};

/**
 * Graceful shutdown sequence:
 *  1. Stop accepting new connections
 *  2. Allow existing requests to finish (30s timeout)
 *  3. Close DB connection
 *  4. Exit process
 */
const gracefulShutdown = (signal) => {
  console.log(`\n⏳  Received ${signal}. Shutting down gracefully...`);

  if (server) {
    server.close(async () => {
      console.log('✅  HTTP server closed.');

      try {
        const mongoose = require('mongoose');
        await mongoose.connection.close();
        console.log('✅  MongoDB connection closed.');
      } catch (err) {
        console.error('❌  Error closing MongoDB connection:', err.message);
      }

      console.log('👋  Process exiting.');
      process.exit(0);
    });

    // Force exit after 30 seconds if server doesn't close cleanly
    setTimeout(() => {
      console.error('⚠️  Forced shutdown after 30s timeout.');
      process.exit(1);
    }, 30000);
  } else {
    process.exit(0);
  }
};

// Graceful shutdown on OS signals (Docker stop, Ctrl+C, deployment restart)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

startServer().catch((err) => {
  console.error('❌  Failed to start server:', err.message);
  process.exit(1);
});
