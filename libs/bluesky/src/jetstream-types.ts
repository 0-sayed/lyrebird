/**
 * Jetstream API Type Definitions
 *
 * Bluesky Jetstream is a developer-friendly API for consuming the AT Protocol firehose.
 * It provides real-time access to new posts without the 2-5 second indexing delay
 * present in the searchPosts API.
 *
 * @see https://docs.bsky.app/docs/advanced-guides/jetstream
 */

/**
 * Jetstream subscription parameters for WebSocket connection
 */
export interface JetstreamSubscription {
  /** Filter by AT Protocol collection types (e.g., 'app.bsky.feed.post') */
  wantedCollections?: string[];
  /** Filter by DIDs (max 10,000) */
  wantedDids?: string[];
  /** Limit maximum message payload size in bytes */
  maxMessageSizeBytes?: number;
  /** Resume from a specific cursor (Unix microseconds) for replay */
  cursor?: string;
  /** Enable zstd compression for reduced bandwidth */
  compress?: boolean;
}

/**
 * Base Jetstream event fields common to all event types
 */
interface JetstreamEventBase {
  /** Author DID (Decentralized Identifier) */
  did: string;
  /** Event timestamp in Unix microseconds */
  time_us: number;
}

/**
 * Commit event - repository operation (create/update/delete)
 */
export interface JetstreamCommitEvent extends JetstreamEventBase {
  /** Type of event */
  kind: 'commit';
  /** Commit data */
  commit: JetstreamCommit;
}

/**
 * Identity event - handle or display name change
 */
export interface JetstreamIdentityEvent extends JetstreamEventBase {
  /** Type of event */
  kind: 'identity';
  /** Identity data */
  identity: JetstreamIdentity;
}

/**
 * Account event - account status change
 */
export interface JetstreamAccountEvent extends JetstreamEventBase {
  /** Type of event */
  kind: 'account';
  /** Account data */
  account: JetstreamAccount;
}

/**
 * Root Jetstream event structure (discriminated union)
 *
 * This union type ensures that each event kind has only its relevant data:
 * - 'commit' events must have `commit` field
 * - 'identity' events must have `identity` field
 * - 'account' events must have `account` field
 */
export type JetstreamEvent =
  | JetstreamCommitEvent
  | JetstreamIdentityEvent
  | JetstreamAccountEvent;

/**
 * Commit event - represents a repository operation (create/update/delete)
 */
export interface JetstreamCommit {
  /** Repository revision string */
  rev: string;
  /** Type of operation performed */
  operation: 'create' | 'update' | 'delete';
  /** AT Protocol collection type (e.g., 'app.bsky.feed.post') */
  collection: string;
  /** Record key within the collection */
  rkey: string;
  /** The actual record data (present for create/update, absent for delete) */
  record?: JetstreamRecord;
  /** Content ID of the record */
  cid?: string;
}

/**
 * Record payload from a commit event
 * This is a flexible type that can represent various AT Protocol record types
 */
export interface JetstreamRecord {
  /** AT Protocol record type lexicon */
  $type: string;
  /** Post text content (for app.bsky.feed.post) */
  text?: string;
  /** ISO 8601 timestamp when the record was created */
  createdAt: string;
  /** Language tags (BCP 47) */
  langs?: string[];
  /** Reply metadata (for reply posts) */
  reply?: {
    parent: { uri: string; cid: string };
    root: { uri: string; cid: string };
  };
  /** Embedded content (images, links, etc.) */
  embed?: JetstreamEmbed;
  /** Facets (mentions, links, hashtags in text) */
  facets?: JetstreamFacet[];
}

/**
 * Embedded content in a post
 */
export interface JetstreamEmbed {
  /** Embed type lexicon */
  $type: string;
  /** External link embed */
  external?: {
    uri: string;
    title?: string;
    description?: string;
    thumb?: {
      $type: string;
      ref: { $link: string };
      mimeType: string;
      size: number;
    };
  };
  /** Image embeds */
  images?: Array<{
    alt?: string;
    image: {
      $type: string;
      ref: { $link: string };
      mimeType: string;
      size: number;
    };
  }>;
  /** Record embed (quote post) */
  record?: {
    uri: string;
    cid: string;
  };
}

/**
 * Facet for rich text (mentions, links, hashtags)
 */
export interface JetstreamFacet {
  /** Byte range of the facet in the text */
  index: {
    byteStart: number;
    byteEnd: number;
  };
  /** Features applied to this range */
  features: Array<{
    $type: string;
    /** For mentions */
    did?: string;
    /** For links */
    uri?: string;
    /** For hashtags */
    tag?: string;
  }>;
}

/**
 * Identity event - handle or display name change
 */
export interface JetstreamIdentity {
  /** New handle (may be undefined if handle is being cleared) */
  handle?: string;
  /** Sequence number */
  seq?: number;
  /** ISO 8601 timestamp */
  time?: string;
}

/**
 * Account event - account status change
 */
export interface JetstreamAccount {
  /** Whether the account is active */
  active: boolean;
  /** Account status (e.g., 'active', 'suspended', 'deleted') */
  status?: string;
  /** Sequence number */
  seq?: number;
  /** ISO 8601 timestamp */
  time?: string;
}

/**
 * Processed post event - normalized representation for internal use
 * This is what we emit to consumers after processing raw Jetstream events
 */
export interface JetstreamPostEvent {
  /** Author DID */
  did: string;
  /** Author handle (resolved separately, may be undefined initially) */
  handle?: string;
  /** Record key (last part of URI) */
  rkey: string;
  /** Post text content */
  text: string;
  /** When the post was created */
  createdAt: Date;
  /** Full AT URI (at://did/collection/rkey) */
  uri: string;
  /** Content ID */
  cid: string;
  /** Original timestamp from Jetstream (Unix microseconds) */
  timestamp: number;
  /** Language tags if available */
  langs?: string[];
  /** Whether this is a reply */
  isReply?: boolean;
}

/**
 * Connection status for the Jetstream client
 */
export type JetstreamConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

/**
 * Options for configuring the Jetstream client
 */
export interface JetstreamClientOptions {
  /** WebSocket endpoint URL */
  endpoint: string;
  /** Maximum reconnection attempts before giving up */
  maxReconnectAttempts: number;
  /** Initial backoff delay in milliseconds */
  initialBackoffMs: number;
  /** Maximum backoff delay in milliseconds */
  maxBackoffMs: number;
  /** Enable compression */
  compress: boolean;
  /** Collections to subscribe to */
  wantedCollections: string[];
}

/**
 * Metrics tracked by the Jetstream client
 */
export interface JetstreamMetrics {
  /** Total messages received since connection */
  messagesReceived: number;
  /** Messages received per second (rolling average) */
  messagesPerSecond: number;
  /** Total posts processed */
  postsProcessed: number;
  /** Current connection status */
  connectionStatus: JetstreamConnectionStatus;
  /** Last cursor position */
  lastCursor?: string;
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  /** Timestamp of last successful message */
  lastMessageAt?: Date;
}
