import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { API_BASE_URL, queryKeys, SSE_CONFIG } from '@/lib/constants';
import {
  JobStatus,
  SSE_MESSAGE_TYPES,
  type SSEEvent,
  type SSECompletedEvent,
  type SSEDataUpdateEvent,
  type SSEFailedEvent,
} from '@/types/api';

// =============================================================================
// Types
// =============================================================================

type SSEMessageType =
  (typeof SSE_MESSAGE_TYPES)[keyof typeof SSE_MESSAGE_TYPES];

/**
 * Type-safe SSE event parser
 * Validates that the event type is known and constructs a properly typed event
 */
function parseSSEEvent(eventType: string, rawData: unknown): SSEEvent | null {
  // Validate the event type is one we expect
  const validTypes = Object.values(SSE_MESSAGE_TYPES) as string[];
  if (!validTypes.includes(eventType)) {
    if (import.meta.env.DEV) {
      console.warn(`Unknown SSE event type: ${eventType}`);
    }
    return null;
  }

  // The event type is now known to be a valid SSEMessageType
  // TypeScript's type system guarantees the structure based on the discriminator
  return {
    type: eventType as SSEMessageType,
    data: rawData,
  } as SSEEvent;
}

export type ConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

interface UseJobSSEOptions {
  /** Called when the job completes successfully */
  onComplete?: (data: SSECompletedEvent['data']) => void;
  /** Called when the job fails */
  onFailed?: (data: SSEFailedEvent['data']) => void;
  /** Called on any status change */
  onStatusChange?: (status: JobStatus) => void;
  /** Called when a new data point is received (real-time chart updates) */
  onDataUpdate?: (data: SSEDataUpdateEvent['data']) => void;
  /** Whether the SSE connection should be active */
  enabled?: boolean;
}

interface UseJobSSEResult {
  /** Current connection status */
  connectionStatus: ConnectionStatus;
  /** Current job status from SSE events */
  jobStatus: JobStatus | null;
  /** Last heartbeat timestamp */
  lastHeartbeat: Date | null;
  /** Manually close the connection */
  disconnect: () => void;
  /** Manually reconnect */
  reconnect: () => void;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
}

// =============================================================================
// Hook Implementation
// =============================================================================

/**
 * Hook for subscribing to real-time job status updates via SSE
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Query cache invalidation on status changes
 * - Heartbeat monitoring
 * - Clean disconnection on unmount or job completion
 */
