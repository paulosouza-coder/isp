CREATE TABLE IF NOT EXISTS "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"due_at" timestamp with time zone,
	"priority" text DEFAULT 'media' NOT NULL,
	"owner_id" uuid NOT NULL,
	"opportunity_id" uuid,
	"lead_id" uuid,
	"contact_id" uuid,
	"completed_at" timestamp with time zone,
	"completed_by" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "activities_type_ck" CHECK (type in ('tarefa','retorno','ligacao','reuniao','visita','email')),
	CONSTRAINT "activities_priority_ck" CHECK (priority in ('baixa','media','alta'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "activity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor_id" uuid,
	"payload" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid,
	"customer_id" uuid,
	"street" text,
	"number" text,
	"complement" text,
	"district" text,
	"city" text,
	"state" text,
	"postal_code" text,
	"valid_from" timestamp with time zone DEFAULT now() NOT NULL,
	"valid_to" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"request_id" text,
	"ip" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"source_id" uuid,
	"name" text NOT NULL,
	"starts_on" timestamp with time zone,
	"ends_on" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"created_by" uuid,
	"is_provisional" boolean DEFAULT false NOT NULL,
	"source_system" text DEFAULT 'crm' NOT NULL,
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customer_external_ids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"customer_id" uuid NOT NULL,
	"system" text NOT NULL,
	"external_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"lifecycle" text DEFAULT 'prospect' NOT NULL,
	"source_system" text DEFAULT 'crm' NOT NULL,
	"external_id" text,
	"source_updated_at" timestamp with time zone,
	"ingested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "customers_lifecycle_ck" CHECK (lifecycle in ('prospect','ativo','suspenso','cancelado','reativado'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lead_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "leads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"status" text DEFAULT 'novo' NOT NULL,
	"source_id" uuid,
	"campaign_id" uuid,
	"owner_id" uuid,
	"interests" text[] DEFAULT '{}'::text[] NOT NULL,
	"next_action" text,
	"next_action_at" timestamp with time zone,
	"first_contact_at" timestamp with time zone,
	"last_contact_at" timestamp with time zone,
	"notes" text,
	"converted_opportunity_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "leads_status_ck" CHECK (status in ('novo','em_contato','qualificado','convertido','descartado'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "opportunities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"code" serial NOT NULL,
	"contact_id" uuid NOT NULL,
	"customer_id" uuid,
	"lead_id" uuid,
	"owner_id" uuid NOT NULL,
	"team_id" uuid,
	"title" text NOT NULL,
	"stage" text DEFAULT 'novo' NOT NULL,
	"proposal_status" text DEFAULT 'nao_criada' NOT NULL,
	"contract_request_status" text DEFAULT 'nao_solicitada' NOT NULL,
	"coverage_status" text DEFAULT 'nao_consultada' NOT NULL,
	"reasons" text[] DEFAULT '{}'::text[] NOT NULL,
	"channel" text,
	"source_id" uuid,
	"campaign_id" uuid,
	"value_cents" bigint,
	"next_action" text,
	"next_action_at" timestamp with time zone,
	"notes" text,
	"loss_reason" text,
	"stage_changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"won_at" timestamp with time zone,
	"lost_at" timestamp with time zone,
	"sprint_started_at" timestamp with time zone,
	"sprint_elapsed_seconds" integer DEFAULT 0 NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"row_version" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "opp_stage_ck" CHECK (stage in ('novo','descoberta','qualificacao','oferta','negociacao','retorno','ganha','perdida')),
	CONSTRAINT "opp_proposal_ck" CHECK (proposal_status in ('nao_criada','rascunho','enviada','aceita','recusada','expirada')),
	CONSTRAINT "opp_contract_ck" CHECK (contract_request_status in ('nao_solicitada','pendente','enviada','erro','confirmada','rejeitada')),
	CONSTRAINT "opp_coverage_ck" CHECK (coverage_status in ('nao_consultada','pendente','elegivel','inelegivel','indeterminada')),
	CONSTRAINT "opp_value_ck" CHECK (value_cents is null or value_cents >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "opportunity_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"opportunity_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor_id" uuid,
	"from_value" text,
	"to_value" text,
	"reason" text,
	"payload" jsonb,
	"row_version" integer,
	"source_system" text DEFAULT 'crm' NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pipeline_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"position" integer NOT NULL,
	"is_terminal" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "role_permissions" (
	"role_id" uuid NOT NULL,
	"permission" text NOT NULL,
	CONSTRAINT "role_permissions_role_id_permission_pk" PRIMARY KEY("role_id","permission")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tenant_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"user_agent" text,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "team_memberships" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"is_lead" boolean DEFAULT false NOT NULL,
	CONSTRAINT "team_memberships_team_id_user_id_pk" PRIMARY KEY("team_id","user_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "teams" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_roles" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	CONSTRAINT "user_roles_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activities" ADD CONSTRAINT "activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "activity_events" ADD CONSTRAINT "activity_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "addresses" ADD CONSTRAINT "addresses_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "addresses" ADD CONSTRAINT "addresses_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "addresses" ADD CONSTRAINT "addresses_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_source_id_lead_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."lead_sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contacts" ADD CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contacts" ADD CONSTRAINT "contacts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_external_ids" ADD CONSTRAINT "customer_external_ids_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customer_external_ids" ADD CONSTRAINT "customer_external_ids_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customers" ADD CONSTRAINT "customers_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customers" ADD CONSTRAINT "customers_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lead_sources" ADD CONSTRAINT "lead_sources_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_source_id_lead_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."lead_sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "leads" ADD CONSTRAINT "leads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_source_id_lead_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."lead_sources"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunity_events" ADD CONSTRAINT "opportunity_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunity_events" ADD CONSTRAINT "opportunity_events_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunity_events" ADD CONSTRAINT "opportunity_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pipeline_stages" ADD CONSTRAINT "pipeline_stages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "teams" ADD CONSTRAINT "teams_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_owner_due_idx" ON "activities" USING btree ("tenant_id","owner_id","due_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activities_opp_idx" ON "activities" USING btree ("tenant_id","opportunity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "activity_events_act_idx" ON "activity_events" USING btree ("tenant_id","activity_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "addresses_contact_idx" ON "addresses" USING btree ("tenant_id","contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_tenant_created_idx" ON "audit_logs" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "campaigns_tenant_name_uq" ON "campaigns" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_tenant_name_idx" ON "contacts" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_ext_uq" ON "contacts" USING btree ("tenant_id","source_system","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customer_ext_ids_uq" ON "customer_external_ids" USING btree ("tenant_id","system","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "customers_ext_uq" ON "customers" USING btree ("tenant_id","source_system","external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "customers_contact_idx" ON "customers" USING btree ("tenant_id","contact_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "lead_sources_tenant_name_uq" ON "lead_sources" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_tenant_created_idx" ON "leads" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leads_tenant_owner_idx" ON "leads" USING btree ("tenant_id","owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "opp_code_uq" ON "opportunities" USING btree ("code");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opp_tenant_stage_idx" ON "opportunities" USING btree ("tenant_id","stage");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opp_tenant_owner_idx" ON "opportunities" USING btree ("tenant_id","owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opp_tenant_updated_idx" ON "opportunities" USING btree ("tenant_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opp_contact_idx" ON "opportunities" USING btree ("tenant_id","contact_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "opp_events_opp_idx" ON "opportunity_events" USING btree ("tenant_id","opportunity_id","occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "pipeline_stages_uq" ON "pipeline_stages" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "roles_tenant_key_uq" ON "roles" USING btree ("tenant_id","key");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "teams_tenant_name_uq" ON "teams" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_uq" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_tenant_idx" ON "users" USING btree ("tenant_id");