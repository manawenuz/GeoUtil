import ConfigImportExport from "@/components/ConfigImportExport";

/**
 * Settings page
 * 
 * This page displays application settings and configuration options.
 */
export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your application settings and configuration
        </p>
      </div>
      
      <div className="space-y-8">
        {/* Configuration Import/Export */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Configuration Management
          </h2>
          <ConfigImportExport />
        </section>

        {/* Additional settings sections can be added here */}
        <section className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">
            Application Information
          </h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>
              <strong>Version:</strong> 1.0.0
            </p>
            <p>
              <strong>Environment:</strong> {process.env.NODE_ENV}
            </p>
            <p>
              <strong>Storage Backend:</strong> {process.env.STORAGE_BACKEND || 'Not configured'}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
