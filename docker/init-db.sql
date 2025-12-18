-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create sentiment_data table
CREATE TABLE IF NOT EXISTS sentiment_data (
    id SERIAL,
    job_id VARCHAR(255) NOT NULL,
    source VARCHAR(50) NOT NULL,
    text TEXT NOT NULL,
    sentiment_score REAL NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, created_at)
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('sentiment_data', 'created_at', if_not_exists => TRUE);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sentiment_job_id ON sentiment_data(job_id);
CREATE INDEX IF NOT EXISTS idx_sentiment_created_at ON sentiment_data(created_at DESC);

-- Create a view for quick stats
CREATE OR REPLACE VIEW sentiment_summary AS
SELECT
    DATE_TRUNC('day', created_at) AS day,
    COUNT(*) AS total_records,
    AVG(sentiment_score) AS avg_sentiment,
    MIN(sentiment_score) AS min_sentiment,
    MAX(sentiment_score) AS max_sentiment
FROM sentiment_data
GROUP BY day
ORDER BY day DESC;

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE 'Lyrebird database initialized successfully!';
END $$;