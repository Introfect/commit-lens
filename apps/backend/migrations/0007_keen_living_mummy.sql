ALTER TABLE "user" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "github_login" text;--> statement-breakpoint
UPDATE "user" SET "github_login" = CONCAT('legacy-', "id") WHERE "github_login" IS NULL;--> statement-breakpoint
ALTER TABLE "user" ALTER COLUMN "github_login" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_github_login_unique" UNIQUE("github_login");
