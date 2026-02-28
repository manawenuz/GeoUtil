"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

/**
 * Balance Display Component
 * 
 * This component displays balance information for utility accounts including:
 * - Current balance per account
 * - Last check timestamp
 * - Overdue day counter with visual indicators
 * - Balance history chart
 * 
 * Requirements: 3.4, 9.4, 10.1, 10.2, 10.3
 */

interface Account {
  accountId: string;
  providerType: "gas" | "water" | "electricity" | "trash";
  providerName: string;
  accountNumber: string;
  enabled: boolean;
  currentBalance: number | null;
  lastChecked: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BalanceHistoryEntry {
  balanceId: string;
  balance: number;
  currency: string;
  timestamp: string;
  success: boolean;
  error?: string;
}

interface BalanceHistory {
  accountId: string;
  days: number;
  count: number;
  history: BalanceHistoryEntry[];
}

const PROVIDER_TYPE_LABELS = {
  gas: "Gas",
  water: "Water",
  electricity: "Electricity",
  trash: "Trash",
};

const PROVIDER_TYPE_ICONS = {
  gas: "🔥",
  water: "💧",
  electricity: "⚡",
  trash: "🗑️",
};

export default function BalanceDisplay() {
  const { data: session, status } = useSession();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [overdueDays, setOverdueDays] = useState<Record<string, number>>({});
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [balanceHistory, setBalanceHistory] = useState<BalanceHistory | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyDays, setHistoryDays] = useState(30);

  // Load accounts
  useEffect(() => {
    if (status === "authenticated") {
      loadAccounts();
    }
  }, [status]);

  // Load balance history when account is selected
  useEffect(() => {
    if (selectedAccountId) {
      loadBalanceHistory(selectedAccountId, historyDays);
    }
  }, [selectedAccountId, historyDays]);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const res = await fetch("/api/accounts");

      if (!res.ok) {
        throw new Error("Failed to load accounts");
      }

      const data = await res.json();
      setAccounts(data.accounts || []);

      // Load overdue days for each account
      const overduePromises = (data.accounts || []).map(async (account: Account) => {
        try {
          const overdueRes = await fetch(`/api/accounts/${account.accountId}/overdue`);
          if (overdueRes.ok) {
            const overdueData = await overdueRes.json();
            return { accountId: account.accountId, days: overdueData.overdueDays || 0 };
          }
        } catch (err) {
          console.error(`Failed to load overdue days for account ${account.accountId}:`, err);
        }
        return { accountId: account.accountId, days: 0 };
      });