export function useJobSSE(
  jobId: string | undefined,
  options: UseJobSSEOptions = {},
): UseJobSSEResult {
  const {
    onComplete,
    onFailed,
    onStatusChange,
    onDataUpdate,
    enabled = true,
  } = options;

  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  // Store event handlers for proper cleanup on disconnect
  const eventHandlersRef = useRef<Map<string, (event: MessageEvent) => void>>(
    new Map(),
  );
  // Track consecutive parse failures for user notification
  const parseFailureCountRef = useRef(0);
  const PARSE_FAILURE_THRESHOLD = 3;

  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('disconnected');
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  // Store callbacks in refs to avoid stale closures
  const callbacksRef = useRef({
    onComplete,
    onFailed,
    onStatusChange,
    onDataUpdate,
  });
  useEffect(() => {
    callbacksRef.current = {
      onComplete,
      onFailed,
      onStatusChange,
      onDataUpdate,
    };
  }, [onComplete, onFailed, onStatusChange, onDataUpdate]);

  /**
   * Handle incoming SSE events
   */
  const handleEvent = useCallback(
    (event: SSEEvent) => {
      switch (event.type) {
        case SSE_MESSAGE_TYPES.SUBSCRIBED: {
          setConnectionStatus('connected');
          setJobStatus(event.data.status);
          setReconnectAttempts(0);
          break;
        }

        case SSE_MESSAGE_TYPES.STATUS: {
          setJobStatus(event.data.status);
          callbacksRef.current.onStatusChange?.(event.data.status);
          // Invalidate job query to get updated data
          queryClient.invalidateQueries({
            queryKey: queryKeys.jobs.detail(event.data.jobId),
          });
          break;
        }

        case SSE_MESSAGE_TYPES.COMPLETED: {
          setJobStatus(JobStatus.COMPLETED);
          callbacksRef.current.onComplete?.(event.data);
          // Invalidate job and results to fetch final data
          queryClient.invalidateQueries({
            queryKey: queryKeys.jobs.detail(event.data.jobId),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.jobs.results(event.data.jobId),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.jobs.lists(),
          });
          break;
        }

        case SSE_MESSAGE_TYPES.FAILED: {
          setJobStatus(JobStatus.FAILED);
          callbacksRef.current.onFailed?.(event.data);
          // Invalidate to show error state
          queryClient.invalidateQueries({
            queryKey: queryKeys.jobs.detail(event.data.jobId),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.jobs.lists(),
          });
          toast.error('Analysis failed', {
            description: event.data.errorMessage,
          });
          break;
        }

        case SSE_MESSAGE_TYPES.HEARTBEAT: {
          setLastHeartbeat(new Date(event.data.timestamp));
          break;
        }

        case SSE_MESSAGE_TYPES.ERROR: {
          if (import.meta.env.DEV) {
            console.error('SSE error event:', event.data);
          }
          toast.error('Connection error', {
            description: event.data.message,
          });
          break;
        }

        case SSE_MESSAGE_TYPES.DATA_UPDATE: {
          // Forward data update to callback for real-time chart updates
          callbacksRef.current.onDataUpdate?.(event.data);
          break;
        }
      }
    },
    [queryClient],
  );

  /**
   * Calculate reconnection delay with exponential backoff
   */
  const getReconnectDelay = useCallback((attempts: number): number => {
    const delay =
      SSE_CONFIG.initialReconnectDelay *
      Math.pow(SSE_CONFIG.reconnectMultiplier, attempts);
    return Math.min(delay, SSE_CONFIG.maxReconnectDelay);
  }, []);

  /**
   * Disconnect from SSE
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (eventSourceRef.current) {
      // Remove all registered event listeners before closing
      eventHandlersRef.current.forEach((handler, eventType) => {
        eventSourceRef.current?.removeEventListener(eventType, handler);
      });
      eventHandlersRef.current.clear();

      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setConnectionStatus('disconnected');
  }, []);

  /**
   * Connect to SSE endpoint
   */
  const connect = useCallback(() => {
    if (!jobId || !enabled) return;

    // Clean up existing connection
    disconnect();

    setConnectionStatus('connecting');

    const url = `${API_BASE_URL}/jobs/${jobId}/events`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.onopen = () => {
      // Connection opened, waiting for subscribed event
      setReconnectAttempts(0);
    };

    // Create a handler factory for named SSE events
    // Named events require addEventListener, not onmessage
    const createEventHandler = (eventType: string) => (event: MessageEvent) => {
      try {
        const parsedData: unknown = JSON.parse(event.data as string);
        // Parse and validate the SSE event type-safely
        const sseEvent = parseSSEEvent(eventType, parsedData);
        if (sseEvent) {
          handleEvent(sseEvent);
          // Reset failure counter on successful parse
          parseFailureCountRef.current = 0;
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error('Failed to parse SSE event:', {
            eventType,
            rawData: event.data,
            error,
          });
        }

        parseFailureCountRef.current++;
        if (parseFailureCountRef.current === PARSE_FAILURE_THRESHOLD) {
          toast.warning('Connection issues detected', {
            description:
              'Some updates may be delayed. Try refreshing if issues persist.',
          });
        }
      }
    };

    // Register listeners for each SSE event type and store references for cleanup
    const eventTypes: string[] = Object.values(SSE_MESSAGE_TYPES);
    eventTypes.forEach((eventType) => {
      const handler = createEventHandler(eventType);
      eventHandlersRef.current.set(eventType, handler);
      eventSource.addEventListener(eventType, handler);
    });

    eventSource.onerror = () => {
      eventSource.close();
      eventSourceRef.current = null;

      // Don't reconnect if job is completed or failed
      if (jobStatus === JobStatus.COMPLETED || jobStatus === JobStatus.FAILED) {
        setConnectionStatus('disconnected');
        return;
      }

      setConnectionStatus('error');

      // Attempt reconnection with exponential backoff
      if (reconnectAttempts < SSE_CONFIG.maxReconnectAttempts) {
        const delay = getReconnectDelay(reconnectAttempts);
        setReconnectAttempts((prev) => prev + 1);

        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, delay);
      } else {
        toast.error('Connection lost', {
          description:
            'Failed to reconnect after multiple attempts. Please refresh the page.',
        });
      }
    };
  }, [
    jobId,
    enabled,
    disconnect,
    handleEvent,
    jobStatus,
    reconnectAttempts,
    getReconnectDelay,
  ]);

  /**
   * Manually trigger reconnection
   */
  const reconnect = useCallback(() => {
    setReconnectAttempts(0);
    connect();
  }, [connect]);

  // Connect when jobId changes and enabled
  useEffect(() => {
    if (jobId && enabled) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [jobId, enabled, connect, disconnect]);

  // Disconnect when job reaches terminal state
  useEffect(() => {
    if (jobStatus === JobStatus.COMPLETED || jobStatus === JobStatus.FAILED) {
      // Give a moment for the UI to process, then disconnect
      const timeout = setTimeout(() => {
        disconnect();
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [jobStatus, disconnect]);

  return {
    connectionStatus,
    jobStatus,
    lastHeartbeat,
    disconnect,
    reconnect,
    reconnectAttempts,
  };
}
