/**
 * Jetstream Configuration Constants
 *
 * Centralized constants for the Jetstream integration module.
 */

/**
 * Core Jetstream configuration constants
 */
export const JETSTREAM_CONSTANTS = {
  /** Default Jetstream endpoint (US East) */
  DEFAULT_ENDPOINT: 'wss://jetstream2.us-east.bsky.network/subscribe',

  /** Alternative endpoint (US West) */
  ENDPOINT_US_WEST: 'wss://jetstream1.us-west.bsky.network/subscribe',

  /** Maximum reconnection attempts before giving up */
  MAX_RECONNECT_ATTEMPTS: 10,

  /** Initial backoff delay for reconnection (ms) */
  INITIAL_BACKOFF_MS: 1000,

  /** Maximum backoff delay for reconnection (ms) */
  MAX_BACKOFF_MS: 60000,

  /** Metrics logging interval (ms) */
  METRICS_LOG_INTERVAL_MS: 30000,

  /** Cursor persistence interval (ms) */
  CURSOR_PERSIST_INTERVAL_MS: 5000,

  /** Minimum keyword length to consider for matching */
  MIN_KEYWORD_LENGTH: 2,

  /** Maximum keywords to extract from a prompt */
  MAX_KEYWORDS_PER_PROMPT: 20,

  /** AT Protocol collection for posts */
  POST_COLLECTION: 'app.bsky.feed.post',
} as const;

/**
 * Stop words to exclude from keyword extraction
 *
 * These common words are filtered out when extracting keywords
 * from user prompts to improve matching accuracy.
 */
export const STOP_WORDS = new Set([
  // Articles
  'a',
  'an',
  'the',

  // Conjunctions
  'and',
  'but',
  'or',
  'nor',
  'for',
  'yet',
  'so',

  // Prepositions
  'at',
  'by',
  'for',
  'from',
  'in',
  'into',
  'of',
  'off',
  'on',
  'onto',
  'out',
  'over',
  'to',
  'up',
  'with',
  'about',
  'after',
  'before',
  'between',
  'during',
  'through',
  'under',
  'without',

  // Pronouns
  'i',
  'me',
  'my',
  'myself',
  'we',
  'our',
  'ours',
  'ourselves',
  'you',
  'your',
  'yours',
  'yourself',
  'yourselves',
  'he',
  'him',
  'his',
  'himself',
  'she',
  'her',
  'hers',
  'herself',
  'it',
  'its',
  'itself',
  'they',
  'them',
  'their',
  'theirs',
  'themselves',
  'what',
  'which',
  'who',
  'whom',
  'this',
  'that',
  'these',
  'those',

  // Common verbs
  'am',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'having',
  'do',
  'does',
  'did',
  'doing',
  'will',
  'would',
  'could',
  'should',
  'might',
  'must',
  'shall',
  'can',
  'may',

  // Auxiliary/Common words
  'here',
  'there',
  'when',
  'where',
  'why',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'not',
  'only',
  'same',
  'than',
  'too',
  'very',
  'just',
  'also',
  'now',
  'then',

  // Question words (when not the subject)
  'any',
  'anything',
  'anyone',
  'anybody',
  'everything',
  'everyone',
  'everybody',
  'something',
  'someone',
  'somebody',
  'nothing',
  'none',
  'nobody',

  // Common qualifiers
  'really',
  'actually',
  'basically',
  'probably',
  'maybe',
  'perhaps',
  'certainly',
  'definitely',
  'always',
  'never',
  'sometimes',
  'often',
  'usually',
  'still',
  'already',
  'even',
  'ever',

  // Sentiment analysis specific stop words
  'people',
  'think',
  'know',
  'want',
  'need',
  'like',
  'get',
  'make',
  'see',
  'look',
  'say',
  'said',
  'go',
  'going',
  'come',
  'coming',
  'take',
  'give',
  'find',
  'tell',
  'told',
  'use',
  'using',
  'work',
  'thing',
  'things',
  'time',
  'way',
  'lot',
  'good',
  'new',
  'first',
  'last',
  'long',
  'great',
  'little',
  'own',
  'well',
  'back',
  'year',
  'day',
  'much',
  'many',
]);

/**
 * Characters to use as word boundaries when extracting keywords
 */
export const WORD_BOUNDARY_CHARS = /[\s,.!?;:'"()[\]{}<>/\\|@#$%^&*+=~`\-_]+/;

/**
 * Pattern for valid keyword characters (letters, numbers, some punctuation)
 */
export const VALID_KEYWORD_PATTERN = /^[a-zA-Z0-9]+$/;

/**
 * Special character pattern for hashtags and mentions
 */
export const HASHTAG_PATTERN = /#([a-zA-Z0-9_]+)/g;