      const overdueResults = await Promise.all(overduePromises);
      const overdueMap: Record<string, number> = {};
      overdueResults.forEach(({ accountId, days }) => {
        overdueMap[accountId] = days;
      });
      setOverdueDays(overdueMap);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load accounts");
    } finally {
      setIsLoading(false);
    }
  };

  const loadBalanceHistory = async (accountId: string, days: number) => {
    try {
      setIsLoadingHistory(true);

      const res = await fetch(`/api/balances/history?accountId=${accountId}&days=${days}`);

      if (!res.ok) {
        throw new Error("Failed to load balance history");
      }

      const data = await res.json();
      setBalanceHistory(data);

    } catch (err) {
      console.error("Failed to load balance history:", err);
      setBalanceHistory(null);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const formatBalance = (balance: number | null) => {
    if (balance === null) return "—";
    return `₾${balance.toFixed(2)}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const formatRelativeTime = (dateString: string | null) => {
    if (!dateString) return "Never";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  };

  const getOverdueStatus = (days: number) => {
    if (days === 0) return { label: "Current", color: "text-green-700 bg-green-50 border-green-200", icon: "✓" };
    if (days <= 7) return { label: `${days} day${days !== 1 ? 's' : ''} overdue`, color: "text-yellow-700 bg-yellow-50 border-yellow-200", icon: "⚠" };
    if (days <= 14) return { label: `${days} days overdue`, color: "text-orange-700 bg-orange-50 border-orange-200", icon: "⚠⚠" };
    return { label: `${days} days overdue`, color: "text-red-700 bg-red-50 border-red-200", icon: "🚨" };
  };

  const handleViewHistory = (accountId: string) => {
    setSelectedAccountId(accountId === selectedAccountId ? null : accountId);
  };

  const renderBalanceChart = (history: BalanceHistoryEntry[]) => {
    if (history.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          No balance history available
        </div>
      );
    }

    // Sort by timestamp ascending for chart
    const sortedHistory = [...history].sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate chart dimensions
    const maxBalance = Math.max(...sortedHistory.map(h => h.balance), 1);
    const chartHeight = 200;
    const chartWidth = 100; // percentage

    // Generate SVG path for line chart
    const points = sortedHistory.map((entry, index) => {
      const x = (index / (sortedHistory.length - 1)) * chartWidth;
      const y = chartHeight - (entry.balance / maxBalance) * (chartHeight - 20);
      return `${x},${y}`;
    });

    const pathData = `M ${points.join(' L ')}`;

    return (
      <div className="space-y-4">
        {/* Chart */}
        <div className="relative" style={{ height: `${chartHeight}px` }}>
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            preserveAspectRatio="none"
            className="w-full h-full"
          >
            {/* Grid lines */}
            <line x1="0" y1={chartHeight - 20} x2={chartWidth} y2={chartHeight - 20} stroke="#e5e7eb" strokeWidth="0.5" />
            <line x1="0" y1={chartHeight / 2} x2={chartWidth} y2={chartHeight / 2} stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2,2" />
            <line x1="0" y1="20" x2={chartWidth} y2="20" stroke="#e5e7eb" strokeWidth="0.5" strokeDasharray="2,2" />
            
            {/* Area under the line */}
            <path
              d={`${pathData} L ${chartWidth},${chartHeight - 20} L 0,${chartHeight - 20} Z`}
              fill="url(#gradient)"
              opacity="0.3"
            />
            
            {/* Line */}
            <path
              d={pathData}
              fill="none"
              stroke="#2563eb"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            
            {/* Data points */}
            {sortedHistory.map((entry, index) => {
              const x = (index / (sortedHistory.length - 1)) * chartWidth;
              const y = chartHeight - (entry.balance / maxBalance) * (chartHeight - 20);
              return (
                <circle
                  key={entry.balanceId}
                  cx={x}
                  cy={y}
                  r="2"
                  fill="#2563eb"
                  className="hover:r-3 transition-all"
                >
                  <title>{`${formatBalance(entry.balance)} on ${formatDate(entry.timestamp)}`}</title>
                </circle>
              );
            })}
            
            {/* Gradient definition */}
            <defs>
              <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#2563eb" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#2563eb" stopOpacity="0.1" />
              </linearGradient>
            </defs>
          </svg>
          
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 pr-2">
            <span>{formatBalance(maxBalance)}</span>
            <span>{formatBalance(maxBalance / 2)}</span>
            <span>₾0.00</span>
          </div>
        </div>

        {/* History table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Balance</th>
                <th className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedHistory.reverse().map((entry) => (
                <tr key={entry.balanceId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-900">
                    {formatDate(entry.timestamp)}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-900 text-right font-mono">
                    {formatBalance(entry.balance)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    {entry.success ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Success
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ✗ Failed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (status === "loading" || isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="rounded-lg bg-yellow-50 p-4 text-yellow-800">
        Please sign in to view your balances.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Balance Overview</h2>
        <p className="mt-1 text-sm text-gray-500">
          Monitor your utility account balances and payment status
        </p>
      </div>

      {/* Error message */}
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-800">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth="1.5"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
              />
            </svg>
            {error}
          </div>
        </div>
      )}

      {/* Accounts List */}
      {accounts.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No accounts</h3>
          <p className="mt-1 text-sm text-gray-500">
            Add utility accounts to start monitoring your balances.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {accounts.map((account) => {
            const accountOverdueDays = overdueDays[account.accountId] || 0;
            const overdueStatus = getOverdueStatus(accountOverdueDays);
            const isExpanded = selectedAccountId === account.accountId;

            return (
              <div
                key={account.accountId}
                className="rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden"
              >
                {/* Account Summary */}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="text-3xl">
                        {PROVIDER_TYPE_ICONS[account.providerType]}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">
                          {account.providerName}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {PROVIDER_TYPE_LABELS[account.providerType]} • {account.accountNumber}
                        </p>
                      </div>
                    </div>
                    
                    {/* Overdue indicator */}
                    {account.currentBalance !== null && account.currentBalance > 0 && (
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium border ${overdueStatus.color}`}>
                        <span>{overdueStatus.icon}</span>
                        <span>{overdueStatus.label}</span>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Current Balance */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Current Balance</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {formatBalance(account.currentBalance)}
                      </p>
                    </div>

                    {/* Last Checked */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Last Checked</p>
                      <p className="text-sm text-gray-700">
                        {formatRelativeTime(account.lastChecked)}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(account.lastChecked)}
                      </p>
                    </div>

                    {/* Overdue Days */}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Payment Status</p>
                      {account.currentBalance === null || account.currentBalance === 0 ? (
                        <p className="text-sm text-green-700 font-medium">No balance due</p>
                      ) : accountOverdueDays === 0 ? (
                        <p className="text-sm text-yellow-700 font-medium">Payment due</p>
                      ) : (
                        <p className="text-sm text-red-700 font-medium">
                          {accountOverdueDays} day{accountOverdueDays !== 1 ? 's' : ''} overdue
                        </p>
                      )}
                    </div>
                  </div>

                  {/* View History Button */}
                  <div className="mt-4 pt-4 border-t border-gray-100">
                    <button
                      onClick={() => handleViewHistory(account.accountId)}
                      className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-500 transition-colors"
                    >
                      <svg
                        className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth="1.5"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M8.25 4.5l7.5 7.5-7.5 7.5"
                        />
                      </svg>
                      {isExpanded ? "Hide" : "View"} Balance History
                    </button>
                  </div>
                </div>

                {/* Balance History Section */}
                {isExpanded && (
                  <div className="border-t border-gray-200 bg-gray-50 p-6">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-lg font-semibold text-gray-900">Balance History</h4>
                      <select
                        value={historyDays}
                        onChange={(e) => setHistoryDays(Number(e.target.value))}
                        className="rounded-md border border-gray-300 px-3 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      >
                        <option value={7}>Last 7 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={90}>Last 90 days</option>
                        <option value={180}>Last 6 months</option>
                        <option value={365}>Last year</option>
                      </select>
                    </div>

                    {isLoadingHistory ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="h-6 w-6 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
                      </div>
                    ) : balanceHistory ? (
                      renderBalanceChart(balanceHistory.history)
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        Failed to load balance history
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
