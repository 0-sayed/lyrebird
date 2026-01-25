import * as React from 'react';

import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';

import { AppSidebar } from './app-sidebar';
import { DesktopHeader, MobileHeader, SkipLink } from './headers';

// =============================================================================
// Types
// =============================================================================

interface RootLayoutProps {
  children: React.ReactNode;
  activeJobId?: string;
  /** Initial sidebar open state from cookie. Defaults to true. */
  initialSidebarOpen?: boolean;
  onNewChat?: () => void;
  onSelectJob?: (jobId: string) => void;
  onJobDeleted?: (jobId: string) => void;
}

// =============================================================================
// Main Layout
// =============================================================================

/**
 * Root layout component with responsive sidebar
 *
 * Features:
 * - Collapsible sidebar on desktop
 * - Sheet-based sidebar on mobile
 * - Theme toggle
 * - Job history navigation
 * - New analysis button
 * - Skip link for accessibility
 * - Persists sidebar state to cookie (handled by SidebarProvider)
 */
export function RootLayout({
  children,
  activeJobId,
  initialSidebarOpen = true,
  onNewChat,
  onSelectJob,
  onJobDeleted,
}: RootLayoutProps) {
  return (
    <SidebarProvider defaultOpen={initialSidebarOpen}>
      <SkipLink />
      <div className="flex min-h-screen w-full">
        <AppSidebar
          activeJobId={activeJobId}
          onNewChat={onNewChat}
          onSelectJob={onSelectJob}
          onJobDeleted={onJobDeleted}
        />
        <SidebarInset>
          <MobileHeader />
          <DesktopHeader />
          <main
            className="flex flex-1 flex-col"
            id="main-content"
            tabIndex={-1}
          >
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
