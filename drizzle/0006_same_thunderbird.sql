ALTER TABLE "document_types" ADD COLUMN "draft_snapshot" jsonb;--> statement-breakpoint
ALTER TABLE "document_types" ADD COLUMN "published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "document_types" ADD COLUMN "published_by" text;--> statement-breakpoint
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;