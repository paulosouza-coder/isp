CREATE TABLE IF NOT EXISTS "access_policies" (
	"role_id" uuid NOT NULL,
	"module" text NOT NULL,
	"level" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid,
	CONSTRAINT "access_policies_role_id_module_pk" PRIMARY KEY("role_id","module"),
	CONSTRAINT "access_module_ck" CHECK (module in ('inicio','leads','oportunidades','clientes','atividades','relatorios','campanhas','inteligencia','configuracoes')),
	CONSTRAINT "access_level_ck" CHECK (level in ('nenhum','proprio','equipe','total'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "brand_assets" (
	"tenant_id" uuid NOT NULL,
	"slot" text NOT NULL,
	"mime" text NOT NULL,
	"data" "bytea" NOT NULL,
	"size_bytes" integer NOT NULL,
	"sha256" text NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_assets_tenant_id_slot_pk" PRIMARY KEY("tenant_id","slot")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" text NOT NULL,
	"line" text,
	"segment" text DEFAULT 'residencial' NOT NULL,
	"price_cents" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"source_system" text DEFAULT 'catalogo_manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plans_price_ck" CHECK (price_cents >= 0)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_avatars" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"mime" text NOT NULL,
	"data" "bytea" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" DROP CONSTRAINT "activities_type_ck";--> statement-breakpoint
ALTER TABLE "customers" DROP CONSTRAINT "customers_lifecycle_ck";--> statement-breakpoint
ALTER TABLE "opportunities" DROP CONSTRAINT "opp_stage_ck";--> statement-breakpoint
ALTER TABLE "opportunities" ALTER COLUMN "stage" SET DEFAULT 'novo_lead';--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "segment" text DEFAULT 'residencial' NOT NULL;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN "city" text;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "plan_id" uuid;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "contract_start" date;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "next_due_on" date;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "channel" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "last_interaction_note" text;--> statement-breakpoint
ALTER TABLE "opportunities" ADD COLUMN "plan_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "job_title" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "goal_sales" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "goal_proposals" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "goal_leads" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "access_policies" ADD CONSTRAINT "access_policies_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "brand_assets" ADD CONSTRAINT "brand_assets_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "plans" ADD CONSTRAINT "plans_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "user_avatars" ADD CONSTRAINT "user_avatars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "plans_tenant_name_uq" ON "plans" USING btree ("tenant_id","name");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "contacts" ADD CONSTRAINT "contacts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "customers" ADD CONSTRAINT "customers_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "contacts_tenant_owner_idx" ON "contacts" USING btree ("tenant_id","owner_id");--> statement-breakpoint
-- Dados: novas etapas do funil Yepnet. Eventos antigos (append-only) mantêm os valores originais.
UPDATE "opportunities" SET "stage" = CASE "stage"
  WHEN 'novo' THEN 'novo_lead' WHEN 'descoberta' THEN 'qualificacao' WHEN 'retorno' THEN 'qualificacao'
  WHEN 'oferta' THEN 'proposta' WHEN 'negociacao' THEN 'fechamento' ELSE "stage" END;--> statement-breakpoint
UPDATE "activities" SET "type" = 'ligacao' WHERE "type" = 'retorno';--> statement-breakpoint
UPDATE "pipeline_stages" SET "active" = false WHERE "key" NOT IN ('qualificacao','ganha','perdida');--> statement-breakpoint
UPDATE "pipeline_stages" SET "key" = 'x_' || "key" WHERE "key" NOT IN ('qualificacao','ganha','perdida');--> statement-breakpoint
INSERT INTO "pipeline_stages" ("tenant_id","key","name","position","is_terminal")
  SELECT t."id", v.key, v.name, v.pos, v.term FROM "tenants" t CROSS JOIN (VALUES
    ('novo_lead','Novo lead',0,false),('cobertura','Cobertura',2,false),('proposta','Proposta',3,false),('fechamento','Fechamento',4,false)) AS v(key,name,pos,term)
  ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "pipeline_stages" SET "position" = 1 WHERE "key" = 'qualificacao';--> statement-breakpoint
UPDATE "pipeline_stages" SET "position" = 5, "name" = 'Venda fechada' WHERE "key" = 'ganha';--> statement-breakpoint
UPDATE "pipeline_stages" SET "position" = 6, "name" = 'Perdido' WHERE "key" = 'perdida';--> statement-breakpoint
DELETE FROM "pipeline_stages" WHERE "key" LIKE 'x\_%';--> statement-breakpoint
-- Perfis: gestor e admin viram Gerência; demais perfis antigos ficam com acesso mínimo (menor privilégio).
UPDATE "roles" SET "key" = 'gerencia', "name" = 'Gerência' WHERE "key" = 'gestor';--> statement-breakpoint
UPDATE "user_roles" ur SET "role_id" = g."id" FROM "roles" a JOIN "roles" g ON g."tenant_id" = a."tenant_id" AND g."key" = 'gerencia'
  WHERE ur."role_id" = a."id" AND a."key" = 'admin' AND NOT EXISTS (SELECT 1 FROM "user_roles" x WHERE x."user_id" = ur."user_id" AND x."role_id" = g."id");--> statement-breakpoint
INSERT INTO "access_policies" ("role_id","module","level")
  SELECT r."id", m.module, CASE
    WHEN r."key" = 'gerencia' OR r."key" = 'admin' THEN 'total'
    WHEN r."key" = 'supervisor' THEN CASE WHEN m.module = 'configuracoes' THEN 'nenhum' ELSE 'equipe' END
    WHEN r."key" = 'vendedor' THEN CASE WHEN m.module IN ('campanhas','inteligencia','configuracoes') THEN 'nenhum' ELSE 'proprio' END
    ELSE CASE WHEN m.module = 'inicio' THEN 'proprio' ELSE 'nenhum' END END
  FROM "roles" r CROSS JOIN (VALUES ('inicio'),('leads'),('oportunidades'),('clientes'),('atividades'),('relatorios'),('campanhas'),('inteligencia'),('configuracoes')) AS m(module)
  ON CONFLICT DO NOTHING;--> statement-breakpoint
-- Carteira: o responsável do contato passa a ser o dono da oportunidade/lead mais recente.
UPDATE "contacts" c SET "owner_id" = COALESCE(
  (SELECT o."owner_id" FROM "opportunities" o WHERE o."contact_id" = c."id" ORDER BY o."updated_at" DESC LIMIT 1),
  (SELECT l."owner_id" FROM "leads" l WHERE l."contact_id" = c."id" ORDER BY l."updated_at" DESC LIMIT 1));--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_type_ck" CHECK (type in ('tarefa','ligacao','reuniao','email','whatsapp','visita'));--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_segment_ck" CHECK (segment in ('residencial','empresarial','governamental','institucional'));--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_lifecycle_ck" CHECK (lifecycle in ('prospect','em_implantacao','ativo','inadimplente','suspenso','cancelado','reativado'));--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opp_stage_ck" CHECK (stage in ('novo_lead','qualificacao','cobertura','proposta','fechamento','ganha','perdida'));