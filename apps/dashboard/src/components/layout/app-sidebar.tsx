import { Bird, Menu, PlusCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

import { HistoryList } from './history-list';
import { SettingsMenu } from './settings-menu';

/**
 * Sidebar content with header, history, and footer
 */
export function AppSidebar({
  activeJobId,
  onNewChat,
  onSelectJob,
  onJobDeleted,
}: {
  activeJobId?: string;
  onNewChat?: () => void;
  onSelectJob?: (jobId: string) => void;
  onJobDeleted?: (jobId: string) => void;
}) {
  const { isMobile, setOpenMobile, toggleSidebar } = useSidebar();

  const handleNewChat = () => {
    onNewChat?.();
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="pb-2">
        <div className="flex items-center justify-between px-2 py-1 group-data-[collapsible=icon]:justify-center">
          <div className="flex items-center gap-2 overflow-hidden group-data-[collapsible=icon]:hidden">
            <Bird className="h-[18px] w-[18px] shrink-0 text-primary" />
            <span className="text-sm font-semibold tracking-tight">
              Lyrebird
            </span>
            <Badge variant="positive" className="h-4 px-1.5 py-0 text-[9px]">
              BETA
            </Badge>
          </div>
          <SidebarMenuButton
            size="sm"
            onClick={toggleSidebar}
            className="aspect-square w-8 justify-center rounded-full p-0"
          >
            <Menu className="h-4 w-4" />
          </SidebarMenuButton>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleNewChat}
              className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground rounded-full p-0 transition-colors group-data-[collapsible=icon]:w-9"
            >
              <div className="flex aspect-square w-9 shrink-0 items-center justify-center">
                <PlusCircle className="h-5 w-5" />
              </div>
              <span className="overflow-hidden truncate group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
                New Analysis
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>History</SidebarGroupLabel>
          <SidebarGroupContent>
            <HistoryList
              activeJobId={activeJobId}
              onSelectJob={onSelectJob}
              onJobDeleted={onJobDeleted}
            />
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <Separator className="my-2" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SettingsMenu />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
