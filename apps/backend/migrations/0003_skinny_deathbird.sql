CREATE TABLE "pull_request_event" (
	"id" text PRIMARY KEY NOT NULL,
	"repository_id" text NOT NULL,
	"pr_number" text NOT NULL,
	"action" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"author" text NOT NULL,
	"author_avatar_url" text,
	"base_branch" text NOT NULL,
	"head_branch" text NOT NULL,
	"head_sha" text NOT NULL,
	"state" text NOT NULL,
	"merged" text DEFAULT 'false' NOT NULL,
	"html_url" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repository" (
	"id" text PRIMARY KEY NOT NULL,
	"installation_id" text NOT NULL,
	"name" text NOT NULL,
	"full_name" text NOT NULL,
	"owner" text NOT NULL,
	"description" text,
	"is_private" text DEFAULT 'false' NOT NULL,
	"default_branch" text,
	"html_url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pull_request_event" ADD CONSTRAINT "pull_request_event_repository_id_repository_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repository"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository" ADD CONSTRAINT "repository_installation_id_repository_installation_installation_id_fk" FOREIGN KEY ("installation_id") REFERENCES "public"."repository_installation"("installation_id") ON DELETE no action ON UPDATE no action;