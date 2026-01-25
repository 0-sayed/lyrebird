import * as React from 'react';
import { Wifi, WifiOff, Loader2, AlertCircle } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ConnectionStatus as ConnectionStatusType } from '@/hooks';

// =============================================================================
// Types
// =============================================================================

interface ConnectionStatusProps {
  /** Current connection status */
  status: ConnectionStatusType;
  /** Last heartbeat timestamp */
  lastHeartbeat?: Date | null;
  /** Number of reconnection attempts */
  reconnectAttempts?: number;
  /** Additional class names */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

const statusConfig: Record<
  ConnectionStatusType,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    variant: 'default' | 'secondary' | 'destructive' | 'outline';
    animate?: boolean;
  }
> = {
  connecting: {
    icon: Loader2,
    label: 'Connecting...',
    variant: 'secondary',
    animate: true,
  },
  connected: {
    icon: Wifi,
    label: 'Connected',
    variant: 'default',
  },
  disconnected: {
    icon: WifiOff,
    label: 'Disconnected',
    variant: 'outline',
  },
  error: {
    icon: AlertCircle,
    label: 'Connection Error',
    variant: 'destructive',
  },
};

/**
 * Connection status indicator for SSE connections
 *
 * Features:
 * - Visual indicator for connection state
 * - Tooltip with last heartbeat and reconnect info
 * - Animated icon for connecting state
 */
export function ConnectionStatus({
  status,
  lastHeartbeat,
  reconnectAttempts = 0,
  className,
}: ConnectionStatusProps) {
  const config = statusConfig[status];
  const Icon = config.icon;

  const tooltipContent = React.useMemo(() => {
    const parts: string[] = [config.label];

    if (lastHeartbeat) {
      parts.push(`Last update: ${lastHeartbeat.toLocaleTimeString()}`);
    }

    if (status === 'error' && reconnectAttempts > 0) {
      parts.push(`Reconnect attempts: ${reconnectAttempts}`);
    }

    return parts.join('\n');
  }, [config.label, lastHeartbeat, reconnectAttempts, status]);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant={config.variant}
            className={cn('gap-1.5 px-2 py-0.5', className)}
            role="status"
            aria-live="polite"
            aria-label={`Connection status: ${config.label}`}
          >
            <Icon
              className={cn('h-3 w-3', config.animate && 'animate-spin')}
              aria-hidden="true"
            />
            <span className="text-xs">{config.label}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent>
          <p className="whitespace-pre-line text-xs">{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
