export default function Home() {

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="text-center">
        <h2 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          Monitor Your Utility Bills
        </h2>
        <p className="mt-4 text-lg text-gray-600">
          Track gas, water, electricity, and trash bills across Georgia
        </p>
        <div className="mt-8 flex justify-center gap-4 flex-wrap">
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="text-3xl font-bold text-blue-600">📊</div>
            <h3 className="mt-2 font-semibold">Track Balances</h3>
            <p className="mt-1 text-sm text-gray-600">
              Monitor all your utility bills in one place
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="text-3xl font-bold text-blue-600">🔔</div>
            <h3 className="mt-2 font-semibold">Get Notifications</h3>
            <p className="mt-1 text-sm text-gray-600">
              Receive alerts when bills are due
            </p>
          </div>
          <div className="rounded-lg bg-white p-6 shadow-md">
            <div className="text-3xl font-bold text-blue-600">⏰</div>
            <h3 className="mt-2 font-semibold">Automatic Checks</h3>
            <p className="mt-1 text-sm text-gray-600">
              Scheduled balance checks every 72 hours
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
