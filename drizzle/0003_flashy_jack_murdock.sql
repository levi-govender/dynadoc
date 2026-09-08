CREATE TYPE "public"."document_type_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_type_id" uuid,
	"kind" text NOT NULL,
	"object_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_families" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"discriminator" jsonb,
	"shared_field_groups" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_families_org_slug" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "document_type_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_type_id" uuid NOT NULL,
	"version_number" integer NOT NULL,
	"form_schema" jsonb NOT NULL,
	"template" jsonb NOT NULL,
	"style_theme" jsonb NOT NULL,
	"expression_dialect_version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_type_versions_type_number" UNIQUE("document_type_id","version_number")
);
--> statement-breakpoint
CREATE TABLE "document_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"family_id" uuid,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"status" "document_type_status" DEFAULT 'draft' NOT NULL,
	"current_published_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "document_types_org_slug" UNIQUE("organization_id","slug")
);
--> statement-breakpoint
CREATE TABLE "ingest_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instances" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"document_type_version_id" uuid NOT NULL,
	"answers" jsonb NOT NULL,
	"resolved_ast" jsonb NOT NULL,
	"issued_pdf_key" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assets" ADD CONSTRAINT "assets_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_families" ADD CONSTRAINT "document_families_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_type_versions" ADD CONSTRAINT "document_type_versions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_type_versions" ADD CONSTRAINT "document_type_versions_document_type_id_document_types_id_fk" FOREIGN KEY ("document_type_id") REFERENCES "public"."document_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_family_id_document_families_id_fk" FOREIGN KEY ("family_id") REFERENCES "public"."document_families"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingest_jobs" ADD CONSTRAINT "ingest_jobs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instances" ADD CONSTRAINT "instances_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instances" ADD CONSTRAINT "instances_document_type_version_id_document_type_versions_id_fk" FOREIGN KEY ("document_type_version_id") REFERENCES "public"."document_type_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instances" ADD CONSTRAINT "instances_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_types" ADD CONSTRAINT "document_types_current_published_version_id_fk" FOREIGN KEY ("current_published_version_id") REFERENCES "public"."document_type_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_families" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_families" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "document_families_isolation" ON "document_families" FOR ALL TO PUBLIC USING (organization_id = current_setting('app.organization_id')::uuid) WITH CHECK (organization_id = current_setting('app.organization_id')::uuid);--> statement-breakpoint
ALTER TABLE "document_types" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_types" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "document_types_isolation" ON "document_types" FOR ALL TO PUBLIC USING (organization_id = current_setting('app.organization_id')::uuid) WITH CHECK (organization_id = current_setting('app.organization_id')::uuid);--> statement-breakpoint
ALTER TABLE "document_type_versions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "document_type_versions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "document_type_versions_isolation" ON "document_type_versions" FOR ALL TO PUBLIC USING (organization_id = current_setting('app.organization_id')::uuid) WITH CHECK (organization_id = current_setting('app.organization_id')::uuid);--> statement-breakpoint
ALTER TABLE "instances" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "instances" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "instances_isolation" ON "instances" FOR ALL TO PUBLIC USING (organization_id = current_setting('app.organization_id')::uuid) WITH CHECK (organization_id = current_setting('app.organization_id')::uuid);--> statement-breakpoint
ALTER TABLE "assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "assets" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "assets_isolation" ON "assets" FOR ALL TO PUBLIC USING (organization_id = current_setting('app.organization_id')::uuid) WITH CHECK (organization_id = current_setting('app.organization_id')::uuid);--> statement-breakpoint
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "notifications" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "notifications_isolation" ON "notifications" FOR ALL TO PUBLIC USING (organization_id = current_setting('app.organization_id')::uuid) WITH CHECK (organization_id = current_setting('app.organization_id')::uuid);--> statement-breakpoint
ALTER TABLE "ingest_jobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "ingest_jobs" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "ingest_jobs_isolation" ON "ingest_jobs" FOR ALL TO PUBLIC USING (organization_id = current_setting('app.organization_id')::uuid) WITH CHECK (organization_id = current_setting('app.organization_id')::uuid);