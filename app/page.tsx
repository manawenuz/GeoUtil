export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <h2 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-gray-100 sm:text-5xl">
          Monitor Your Utility Bills
        </h2>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Track gas and electricity bills across Georgia
        </p>
        <div className="mt-8 flex justify-center gap-4 flex-wrap">
          <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-md">
            <div className="text-3xl">📊</div>
            <h3 className="mt-2 font-semibold text-gray-900 dark:text-gray-100">Track Balances</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Monitor all your utility bills in one place
            </p>
          </div>
          <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-md">
            <div className="text-3xl">🔔</div>
            <h3 className="mt-2 font-semibold text-gray-900 dark:text-gray-100">Telegram Alerts</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Get notified via Telegram when bills arrive
            </p>
          </div>
          <div className="rounded-lg bg-white dark:bg-gray-800 p-6 shadow-md">
            <div className="text-3xl">⏰</div>
            <h3 className="mt-2 font-semibold text-gray-900 dark:text-gray-100">Smart Scheduling</h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Checks billing cycle automatically from the 15th
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
