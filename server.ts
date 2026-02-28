/**
 * Standalone Server for Local/VPS Deployment
 * 
 * This file is used when running the app outside of Vercel.
 * It initializes the application and starts the Next.js server.
 * 
 * Usage:
 *   npm run build
 *   node server.js
 */

import { initializeApp, setupShutdownHandlers } from './lib/init';

async function startServer() {
  try {
    // Initialize the application
    await initializeApp({
      runMigrations: true,
      autoApproveMigrations: process.env.NODE_ENV === 'development',
      startScheduler: true,
    });

    // Setup graceful shutdown handlers
    setupShutdownHandlers();

    console.log('Server is ready to accept requests');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
