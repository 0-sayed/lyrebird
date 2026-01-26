import * as React from 'react';
import { MoreHorizontal, RefreshCw, Star, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { useJobs, useDeleteJob } from '@/hooks';
import { cn } from '@/lib/utils';
import type { JobResponse, JobStatus } from '@/types/api';

// =============================================================================
// Types
// =============================================================================

interface HistoryItemProps {
  job: JobResponse;
  isActive: boolean;
  onSelect: (jobId: string) => void;
  onDelete: (jobId: string) => void;
}

// =============================================================================
// Subcomponents
// =============================================================================

/**
 * Status indicator for job status
 */
export function StatusIndicator({ status }: { status: JobStatus }) {
  const statusStyles: Record<JobStatus, string> = {
    pending: 'bg-yellow-500',
    in_progress: 'bg-blue-500 animate-pulse',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
  };

  return (
    <span
      className={cn('h-2 w-2 rounded-full', statusStyles[status])}
      title={status.replace('_', ' ')}
    />
  );
}

/**
 * Individual history item in the sidebar
 */
export function HistoryItem({
  job,
  isActive,
  onSelect,
  onDelete,
}: HistoryItemProps) {
  const {
    isMobile,
    setOpenMobile,
    isHoverTemporary,
    setIsHoverTemporary,
    setOpen,
  } = useSidebar();
  const [dropdownOpen, setDropdownOpen] = React.useState(false);
  const wasHoverTemporaryRef = React.useRef(false);
  const dropdownCloseTimerRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);

  // Cleanup timer on unmount
  React.useEffect(() => {
    return () => {
      if (dropdownCloseTimerRef.current) {
        clearTimeout(dropdownCloseTimerRef.current);
      }
    };
  }, []);

  const handleSelect = () => {
    onSelect(job.jobId);
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(job.jobId);
  };

  // Handle dropdown open/close to manage sidebar behavior
  const handleDropdownOpenChange = (open: boolean) => {
    setDropdownOpen(open);

    // Clear any pending close timer when state changes
    if (dropdownCloseTimerRef.current) {
      clearTimeout(dropdownCloseTimerRef.current);
      dropdownCloseTimerRef.current = null;
    }

    if (open) {
      // Dropdown is opening - save current hover state and prevent sidebar from closing
      wasHoverTemporaryRef.current = isHoverTemporary;
      if (isHoverTemporary) {
        // Make the sidebar "permanently" open while dropdown is active
        setIsHoverTemporary(false);
      }
    } else {
      // Dropdown is closing - restore hover behavior with a delay
      if (wasHoverTemporaryRef.current) {
        // Delay sidebar collapse to allow dropdown closing animation to complete
        dropdownCloseTimerRef.current = setTimeout(() => {
          setIsHoverTemporary(false);
          setOpen(false);
          wasHoverTemporaryRef.current = false;
          dropdownCloseTimerRef.current = null;
        }, 200); // Match typical dropdown animation duration
      }
    }
  };

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        onClick={handleSelect}
        tooltip={job.prompt}
        className="p-4"
      >
        <StatusIndicator status={job.status} />
        <span className="truncate min-w-0">{job.prompt}</span>
      </SidebarMenuButton>
      <DropdownMenu
        modal={false}
        open={dropdownOpen}
        onOpenChange={handleDropdownOpenChange}
      >
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover className="flex items-center">
            <MoreHorizontal className="h-3 w-3" />
            <span className="sr-only">More options</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="right"
          align="start"
          sideOffset={4}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DropdownMenuItem className="gap-2">
            <Star className="h-4 w-4" />
            <span>Favorite</span>
          </DropdownMenuItem>
          <DropdownMenuItem className="gap-2" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 text-red-500" />
            <span className="text-red-500">Delete</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  );
}

/**
 * History list showing all past jobs
 */
export function HistoryList({
  activeJobId,
  onSelectJob,
  onJobDeleted,
}: {
  activeJobId?: string;
  onSelectJob?: (jobId: string) => void;
  onJobDeleted?: (jobId: string) => void;
}) {
  const { data, isLoading, error, refetch } = useJobs({ limit: 50 });
  const deleteJob = useDeleteJob();

  const handleDelete = (jobId: string) => {
    deleteJob.mutate(jobId, {
      onSuccess: () => {
        // Only notify parent to clear active job AFTER delete succeeds
        if (jobId === activeJobId) {
          onJobDeleted?.(jobId);
        }
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-2 p-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-sm text-muted-foreground space-y-3">
        <p>Failed to load history</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          className="w-full"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data?.jobs.length) {
    return (
      <div className="p-4 text-sm text-muted-foreground text-center">
        No analysis history yet.
        <br />
        Start a new analysis to see it here.
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <SidebarMenu>
        {data.jobs.map((job) => (
          <HistoryItem
            key={job.jobId}
            job={job}
            isActive={job.jobId === activeJobId}
            onSelect={onSelectJob ?? (() => {})}
            onDelete={handleDelete}
          />
        ))}
      </SidebarMenu>
    </ScrollArea>
  );
}
