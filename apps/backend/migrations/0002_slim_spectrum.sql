CREATE TABLE "oauth_account" (
	"provider_id" text NOT NULL,
	"provider_user_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "oauth_account_provider_id_provider_user_id_pk" PRIMARY KEY("provider_id","provider_user_id")
);
--> statement-breakpoint
CREATE TABLE "repository_installation" (
	"installation_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_login" text NOT NULL,
	"account_avatar_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "user_email_key";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "avatar_url" text;--> statement-breakpoint
ALTER TABLE "oauth_account" ADD CONSTRAINT "oauth_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repository_installation" ADD CONSTRAINT "repository_installation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- ALTER TABLE "user" DROP COLUMN "company";--> statement-breakpoint
-- ALTER TABLE "user" DROP COLUMN "password_hash";--> statement-breakpoint
-- ALTER TABLE "user" DROP COLUMN "is_active";--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_email_unique" UNIQUE("email");