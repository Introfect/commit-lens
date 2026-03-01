ALTER TABLE "repository_installation" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "repository" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
ALTER TABLE "pull_request_event" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;
