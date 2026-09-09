CREATE TABLE "ingest_job_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"ingest_job_id" uuid NOT NULL,
	"filename" text NOT NULL,
	"content_type" text DEFAULT '' NOT NULL,
	"object_key" text,
	"extracted_text" text,
	"sample_image_key" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingest_job_files" ADD CONSTRAINT "ingest_job_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_job_files" ADD CONSTRAINT "ingest_job_files_ingest_job_id_ingest_jobs_id_fk" FOREIGN KEY ("ingest_job_id") REFERENCES "public"."ingest_jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_job_files" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingest_job_files" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
DROP POLICY IF EXISTS "ingest_job_files_isolation" ON "ingest_job_files";--> statement-breakpoint
CREATE POLICY "ingest_job_files_isolation" ON "ingest_job_files" FOR ALL TO PUBLIC USING (organization_id = app_current_organization_id()) WITH CHECK (organization_id = app_current_organization_id());