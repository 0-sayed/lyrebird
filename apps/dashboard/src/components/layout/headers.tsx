import { Bird, Menu } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { SidebarTrigger } from '@/components/ui/sidebar';

/**
 * Mobile header with menu trigger
 */
export function MobileHeader() {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
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
    </header>
  );
}

/**
 * Desktop header with branding
 */
export function DesktopHeader() {
  return (
    <header className="sticky top-0 z-40 hidden h-14 items-center gap-4 border-b bg-background px-4 md:flex">
      <div className="flex items-center gap-2">
        <Bird className="h-5 w-5 text-primary" />
        <span className="font-semibold">Lyrebird</span>
        <Badge variant="positive" className="text-[10px] mt-1 px-1.5 py-0.5">
          BETA
        </Badge>
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
