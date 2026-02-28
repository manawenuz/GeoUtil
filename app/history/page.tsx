import BalanceDisplay from "@/components/BalanceDisplay";

/**
 * History page
 * 
 * This page displays balance history and trends for all accounts.
 */
export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Balance History</h1>
        <p className="mt-2 text-gray-600">
          View your balance history and payment trends over time
        </p>
      </div>
      
      <BalanceDisplay />
    </div>
  );
}
