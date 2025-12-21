CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt" text NOT NULL,
	"search_strategy" jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "sentiment_data" (
	"id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"source" text NOT NULL,
	"source_url" text,
	"author_name" text,
	"text_content" text NOT NULL,
	"raw_content" text,
	"sentiment_score" real NOT NULL,
	"sentiment_label" text NOT NULL,
	"confidence" real,
	"upvotes" integer DEFAULT 0,
	"comment_count" integer DEFAULT 0,
	"published_at" timestamp NOT NULL,
	"collected_at" timestamp DEFAULT now() NOT NULL,
	"analyzed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sentiment_data_id_published_at_pk" PRIMARY KEY("id","published_at")
);
--> statement-breakpoint
ALTER TABLE "sentiment_data" ADD CONSTRAINT "sentiment_data_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;