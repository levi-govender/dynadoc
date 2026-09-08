CREATE TABLE "tenant_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"note" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tenant_records" ADD CONSTRAINT "tenant_records_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_records" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "tenant_records_isolation" ON "tenant_records" FOR ALL TO PUBLIC USING (organization_id = current_setting('app.organization_id')::uuid) WITH CHECK (organization_id = current_setting('app.organization_id')::uuid);