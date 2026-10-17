/**
 * Catálogo de permissões granulares. O backend é a única autoridade:
 * o frontend usa esta lista apenas para esconder o que o usuário não pode fazer.
 * Negar por padrão: qualquer permissão não concedida explicitamente é negada.
 */
export const PERMISSIONS = [
  'dashboard.read',
  'lead.read',
  'lead.read_all', // ler leads de toda a equipe/tenant, não só os próprios
  'lead.create',
  'lead.update',
  'lead.assign',
  'opportunity.read',
  'opportunity.read_all',
  'opportunity.create',
  'opportunity.update',
  'opportunity.assign',
  'opportunity.reopen',
  'activity.read',
  'activity.read_all',
  'activity.create',
  'activity.update',
  'customer.read',
  'customer.pii.read', // ver contato sem máscara
  'customer.create',
  'campaign.read',
  'campaign.manage',
  'finance.read',
  'analytics.read',
  'integration.read',
  'integration.manage',
  'playbook.read',
  'playbook.publish',
  'settings.read',
  'user.manage',
  'audit.read',
  'export.data',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_KEYS = ['vendedor', 'supervisor', 'gestor', 'analista', 'financeiro', 'admin'] as const;
export type RoleKey = (typeof ROLE_KEYS)[number];

const vendedor: Permission[] = [
  'dashboard.read',
  'lead.read', 'lead.create', 'lead.update',
  'opportunity.read', 'opportunity.create', 'opportunity.update',
  'activity.read', 'activity.create', 'activity.update',
  'customer.read', 'customer.pii.read', 'customer.create',
  'campaign.read', 'playbook.read',
];

const supervisor: Permission[] = [
  ...vendedor,
  'lead.read_all', 'lead.assign',
  'opportunity.read_all', 'opportunity.assign', 'opportunity.reopen',
  'activity.read_all',
  'analytics.read', 'export.data',
];

const gestor: Permission[] = [
  ...supervisor,
  'campaign.manage', 'finance.read', 'playbook.publish', 'settings.read', 'integration.read',
];

/** Marketing/analista: origem, campanha e conversão — sem PII nem edição comercial. */
const analista: Permission[] = [
  'dashboard.read', 'lead.read', 'lead.read_all', 'opportunity.read', 'opportunity.read_all',
  'customer.read', 'campaign.read', 'campaign.manage', 'analytics.read', 'finance.read',
];

const financeiro: Permission[] = [
  'dashboard.read', 'customer.read', 'customer.pii.read', 'opportunity.read', 'opportunity.read_all',
  'finance.read', 'analytics.read', 'integration.read',
];

const admin: Permission[] = [...PERMISSIONS];

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleKey, Permission[]> = {
  vendedor,
  supervisor,
  gestor,
  analista,
  financeiro,
  admin,
};

export const ROLE_LABELS: Record<RoleKey, string> = {
  vendedor: 'Vendedor',
  supervisor: 'Supervisor',
  gestor: 'Gestor comercial',
  analista: 'Marketing / Analista',
  financeiro: 'Operações / Financeiro',
  admin: 'Administrador',
};

export function hasPermission(granted: ReadonlySet<string> | readonly string[], p: Permission): boolean {
  const set = granted instanceof Set ? granted : new Set(granted as readonly string[]);
  return set.has(p);
}

export function isPermission(v: string): v is Permission {
  return (PERMISSIONS as readonly string[]).includes(v);
}
