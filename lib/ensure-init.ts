/**
 * Ensure App Initialization
 * 
 * Helper to ensure the app is initialized before handling API requests.
 * This is safe to use in API routes (Node.js runtime) but NOT in middleware (Edge runtime).
 */

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Ensure the application is initialized
 * 
 * This function is idempotent - it will only initialize once.
 * Subsequent calls will wait for the initial initialization to complete.
 * 
 * Safe to call from:
 * - API routes (Node.js runtime)
 * - Server components
 * - Server actions
 * 
 * DO NOT call from:
 * - Middleware (Edge runtime)
 * - Client components
 */
export async function ensureInitialized(): Promise<void> {
  if (initialized) {
    return;
  }

  // If initialization is in progress, wait for it
  if (initPromise) {
    await initPromise;
    return;
  }

  // Start initialization
  initPromise = (async () => {
    try {
      const { initializeApp } = await import('./init');
      
      await initializeApp({
        runMigrations: true,
        autoApproveMigrations: process.env.NODE_ENV === 'development',
        startScheduler: process.env.NODE_ENV !== 'production', // Only in dev/local
      });
      
      initialized = true;
    } catch (error) {
      console.error('Failed to initialize app:', error);
      initPromise = null; // Allow retry on next call
      throw error;
    }
  })();

  await initPromise;
}
