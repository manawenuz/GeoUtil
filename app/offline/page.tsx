'use client';

/**
 * Offline page
 * 
 * This page is displayed when the user is offline and tries to navigate
 * to a page that is not cached.
 */
export default function OfflinePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="text-6xl mb-6">📡</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            You&apos;re Offline
          </h1>
          <p className="text-lg text-gray-600 mb-8">
            Please check your internet connection and try again.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    </div>
  );
}
