import NotificationConfig from "@/components/NotificationConfig";

/**
 * Notifications page
 * 
 * This page displays the notification configuration and history.
 */
export default function NotificationsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <p className="mt-2 text-gray-600">
          Configure your notification settings and view notification history
        </p>
      </div>
      
      <NotificationConfig />
    </div>
  );
}
