ALTER TABLE "user" DROP COLUMN IF EXISTS "company";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "password_hash";--> statement-breakpoint
ALTER TABLE "user" DROP COLUMN IF EXISTS "is_active";
