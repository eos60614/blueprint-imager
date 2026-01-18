'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavTab {
  name: string;
  href: string;
  isActive: (pathname: string) => boolean;
}

const tabs: NavTab[] = [
  {
    name: 'Upload',
    href: '/',
    isActive: (pathname) => pathname === '/',
  },
  {
    name: 'Browse',
    href: '/browse',
    isActive: (pathname) => pathname.startsWith('/browse'),
  },
  {
    name: 'History',
    href: '/history',
    isActive: (pathname) => pathname.startsWith('/history'),
  },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo/Brand */}
          <Link
            href="/"
            className="flex items-center space-x-2 text-gray-900 hover:text-blue-600 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span className="font-semibold text-sm sm:text-base">
              Blueprint Imager
            </span>
          </Link>

          {/* Navigation Tabs */}
          <div className="flex space-x-1 sm:space-x-2">
            {tabs.map((tab) => {
              const isActive = tab.isActive(pathname);
              return (
                <Link
                  key={tab.name}
                  href={tab.href}
                  className={`
                    px-3 py-2 rounded-md text-sm font-medium transition-colors
                    ${
                      isActive
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }
                  `}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {tab.name}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
