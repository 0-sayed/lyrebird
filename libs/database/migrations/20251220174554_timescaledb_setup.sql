-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;--> statement-breakpoint

-- Convert sentiment_data table to a hypertable
-- Partition by published_at (original post time) with 7-day chunks for optimal query performance
DO $$
BEGIN
  PERFORM create_hypertable(
    'sentiment_data',
    'published_at',
    chunk_time_interval => INTERVAL '7 days',
    if_not_exists => TRUE
  );
  
  -- Raise exception if hypertable creation failed
  IF NOT EXISTS (
    SELECT 1 FROM timescaledb_information.hypertables 
    WHERE hypertable_name = 'sentiment_data'
  ) THEN
    RAISE EXCEPTION 'Failed to create hypertable for sentiment_data';
  END IF;
END $$;--> statement-breakpoint

-- Create indexes for common query patterns
CREATE INDEX IF NOT EXISTS sentiment_data_job_id_idx ON sentiment_data (job_id);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sentiment_data_source_idx ON sentiment_data (source);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sentiment_data_published_at_idx ON sentiment_data (published_at DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sentiment_data_collected_at_idx ON sentiment_data (collected_at DESC);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS sentiment_data_sentiment_score_idx ON sentiment_data (sentiment_score);--> statement-breakpoint

-- Set up data retention policy (90 days)
SELECT add_retention_policy(
  'sentiment_data',
  INTERVAL '90 days',
  if_not_exists => TRUE
);
