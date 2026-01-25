import { ConnectionStatus } from '@/components/common';
import type { ConnectionStatus as ConnectionStatusType } from '@/hooks';

// =============================================================================
// Types
// =============================================================================

export interface SSEConnectionBarProps {
  /** Current connection status */
  status: ConnectionStatusType;
  /** Last heartbeat timestamp (milliseconds since epoch) */
  lastHeartbeat: number | null;
  /** Number of reconnect attempts */
  reconnectAttempts: number;
}

// =============================================================================
// Component
// =============================================================================

/**
 * Sticky header bar showing SSE connection status
 *
 * Features:
 * - Sticky positioning at top of viewport
 * - Blurred background effect
 * - Displays connection status indicator
 */
export function SSEConnectionBar({
  status,
  lastHeartbeat,
  reconnectAttempts,
}: SSEConnectionBarProps) {
  // Convert timestamp to Date for ConnectionStatus component
  const lastHeartbeatDate = lastHeartbeat ? new Date(lastHeartbeat) : null;

  return (
    <div className="sticky top-0 z-20 flex justify-end border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <ConnectionStatus
        status={status}
        lastHeartbeat={lastHeartbeatDate}
        reconnectAttempts={reconnectAttempts}
      />
    </div>
  );
}
