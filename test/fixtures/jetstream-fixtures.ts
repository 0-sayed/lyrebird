/**
 * Jetstream Test Fixtures
 *
 * Factory functions for creating Jetstream WebSocket events
 * for unit and integration testing.
 *
 * @example
 * // Create a raw WebSocket event
 * const event = createMockJetstreamEvent({
 *   text: 'Great content about #bitcoin',
 * });
 *
 * @example
 * // Create a processed post event
 * const post = createMockJetstreamPostEvent({
 *   text: 'I love this product!',
 *   did: 'did:plc:user123',
 * });
 */

import type {
  JetstreamEvent,
  JetstreamCommitEvent,
  JetstreamIdentityEvent,
  JetstreamAccountEvent,
  JetstreamPostEvent,
  JetstreamCommit,
  JetstreamRecord,
  JetstreamIdentity,
  JetstreamAccount,
} from '@app/bluesky';

/**
 * Counter for generating unique values across factory calls
 */
let jetstreamCounter = 0;

/**
 * Generate a unique ID for testing (UUID format)
 */
function generateTestId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Options for creating a mock Jetstream event
 */
export interface CreateMockJetstreamEventOptions {
  /** Author DID */
  did?: string;
  /** Event timestamp in Unix microseconds */
  time_us?: number;
  /** Event kind */
  kind?: 'commit' | 'identity' | 'account';
  /** Post text content (for commit events) */
  text?: string;
  /** Operation type (for commit events) */
  operation?: 'create' | 'update' | 'delete';
  /** Language tags */
  langs?: string[];
  /** Whether the post is a reply */
  isReply?: boolean;
}

/**
 * Creates a mock raw JetstreamEvent as received from WebSocket.
 *
 * @example
 * // Basic usage
 * const event = createMockJetstreamEvent();
 *
 * @example
 * // With specific text for keyword testing
 * const event = createMockJetstreamEvent({
 *   text: 'Bitcoin is amazing! #crypto',
 * });
 *
 * @example
 * // Create a delete event
 * const deleteEvent = createMockJetstreamEvent({
 *   operation: 'delete',
 * });
 */
export function createMockJetstreamEvent(
  options: CreateMockJetstreamEventOptions = {},
): JetstreamEvent {
  const id = ++jetstreamCounter;
  const did = options.did ?? `did:plc:testuser${id}`;
  const rkey = `post${id}`;
  const time_us = options.time_us ?? Date.now() * 1000;

  // Handle identity events
  if (options.kind === 'identity') {
    const identity: JetstreamIdentity = {
      handle: `testhandle${id}.bsky.social`,
      seq: id,
      time: new Date().toISOString(),
    };
    return {
      did,
      time_us,
      kind: 'identity',
      identity,
    } satisfies JetstreamIdentityEvent;
  }

  // Handle account events
  if (options.kind === 'account') {
    const account: JetstreamAccount = {
      active: true,
      status: 'active',
      seq: id,
      time: new Date().toISOString(),
    };
    return {
      did,
      time_us,
      kind: 'account',
      account,
    } satisfies JetstreamAccountEvent;
  }

  // Default: commit event
  const defaultRecord: JetstreamRecord = {
    $type: 'app.bsky.feed.post',
    text: options.text ?? `Test post content ${id}`,
    createdAt: new Date().toISOString(),
    langs: options.langs,
    reply: options.isReply
      ? {
          parent: {
            uri: `at://did:plc:parent/app.bsky.feed.post/parent${id}`,
            cid: `bafyreiparent${id}`,
          },
          root: {
            uri: `at://did:plc:root/app.bsky.feed.post/root${id}`,
            cid: `bafyreiroot${id}`,
          },
        }
      : undefined,
  };

  const commit: JetstreamCommit = {
    rev: `rev${id}`,
    operation: options.operation ?? 'create',
    collection: 'app.bsky.feed.post',
    rkey,
    record: options.operation === 'delete' ? undefined : defaultRecord,
    cid:
      options.operation === 'delete'
        ? undefined
        : `bafyrei${generateTestId().replace(/-/g, '')}`,
  };

  return {
    did,
    time_us,
    kind: 'commit',
    commit,
  } satisfies JetstreamCommitEvent;
}

/**
 * Options for creating a mock processed post event
 */
export interface CreateMockJetstreamPostEventOptions {
  /** Author DID */
  did?: string;
  /** Author handle */
  handle?: string;
  /** Record key */
  rkey?: string;
  /** Post text content */
  text?: string;
  /** When the post was created */
  createdAt?: Date;
  /** Full AT URI */
  uri?: string;
  /** Content ID */
  cid?: string;
  /** Original timestamp from Jetstream (Unix microseconds) */
  timestamp?: number;
  /** Language tags */
  langs?: string[];
  /** Whether this is a reply */
  isReply?: boolean;
}

