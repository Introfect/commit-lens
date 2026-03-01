CREATE TABLE "pull_request_inline_comment" (
	"id" text PRIMARY KEY NOT NULL,
	"review_artifact_id" text NOT NULL,
	"path" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"severity" text NOT NULL,
	"line" integer,
	"side" text,
	"start_line" integer,
	"start_side" text,
	"subject_type" text DEFAULT 'line' NOT NULL,
	"github_review_comment_id" text,
	"anchor_status" text DEFAULT 'unanchored' NOT NULL,
	"anchor_failure_reason" text,
	"fix_prompt_status" text DEFAULT 'not_generated' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pull_request_review_artifact" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"repository_id" text NOT NULL,
	"pr_number" text NOT NULL,
	"head_sha" text NOT NULL,
	"overall_body" text NOT NULL,
	"pr_summary" text NOT NULL,
	"confidence_score" integer NOT NULL,
	"confidence_reason" text NOT NULL,
	"github_review_id" text,
	"review_event" text NOT NULL,
	"posting_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pull_request_inline_comment" ADD CONSTRAINT "pull_request_inline_comment_review_artifact_id_pull_request_review_artifact_id_fk" FOREIGN KEY ("review_artifact_id") REFERENCES "public"."pull_request_review_artifact"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_request_review_artifact" ADD CONSTRAINT "pull_request_review_artifact_event_id_pull_request_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."pull_request_event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pull_request_review_artifact" ADD CONSTRAINT "pull_request_review_artifact_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE no action ON UPDATE no action;