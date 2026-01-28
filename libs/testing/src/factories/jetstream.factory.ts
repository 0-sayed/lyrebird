import type {
  JetstreamCommitEvent,
  JetstreamIdentityEvent,
  JetstreamPostEvent,
  JetstreamCommit,
  JetstreamRecord,
} from '@app/bluesky';
import { generateId } from '../utils/id.util';

/**
 * Options for creating a raw commit event
 */
interface CreateRawCommitEventOptions {
  did?: string;
  time_us?: number;
  commit?: JetstreamCommit;
}

/**
 * Factory for creating Jetstream test data
 */
export class JetstreamFactory {
  private static postCounter = 0;

  /**
   * Create a mock JetstreamPostEvent
   */
  static createPostEvent(
    overrides: Partial<JetstreamPostEvent> = {},
  ): JetstreamPostEvent {
    const id = this.postCounter++;
    const rkey = overrides.rkey ?? `post${id}`;
    const did = overrides.did ?? `did:plc:test${id}`;

    return {
      did,
      handle: overrides.handle,
      rkey,
      text: overrides.text ?? `Test post content ${id}`,
      createdAt: overrides.createdAt ?? new Date(),
      uri: overrides.uri ?? `at://${did}/app.bsky.feed.post/${rkey}`,
      cid: overrides.cid ?? `bafyrei${generateId().replace(/-/g, '')}`,
      timestamp: overrides.timestamp ?? Date.now() * 1000,
      langs: overrides.langs,
      isReply: overrides.isReply ?? false,
    };
  }

  /**
   * Create a mock raw JetstreamCommitEvent (as received from WebSocket)
   */
  static createRawEvent(
    overrides: CreateRawCommitEventOptions = {},
  ): JetstreamCommitEvent {
    const id = this.postCounter++;
    const did = overrides.did ?? `did:plc:test${id}`;
    const rkey = `post${id}`;

    const defaultRecord: JetstreamRecord = {
      $type: 'app.bsky.feed.post',
      text: `Test post content ${id}`,
      createdAt: new Date().toISOString(),
    };

    const defaultCommit: JetstreamCommit = {
      rev: `rev${id}`,
      operation: 'create',
      collection: 'app.bsky.feed.post',
      rkey,
      record: defaultRecord,
      cid: `bafyrei${generateId().replace(/-/g, '')}`,
    };

    return {
      did,
      time_us: overrides.time_us ?? Date.now() * 1000,
      kind: 'commit',
      commit: overrides.commit ?? defaultCommit,
    };
  }

  /**
   * Create a post event with specific text for keyword testing
   */
  static createPostWithText(text: string): JetstreamPostEvent {
    return this.createPostEvent({ text });
  }

  /**
   * Create multiple post events
   */
  static createPostEvents(
    count: number,
    overrides: Partial<JetstreamPostEvent> = {},
  ): JetstreamPostEvent[] {
    return Array.from({ length: count }, () => this.createPostEvent(overrides));
  }

  /**
   * Create a reply post event
   */
  static createReplyEvent(): JetstreamPostEvent {
    return this.createPostEvent({
      isReply: true,
    });
  }

  /**
   * Create an identity change event
   */
  static createIdentityEvent(
    did: string,
    newHandle: string,
  ): JetstreamIdentityEvent {
    return {
      did,
      time_us: Date.now() * 1000,
      kind: 'identity',
      identity: {
        handle: newHandle,
        seq: this.postCounter++,
        time: new Date().toISOString(),
      },
    };
  }

  /**
   * Create a delete commit event
   */
  static createDeleteEvent(did: string, rkey: string): JetstreamCommitEvent {
    return {
      did,
      time_us: Date.now() * 1000,
      kind: 'commit',
      commit: {
        rev: `rev${this.postCounter++}`,
        operation: 'delete',
        collection: 'app.bsky.feed.post',
        rkey,
      },
    };
  }

  /**
   * Reset the counter (useful between tests)
   */
  static reset(): void {
    this.postCounter = 0;
  }
}
