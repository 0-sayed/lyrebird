import { Menu, PlusCircle } from 'lucide-react';

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
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="default"
              onClick={toggleSidebar}
              className="aspect-square w-9 justify-center rounded-full p-0"
            >
              <Menu className="h-7 w-7" />
            </SidebarMenuButton>
          </SidebarMenuItem>
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
