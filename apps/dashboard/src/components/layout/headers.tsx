import { Bird, Menu } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { UserMenu } from '@/components/user-menu';
import { cn } from '@/lib/utils';

interface HeaderProps {
  /** Whether the posts sidebar is currently visible */
  isPostsSidebarVisible?: boolean;
}

/**
 * Mobile header with menu trigger
 */
export function MobileHeader({ isPostsSidebarVisible }: HeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 flex h-14 items-center gap-4 border-b bg-background px-4 transition-[margin] duration-300 md:hidden',
        isPostsSidebarVisible && 'mr-96',
      )}
    >
      <SidebarTrigger>
        <Menu className="h-5 w-5" />
        <span className="sr-only">Toggle menu</span>
      </SidebarTrigger>
      <div className="flex items-center gap-2">
        <Bird className="h-5 w-5 text-primary" />
        <span className="font-semibold">Lyrebird</span>
        <Badge variant="positive" className="text-[10px] mt-1 px-1.5 py-0.5">
          BETA
        </Badge>
      </div>
      <div className="ml-auto">
        <UserMenu />
      </div>
    </header>
  );
}

/**
 * Desktop header keeps account actions visible while branding lives in AppSidebar.
 */
export function DesktopHeader({ isPostsSidebarVisible }: HeaderProps) {
  return (
    <header
      className={cn(
        'sticky top-0 hidden h-14 items-center gap-4 border-b bg-background px-4 transition-[margin] duration-300 md:flex',
        isPostsSidebarVisible && 'mr-96',
      )}
    >
      <div className="ml-auto">
        <UserMenu />
      </div>
    </header>
  );
}

/**
 * Skip link for keyboard navigation
 */
export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-ring"
    >
      Skip to main content
    </a>
  );
}
