"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";

/**
 * Account Management Component
 * 
 * This component manages utility account configurations for authenticated users.
 * It provides functionality to add, edit, delete, and display utility accounts
 * with their current balances.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
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

interface Provider {
  providerName: string;
  providerType: "gas" | "water" | "electricity" | "trash";
  supportedRegions: string[];
  accountNumberFormat: string;
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

export default function AccountManagement() {
  const { data: session, status } = useSession();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Form state
  const [isAddingAccount, setIsAddingAccount] = useState(false);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    providerType: "gas" as "gas" | "water" | "electricity" | "trash",
    providerName: "",
    accountNumber: "",
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load accounts and providers
  useEffect(() => {
    if (status === "authenticated") {
      loadData();
    }
  }, [status]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Load accounts and providers in parallel
      const [accountsRes, providersRes] = await Promise.all([
        fetch("/api/accounts"),
        fetch("/api/providers"),
      ]);

      if (!accountsRes.ok) {
        throw new Error("Failed to load accounts");
      }

      const accountsData = await accountsRes.json();
      setAccounts(accountsData.accounts || []);

      // Providers endpoint might not exist yet, handle gracefully
      if (providersRes.ok) {
        const providersData = await providersRes.json();
        setProviders(providersData.providers || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAccount = () => {
    setIsAddingAccount(true);
    setEditingAccountId(null);
    setFormData({
      providerType: "gas",
      providerName: "",
      accountNumber: "",
    });
    setFormError(null);
  };

  const handleEditAccount = (account: Account) => {
    setIsAddingAccount(false);
    setEditingAccountId(account.accountId);
    setFormData({
      providerType: account.providerType,
      providerName: account.providerName,
      accountNumber: account.accountNumber,
    });
    setFormError(null);
  };

  const handleCancelForm = () => {
    setIsAddingAccount(false);
    setEditingAccountId(null);
    setFormData({
      providerType: "gas",
      providerName: "",
      accountNumber: "",
    });
    setFormError(null);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      // Validate form
      if (!formData.providerName || !formData.accountNumber) {
        throw new Error("Please fill in all fields");
      }

      if (editingAccountId) {
        // Update existing account
        const res = await fetch(`/api/accounts/${editingAccountId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Failed to update account");
        }
      } else {
        // Create new account
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });

        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Failed to create account");
        }
      }

      // Reload accounts and reset form
      await loadData();
      handleCancelForm();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm("Are you sure you want to delete this account?")) {
      return;
    }

    try {
      const res = await fetch(`/api/accounts/${accountId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to delete account");
      }

      // Reload accounts
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account");
    }
  };

  const getProvidersByType = (type: string) => {
    return providers.filter((p) => p.providerType === type);
  };

  const getSelectedProvider = () => {
    return providers.find((p) => p.providerName === formData.providerName);
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
        Please sign in to manage your accounts.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Utility Accounts</h2>
          <p className="mt-1 text-sm text-gray-500">
            Manage your utility provider accounts and monitor balances
          </p>
        </div>
        {!isAddingAccount && !editingAccountId && (
          <button
            onClick={handleAddAccount}
            className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors"
          >
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
                d="M12 4.5v15m7.5-7.5h-15"
              />
            </svg>
            Add Account
          </button>
        )}
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

      {/* Add/Edit Form */}
      {(isAddingAccount || editingAccountId) && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingAccountId ? "Edit Account" : "Add New Account"}
          </h3>

          <form onSubmit={handleSubmitForm} className="space-y-4">
            {/* Provider Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider Type
              </label>
              <select
                value={formData.providerType}
                onChange={(e) => {
                  setFormData({
                    ...formData,
                    providerType: e.target.value as any,
                    providerName: "",
                  });
                }}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isSubmitting}
              >
                {Object.entries(PROVIDER_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {PROVIDER_TYPE_ICONS[value as keyof typeof PROVIDER_TYPE_ICONS]} {label}
                  </option>
                ))}
              </select>
            </div>

            {/* Provider Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Provider
              </label>
              <select
                value={formData.providerName}
                onChange={(e) =>
                  setFormData({ ...formData, providerName: e.target.value })
                }
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                disabled={isSubmitting}
                required
              >
                <option value="">Select a provider...</option>
                {getProvidersByType(formData.providerType).map((provider) => (
                  <option key={provider.providerName} value={provider.providerName}>
                    {provider.providerName}
                  </option>
                ))}
              </select>
            </div>

            {/* Account Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Account Number
              </label>
              <input
                type="text"
                value={formData.accountNumber}
                onChange={(e) =>
                  setFormData({ ...formData, accountNumber: e.target.value })
                }
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Enter account number"
                disabled={isSubmitting}
                required
              />
              {getSelectedProvider() && (
                <p className="mt-1 text-sm text-gray-500">
                  Format: {getSelectedProvider()?.accountNumberFormat}
                </p>
              )}
            </div>

            {/* Form Error */}
            {formError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
                {formError}
              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <svg
                      className="h-4 w-4 animate-spin"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    {editingAccountId ? "Updating..." : "Adding..."}
                  </>
                ) : (
                  <>{editingAccountId ? "Update Account" : "Add Account"}</>
                )}
              </button>
              <button
                type="button"
                onClick={handleCancelForm}
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-md bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>
          </form>
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
              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-semibold text-gray-900">No accounts</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding your first utility account.
          </p>
          {!isAddingAccount && (
            <button
              onClick={handleAddAccount}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 transition-colors"
            >
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
                  d="M12 4.5v15m7.5-7.5h-15"
                />
              </svg>
              Add Account
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <div
              key={account.accountId}
              className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Account Header */}
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
                      {PROVIDER_TYPE_LABELS[account.providerType]}
                    </p>
                  </div>
                </div>
              </div>

              {/* Account Details */}
              <div className="space-y-3 mb-4">
                <div>
                  <p className="text-xs text-gray-500 mb-1">Account Number</p>
                  <p className="font-mono text-sm text-gray-900">
                    {account.accountNumber}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1">Current Balance</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatBalance(account.currentBalance)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1">Last Checked</p>
                  <p className="text-sm text-gray-700">
                    {formatDate(account.lastChecked)}
                  </p>
                </div>
              </div>

              {/* Account Actions */}
              <div className="flex gap-2 pt-4 border-t border-gray-100">
                <button
                  onClick={() => handleEditAccount(account)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50 transition-colors"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                    />
                  </svg>
                  Edit
                </button>
                <button
                  onClick={() => handleDeleteAccount(account.accountId)}
                  className="inline-flex items-center justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-red-600 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-red-50 transition-colors"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="1.5"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                    />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
