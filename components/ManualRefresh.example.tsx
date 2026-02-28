/**
 * ManualRefresh Component - Usage Examples
 * 
 * This file demonstrates how to use the ManualRefresh component
 * in different scenarios.
 */

import ManualRefresh from "./ManualRefresh";

/**
 * Example 1: Basic usage with a single account
 */
export function BasicExample() {
  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-2">Gas Account</h3>
      <ManualRefresh 
        accountId="account-123" 
        accountName="te.ge Gas"
      />
    </div>
  );
}

/**
 * Example 2: With callback to refresh parent data
 */
export function WithCallbackExample() {
  const handleRefreshComplete = () => {
    console.log("Balance check completed, refreshing account list...");
    // Reload accounts or update state
  };

  return (
    <div className="p-4">
      <h3 className="text-lg font-semibold mb-2">Water Account</h3>
      <ManualRefresh 
        accountId="account-456" 
        accountName="Tbilisi Water"
        onRefreshComplete={handleRefreshComplete}
      />
    </div>
  );
}

/**
 * Example 3: Multiple accounts in a list
 */
export function MultipleAccountsExample() {
  const accounts = [
    { id: "acc-1", name: "te.ge Gas", type: "gas" },
    { id: "acc-2", name: "Tbilisi Water", type: "water" },
    { id: "acc-3", name: "Telasi Electricity", type: "electricity" },
  ];

  const handleRefresh = () => {
    // Reload all accounts data
    console.log("Refreshing all accounts...");
  };

  return (
    <div className="space-y-4 p-4">
      {accounts.map((account) => (
        <div key={account.id} className="border rounded-lg p-4">
          <h3 className="text-lg font-semibold mb-2">
            {account.name} ({account.type})
          </h3>
          <ManualRefresh 
            accountId={account.id} 
            accountName={account.name}
            onRefreshComplete={handleRefresh}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Example 4: Integrated with account card
 */
export function AccountCardExample() {
  return (
    <div className="border rounded-lg p-6 bg-white shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">te.ge Gas</h3>
          <p className="text-sm text-gray-500">Account: 123456789012</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">₾45.50</p>
          <p className="text-xs text-gray-500">Last checked: 2 hours ago</p>
        </div>
      </div>
      
      <div className="pt-4 border-t">
        <ManualRefresh 
          accountId="account-789" 
          accountName="te.ge Gas"
          onRefreshComplete={() => {
            // Update the balance display above
            console.log("Updating balance display...");
          }}
        />
      </div>
    </div>
  );
}

/**
 * Example 5: With custom styling wrapper
 */
export function CustomStyledExample() {
  return (
    <div className="max-w-md mx-auto p-6 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
      <div className="mb-4">
        <h2 className="text-2xl font-bold text-gray-900">Quick Balance Check</h2>
        <p className="text-sm text-gray-600 mt-1">
          Check your current utility balance instantly
        </p>
      </div>
      
      <ManualRefresh 
        accountId="account-999" 
        accountName="My Utility Account"
      />
    </div>
  );
}
