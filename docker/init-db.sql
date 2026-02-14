-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create sentiment_data table (must match Drizzle schema in libs/database/src/schema/sentiment-data.schema.ts)
CREATE TABLE IF NOT EXISTS sentiment_data (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    source_url TEXT,
    author_name TEXT,
    text_content TEXT NOT NULL,
    raw_content TEXT,
    sentiment_score REAL NOT NULL,
    sentiment_label TEXT NOT NULL,
    confidence REAL,
    upvotes INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    published_at TIMESTAMP NOT NULL,
    collected_at TIMESTAMP NOT NULL DEFAULT NOW(),
    analyzed_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT sentiment_data_id_published_at_pk PRIMARY KEY (id, published_at)
);

-- Convert to hypertable for time-series optimization (partitioned by published_at)
SELECT create_hypertable('sentiment_data', 'published_at', chunk_time_interval => INTERVAL '7 days', if_not_exists => TRUE);

-- Create indexes for common queries
CREATE UNIQUE INDEX IF NOT EXISTS sentiment_data_job_id_source_url_idx ON sentiment_data(job_id, source_url, published_at);
CREATE INDEX IF NOT EXISTS sentiment_data_source_idx ON sentiment_data(source);
CREATE INDEX IF NOT EXISTS sentiment_data_published_at_idx ON sentiment_data(published_at DESC);
CREATE INDEX IF NOT EXISTS sentiment_data_collected_at_idx ON sentiment_data(collected_at DESC);
CREATE INDEX IF NOT EXISTS sentiment_data_sentiment_score_idx ON sentiment_data(sentiment_score);

-- Set up data retention policy (90 days)
SELECT add_retention_policy('sentiment_data', INTERVAL '90 days', if_not_exists => TRUE);

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Lyrebird database initialized successfully!';
END $$;