/**
 * Creates a mock processed JetstreamPostEvent.
 *
 * This represents the normalized post after processing raw events.
 *
 * @example
 * // Basic usage
 * const post = createMockJetstreamPostEvent();
 *
 * @example
 * // With specific properties
 * const post = createMockJetstreamPostEvent({
 *   text: 'Great product!',
 *   did: 'did:plc:user123',
 *   handle: 'alice.bsky.social',
 * });
 */
export function createMockJetstreamPostEvent(
  options: CreateMockJetstreamPostEventOptions = {},
): JetstreamPostEvent {
  const id = ++jetstreamCounter;
  const did = options.did ?? `did:plc:testuser${id}`;
  const rkey = options.rkey ?? `post${id}`;

  return {
    did,
    handle: options.handle,
    rkey,
    text: options.text ?? `Test post content ${id}`,
    createdAt: options.createdAt ?? new Date(),
    uri: options.uri ?? `at://${did}/app.bsky.feed.post/${rkey}`,
    cid: options.cid ?? `bafyrei${generateTestId().replace(/-/g, '')}`,
    timestamp: options.timestamp ?? Date.now() * 1000,
    langs: options.langs,
    isReply: options.isReply ?? false,
  };
}

/**
 * Creates a mock identity change event.
 *
 * @example
 * const event = createMockJetstreamIdentityEvent(
 *   'did:plc:user123',
 *   'alice.bsky.social',
 * );
 */
export function createMockJetstreamIdentityEvent(
  did: string,
  newHandle: string,
): JetstreamIdentityEvent {
  const id = ++jetstreamCounter;

  const identity: JetstreamIdentity = {
    handle: newHandle,
    seq: id,
    time: new Date().toISOString(),
  };

  return {
    did,
    time_us: Date.now() * 1000,
    kind: 'identity',
    identity,
  };
}

/**
 * Creates a mock account status change event.
 *
 * @example
 * const event = createMockJetstreamAccountEvent(
 *   'did:plc:user123',
 *   { active: false, status: 'suspended' },
 * );
 */
export function createMockJetstreamAccountEvent(
  did: string,
  account: Partial<JetstreamAccount> = {},
): JetstreamAccountEvent {
  const id = ++jetstreamCounter;

  const accountData: JetstreamAccount = {
    active: account.active ?? true,
    status: account.status,
    seq: account.seq ?? id,
    time: account.time ?? new Date().toISOString(),
  };

  return {
    did,
    time_us: Date.now() * 1000,
    kind: 'account',
    account: accountData,
  };
}

/**
 * Creates a mock delete commit event.
 *
 * @example
 * const event = createMockJetstreamDeleteEvent(
 *   'did:plc:user123',
 *   'post456',
 * );
 */
export function createMockJetstreamDeleteEvent(
  did: string,
  rkey: string,
): JetstreamCommitEvent {
  const id = ++jetstreamCounter;

  return {
    did,
    time_us: Date.now() * 1000,
    kind: 'commit',
    commit: {
      rev: `rev${id}`,
      operation: 'delete',
      collection: 'app.bsky.feed.post',
      rkey,
    },
  };
}

/**
 * Creates multiple post events for batch testing.
 *
 * @example
 * const posts = createMockJetstreamPostEventBatch(100);
 */
export function createMockJetstreamPostEventBatch(
  count: number,
  options: CreateMockJetstreamPostEventOptions = {},
): JetstreamPostEvent[] {
  return Array.from({ length: count }, () =>
    createMockJetstreamPostEvent(options),
  );
}

/**
 * Creates a post event with specific text for keyword testing.
 *
 * @example
 * const post = createMockJetstreamPostWithText('I love bitcoin and crypto!');
 */
export function createMockJetstreamPostWithText(
  text: string,
): JetstreamPostEvent {
  return createMockJetstreamPostEvent({ text });
}

/**
 * Creates a reply post event.
 *
 * @example
 * const reply = createMockJetstreamReplyEvent();
 */
export function createMockJetstreamReplyEvent(): JetstreamPostEvent {
  return createMockJetstreamPostEvent({ isReply: true });
}

/**
 * Resets the Jetstream counter.
 * Call this in beforeEach() to ensure test isolation.
 *
 * @example
 * beforeEach(() => {
 *   resetJetstreamCounter();
 * });
 */
export function resetJetstreamCounter(): void {
  jetstreamCounter = 0;
}
