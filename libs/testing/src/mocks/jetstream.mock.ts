import { Subject } from 'rxjs';
import type {
  JetstreamPostEvent,
  JetstreamConnectionStatus,
} from '@app/bluesky';

/**
 * Mock implementation of JetstreamClientService for testing
 */
export const createMockJetstreamClientService = () => {
  const postsSubject = new Subject<JetstreamPostEvent>();
  const statusSubject = new Subject<JetstreamConnectionStatus>();

  return {
    posts$: postsSubject.asObservable(),
    status$: statusSubject.asObservable(),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    isConnected: jest.fn().mockReturnValue(false),
    getConnectionStatus: jest
      .fn()
      .mockReturnValue('disconnected' as JetstreamConnectionStatus),
    getMetrics: jest.fn().mockReturnValue({
      messagesReceived: 0,
      messagesPerSecond: 0,
      postsProcessed: 0,
      connectionStatus: 'disconnected',
      reconnectAttempts: 0,
    }),
    getLastCursor: jest.fn().mockReturnValue(null),
    setLastCursor: jest.fn(),
    resetMetrics: jest.fn(),
    // Expose subjects for test control
    _postsSubject: postsSubject,
    _statusSubject: statusSubject,
    // Helper to emit a post in tests
    _emitPost: (post: JetstreamPostEvent) => postsSubject.next(post),
    _emitStatus: (status: JetstreamConnectionStatus) =>
      statusSubject.next(status),
  };
};

/**
 * Mock implementation of JobRegistryService for testing
 */
export const createMockJobRegistryService = () => ({
  registerJob: jest.fn(),
  unregisterJob: jest.fn(),
  completeJob: jest.fn(),
  getJob: jest.fn(),
  getActiveJobs: jest.fn().mockReturnValue([]),
  hasActiveJobs: jest.fn().mockReturnValue(false),
  hasJob: jest.fn().mockReturnValue(false),
  getActiveJobCount: jest.fn().mockReturnValue(0),
  incrementMatchedCount: jest.fn(),
  extractKeywords: jest.fn().mockReturnValue([]),
  buildRegexPattern: jest.fn().mockReturnValue(/(?!)/),
  matchesJob: jest.fn().mockReturnValue(false),
});

/**
 * Mock implementation of KeywordFilterService for testing
 */
export const createMockKeywordFilterService = () => ({
  matchPost: jest.fn().mockReturnValue([]),
  processPost: jest.fn().mockResolvedValue(0),
  getMatchStats: jest.fn().mockReturnValue({
    totalJobs: 0,
    totalMatched: 0,
    jobStats: [],
  }),
});

/**
 * Mock implementation of JetstreamManagerService for testing
 */
export const createMockJetstreamManagerService = () => ({
  isEnabled: jest.fn().mockReturnValue(false),
  isCurrentlyListening: jest.fn().mockReturnValue(false),
  isJobRegistered: jest.fn().mockReturnValue(false),
  registerJob: jest.fn().mockResolvedValue(undefined),
  completeJob: jest.fn(),
  cancelJob: jest.fn(),
  getStatus: jest.fn().mockReturnValue({
    enabled: false,
    isListening: false,
    connectionStatus: 'disconnected',
    activeJobCount: 0,
    metrics: {
      messagesReceived: 0,
      messagesPerSecond: 0,
      postsProcessed: 0,
      connectionStatus: 'disconnected',
      reconnectAttempts: 0,
    },
  }),
  getStats: jest.fn().mockReturnValue({
    totalPostsProcessed: 0,
    totalPostsMatched: 0,
    activeJobs: 0,
    matchStats: {
      totalJobs: 0,
      totalMatched: 0,
      jobStats: [],
    },
  }),
  stopListening: jest.fn(),
  reconnect: jest.fn().mockResolvedValue(undefined),
  resetStats: jest.fn(),
  onModuleInit: jest.fn(),
  onModuleDestroy: jest.fn(),
});

/**
 * Mock implementation of DidResolverService for testing
 */
export const createMockDidResolverService = () => ({
  resolveHandle: jest.fn().mockImplementation((did: string) => did),
  resolveHandleOrNull: jest.fn().mockResolvedValue(null),
  resolveHandles: jest.fn().mockResolvedValue([]),
  warmCache: jest.fn().mockResolvedValue(undefined),
  getMetrics: jest.fn().mockReturnValue({
    totalRequests: 0,
    cacheHits: 0,
    cacheMisses: 0,
    failures: 0,
    cacheSize: 0,
    hitRate: 0,
  }),
  clearCache: jest.fn(),
  resetMetrics: jest.fn(),
  setCachedHandle: jest.fn(),
  onModuleDestroy: jest.fn(),
});

/**
 * Mock implementation of CursorPersistenceService for testing
 */
export const createMockCursorPersistenceService = () => ({
  getBackend: jest.fn().mockReturnValue('memory'),
  saveCursor: jest.fn(),
  saveCursorImmediate: jest.fn().mockResolvedValue(undefined),
  loadCursor: jest.fn().mockResolvedValue(null),
  loadCursorData: jest.fn().mockResolvedValue(null),
  clearCursor: jest.fn().mockResolvedValue(undefined),
  startAutoSave: jest.fn(),
  stopAutoSave: jest.fn(),
  flush: jest.fn().mockResolvedValue(undefined),
  isAutoSaveRunning: jest.fn().mockReturnValue(false),
  getLastSavedCursor: jest.fn().mockReturnValue(null),
  getPendingCursor: jest.fn().mockReturnValue(null),
  onModuleInit: jest.fn().mockResolvedValue(undefined),
  onModuleDestroy: jest.fn().mockResolvedValue(undefined),
});
