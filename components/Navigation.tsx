'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HomeIcon, 
  UserGroupIcon, 
  BellIcon, 
  ClockIcon, 
  Cog6ToothIcon 
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Home', href: '/', icon: HomeIcon },
  { name: 'Accounts', href: '/accounts', icon: UserGroupIcon },
  { name: 'Notifications', href: '/notifications', icon: BellIcon },
  { name: 'History', href: '/history', icon: ClockIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="border-t border-gray-200 dark:border-gray-700">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Desktop navigation */}
        <div className="hidden sm:flex sm:space-x-8">
          {navigation.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`inline-flex items-center border-b-2 px-1 py-4 text-sm font-medium ${
                  isActive
                    ? 'border-blue-500 text-gray-900 dark:text-gray-100'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:border-gray-300 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <item.icon className="mr-2 h-5 w-5" aria-hidden="true" />
                {item.name}
              </Link>
            );
          })}
        </div>

        {/* Mobile navigation */}
        <div className="sm:hidden">
          <div className="flex overflow-x-auto space-x-4 py-2">
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex flex-col items-center min-w-[60px] px-2 py-2 text-xs font-medium rounded-lg ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200'
                  }`}
                >
                  <item.icon className="h-6 w-6 mb-1" aria-hidden="true" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
