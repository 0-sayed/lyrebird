import {
  pgTable,
  uuid,
  text,
  real,
  integer,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { jobs } from './jobs.schema';

/**
 * Sentiment Data table - time-series data for sentiment scores
 *
 * This will be converted to a TimescaleDB hypertable for:
 * - Fast time-based queries
 * - Automatic data partitioning by publishedAt (original post time)
 * - Efficient aggregations over historical sentiment data
 *
 * Key timestamps:
 * - publishedAt: When the content was originally posted (time dimension)
 * - collectedAt: When our ingestion service fetched it
 * - analyzedAt: When our sentiment analysis completed
 */
export const sentimentData = pgTable(
  'sentiment_data',
  {
    id: uuid('id').defaultRandom().notNull(),

    // Foreign key to jobs table
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),

    // Source information
    source: text('source').notNull(), // 'reddit', 'twitter', etc.
    sourceUrl: text('source_url'), // Original post URL
    authorName: text('author_name'),

    // Content
    textContent: text('text_content').notNull(),
    rawContent: text('raw_content'), // Original unprocessed text

    // Sentiment analysis results
    sentimentScore: real('sentiment_score').notNull(), // -1.0 to 1.0
    sentimentLabel: text('sentiment_label', {
      enum: ['negative', 'neutral', 'positive'],
    }).notNull(),
    confidence: real('confidence'), // 0.0 to 1.0

    // Metadata
    upvotes: integer('upvotes').default(0),
    commentCount: integer('comment_count').default(0),

    // Timestamps - CRITICAL for TimescaleDB
    publishedAt: timestamp('published_at').notNull(), // Original post timestamp from source
    collectedAt: timestamp('collected_at').notNull().defaultNow(), // When we ingested it
    analyzedAt: timestamp('analyzed_at').notNull().defaultNow(), // When we analyzed it
  },
  (table) => ({
    // Composite primary key required for TimescaleDB hypertable
    pk: primaryKey({ columns: [table.id, table.publishedAt] }),
  }),
);

// Type inference
export type SentimentData = typeof sentimentData.$inferSelect;
export type NewSentimentData = typeof sentimentData.$inferInsert;
