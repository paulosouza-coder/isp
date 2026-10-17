-- Defesa em profundidade: eventos e auditoria são append-only no próprio banco.
-- Correções viram novos eventos; a aplicação nunca atualiza nem apaga histórico.
CREATE OR REPLACE FUNCTION isp_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Tabela % é append-only (operação % bloqueada)', TG_TABLE_NAME, TG_OP
    USING ERRCODE = 'check_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER opportunity_events_append_only BEFORE UPDATE OR DELETE ON opportunity_events
  FOR EACH ROW EXECUTE FUNCTION isp_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER activity_events_append_only BEFORE UPDATE OR DELETE ON activity_events
  FOR EACH ROW EXECUTE FUNCTION isp_forbid_mutation();
--> statement-breakpoint
CREATE TRIGGER audit_logs_append_only BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION isp_forbid_mutation();
