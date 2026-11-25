'use client';

import { useState } from 'react';
import Sidebar from './Sidebar.jsx';
import Header from './Header.jsx';
import MainContent from './MainContent.jsx';
import { ToastProvider } from '../ui/ToastProvider.jsx';

export default function DashboardLayout({
  user,
  notifications = [],
  unreadNotificationCount = 0,
  children,
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ToastProvider>
      <a href="#main-content" className="visually-hidden supplify-skip-link">
        Lewati ke konten utama
      </a>
      <div className="min-h-screen flex bg-[#F4F5F8]">
        <Sidebar
          role={user.role}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 flex flex-col min-w-0">
          <Header
            user={user}
            notifications={notifications}
            unreadNotificationCount={unreadNotificationCount}
            onOpenMenu={() => setSidebarOpen(true)}
          />
          <MainContent>{children}</MainContent>
        </div>
      </div>
    </ToastProvider>
  );
}
