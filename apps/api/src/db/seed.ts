/**
 * Seed 100% FICTÍCIA e determinística (spec §11): nenhum dado real.
 * Telefones usam DDD 00 (inexistente) e e-mails o domínio reservado .test.
 * Datas são relativas ao momento da execução para que o dashboard tenha dados "recentes".
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_ROLE_PERMISSIONS, ROLE_KEYS, ROLE_LABELS, OPPORTUNITY_STAGES, STAGE_LABELS, TERMINAL_STAGES } from '@isp/domain';
import { createDb, type DB } from './client';
import * as s from './schema';
import { hashPassword } from '../auth/password';

export const SEED_PASSWORD = 'Sprint@2026';

function rng(seed = 42) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elisa', 'Fábio', 'Gabriela', 'Heitor', 'Isabela', 'João', 'Karina', 'Lucas', 'Marina', 'Nicolas', 'Olívia', 'Paulo', 'Quésia', 'Rafael', 'Sofia', 'Tiago', 'Úrsula', 'Vítor', 'Wanda', 'Yuri', 'Zélia'];
const LAST = ['Andrade', 'Barreto', 'Cardoso', 'Dantas', 'Esteves', 'Figueiredo', 'Guimarães', 'Henriques', 'Lacerda', 'Moraes', 'Nogueira', 'Oliveira', 'Prado', 'Queiroz', 'Rezende', 'Siqueira', 'Teles', 'Vasconcelos'];
const INTERESTS = ['preço', 'velocidade', 'estabilidade', 'benefícios', 'instalação', 'atendimento', 'Wi-Fi'];
const SOURCES = ['WhatsApp', 'Instagram', 'Site', 'Indicação', 'Ligação ativa', 'Loja', 'Não informada'];
const REASONS = ['oferta', 'problema', 'comparacao', 'satisfeito_aberto', 'nova_instalacao', 'outro'] as const;
const NEXT_ACTIONS = ['Retornar com comparação', 'Verificar cobertura no endereço', 'Enviar condições da oferta', 'Confirmar decisão com cliente', 'Agendar visita técnica'];

export async function seedTenant(db: DB, opts: { name: string; slug: string; users: { name: string; email: string; roles: string[] }[]; volume: number; seed: number }) {
  const r = rng(opts.seed);
  const pick = <T,>(arr: readonly T[]) => arr[Math.floor(r() * arr.length)] as T;
  const now = Date.now();
  const daysAgo = (d: number, h = 0) => new Date(now - d * 86_400_000 - h * 3_600_000);
  const daysAhead = (d: number, h = 0) => new Date(now + d * 86_400_000 + h * 3_600_000);

  const [tenant] = await db.insert(s.tenants).values({ name: opts.name, slug: opts.slug }).returning();
  if (!tenant) throw new Error('tenant');

  const roleIds: Record<string, string> = {};
  for (const key of ROLE_KEYS) {
    const [role] = await db.insert(s.roles).values({ tenantId: tenant.id, key, name: ROLE_LABELS[key], isSystem: true }).returning();
    roleIds[key] = role!.id;
    await db.insert(s.rolePermissions).values(DEFAULT_ROLE_PERMISSIONS[key].map((permission) => ({ roleId: role!.id, permission })));
  }

  const [team] = await db.insert(s.teams).values({ tenantId: tenant.id, name: 'Vendas Residencial' }).returning();
  const passwordHash = await hashPassword(SEED_PASSWORD);
  const users: { id: string; roles: string[] }[] = [];
  for (const u of opts.users) {
    const [user] = await db.insert(s.users).values({ tenantId: tenant.id, name: u.name, email: u.email, passwordHash }).returning();
    users.push({ id: user!.id, roles: u.roles });
    await db.insert(s.userRoles).values(u.roles.map((k) => ({ userId: user!.id, roleId: roleIds[k]! })));
    if (u.roles.some((k) => ['vendedor', 'supervisor'].includes(k))) {
      await db.insert(s.teamMemberships).values({ teamId: team!.id, userId: user!.id, isLead: u.roles.includes('supervisor') });
    }
  }
  const sellers = users.filter((u) => u.roles.includes('vendedor')).map((u) => u.id);
  const anySeller = () => pick(sellers);

  const sources = await db.insert(s.leadSources).values(SOURCES.map((name) => ({ tenantId: tenant.id, name }))).returning();
  const campaignRows = await db
    .insert(s.campaigns)
    .values([
      { tenantId: tenant.id, name: 'Campanha Fibra — Outubro (fictícia)', sourceId: sources[1]!.id, startsOn: daysAgo(20) },
      { tenantId: tenant.id, name: 'Indique um vizinho (fictícia)', sourceId: sources[3]!.id, startsOn: daysAgo(60) },
    ])
    .returning();

  await db.insert(s.pipelineStages).values(
    OPPORTUNITY_STAGES.map((key, i) => ({ tenantId: tenant.id, key, name: STAGE_LABELS[key], position: i, isTerminal: TERMINAL_STAGES.includes(key) })),
  );

  const makeContact = async () => {
    const name = `${pick(FIRST)} ${pick(LAST)}`;
    const digits = String(Math.floor(r() * 90_000_000) + 10_000_000);
    const [c] = await db
      .insert(s.contacts)
      .values({
        tenantId: tenant.id,
        name,
        phone: `(00) 9${digits.slice(0, 4)}-${digits.slice(4)}`,
        email: r() > 0.4 ? `${name.split(' ')[0]!.toLowerCase().normalize('NFD').replace(/[^a-z]/g, '')}${Math.floor(r() * 99)}@exemplo.test` : null,
      })
      .returning();
    return c!;
  };

  // ---------- leads
  const leadStatuses = ['novo', 'novo', 'em_contato', 'em_contato', 'qualificado', 'descartado'] as const;
  for (let i = 0; i < opts.volume; i++) {
    const c = await makeContact();
    const created = daysAgo(Math.floor(r() * 40), Math.floor(r() * 20));
    const status = pick(leadStatuses);
    const contacted = status !== 'novo';
    const first = contacted ? new Date(created.getTime() + r() * 36 * 3_600_000) : null;
    await db.insert(s.leads).values({
      tenantId: tenant.id,
      contactId: c.id,
      status,
      sourceId: pick(sources).id,
      campaignId: r() > 0.6 ? pick(campaignRows).id : null,
      ownerId: r() > 0.15 ? anySeller() : null,
      interests: Array.from(new Set([pick(INTERESTS), ...(r() > 0.5 ? [pick(INTERESTS)] : [])])),
      nextAction: status === 'descartado' ? null : pick(NEXT_ACTIONS),
      nextActionAt: status === 'descartado' ? null : r() > 0.5 ? daysAhead(Math.floor(r() * 5)) : daysAgo(Math.floor(r() * 3)),
      firstContactAt: first,
      lastContactAt: first ? new Date(Math.min(now, first.getTime() + r() * 6 * 86_400_000)) : null,
      createdAt: created,
      updatedAt: created,
    });
  }

  // ---------- oportunidades + eventos
  const stageWeights: (typeof OPPORTUNITY_STAGES)[number][] = ['novo', 'descoberta', 'descoberta', 'qualificacao', 'oferta', 'oferta', 'negociacao', 'negociacao', 'retorno', 'ganha', 'ganha', 'perdida'];
  const opps: { id: string; ownerId: string; contactId: string; stage: string }[] = [];
  for (let i = 0; i < Math.round(opts.volume * 0.8); i++) {
    const c = await makeContact();
    const ownerId = anySeller();
    const created = daysAgo(Math.floor(r() * 45), Math.floor(r() * 20));
    const stage = pick(stageWeights);
    const changed = new Date(Math.min(now, created.getTime() + r() * 10 * 86_400_000));
    const reasons = Array.from(new Set([pick(REASONS), ...(r() > 0.7 ? [pick(REASONS)] : [])]));
    const value = [9990, 11990, 12990, 14990, 19990][Math.floor(r() * 5)]!;
    const terminal = stage === 'ganha' || stage === 'perdida';
    const [o] = await db
      .insert(s.opportunities)
      .values({
        tenantId: tenant.id,
        contactId: c.id,
        ownerId,
        teamId: team!.id,
        title: `${c.name.split(' ')[0]} — ${reasons[0] === 'nova_instalacao' ? 'nova instalação' : 'troca de provedor'}`,
        stage,
        reasons,
        sourceId: pick(sources).id,
        campaignId: r() > 0.6 ? pick(campaignRows).id : null,
        valueCents: stage === 'novo' ? null : value,
        coverageStatus: ['oferta', 'negociacao', 'ganha'].includes(stage) ? 'elegivel' : stage === 'perdida' && r() > 0.5 ? 'inelegivel' : 'nao_consultada',
        proposalStatus: stage === 'ganha' ? 'aceita' : stage === 'negociacao' ? 'enviada' : 'nao_criada',
        // nenhuma oportunidade da seed tem contrato confirmado: isso exige confirmação externa (Fase 6)
        contractRequestStatus: stage === 'ganha' ? 'pendente' : 'nao_solicitada',
        nextAction: terminal ? null : pick(NEXT_ACTIONS),
        nextActionAt: terminal ? null : r() > 0.35 ? daysAhead(Math.floor(r() * 6), Math.floor(r() * 8)) : daysAgo(Math.floor(r() * 4) + 1),
        lossReason: stage === 'perdida' ? pick(['preco', 'sem_cobertura', 'satisfeito_atual', 'sem_resposta']) : null,
        wonAt: stage === 'ganha' ? changed : null,
        lostAt: stage === 'perdida' ? changed : null,
        stageChangedAt: changed,
        sprintElapsedSeconds: Math.floor(180 + r() * 420),
        createdBy: ownerId,
        createdAt: created,
        updatedAt: changed,
      })
      .returning();
    opps.push({ id: o!.id, ownerId, contactId: c.id, stage });
    await db.insert(s.opportunityEvents).values({ tenantId: tenant.id, opportunityId: o!.id, type: 'created', actorId: ownerId, toValue: 'novo', rowVersion: 1, occurredAt: created, observedAt: created });
    if (stage !== 'novo') {
      await db.insert(s.opportunityEvents).values({ tenantId: tenant.id, opportunityId: o!.id, type: 'stage_changed', actorId: ownerId, fromValue: 'novo', toValue: stage, rowVersion: 1, occurredAt: changed, observedAt: changed });
    }
  }

  // ---------- clientes "importados" (fictícios): mostram a distinção contato × cliente e o aviso de dados desatualizados.
  // source_system = 'seed_ficticio' deixa explícito que NÃO vieram do IXC.
  const lifecycles = ['ativo', 'ativo', 'ativo', 'suspenso', 'cancelado', 'reativado'] as const;
  for (let i = 0; i < Math.max(3, Math.round(opts.volume / 6)); i++) {
    const c = await makeContact();
    const ext = `FIC-${opts.seed}${String(1000 + i)}`;
    const ingested = i % 3 === 0 ? daysAgo(3) : daysAgo(0, 2);
    const [cust] = await db
      .insert(s.customers)
      .values({ tenantId: tenant.id, contactId: c.id, displayName: c.name, lifecycle: lifecycles[i % lifecycles.length]!, sourceSystem: 'seed_ficticio', externalId: ext, sourceUpdatedAt: ingested, ingestedAt: ingested })
      .returning();
    await db.insert(s.customerExternalIds).values({ tenantId: tenant.id, customerId: cust!.id, system: 'seed_ficticio', externalId: ext });
    await db.insert(s.addresses).values({ tenantId: tenant.id, contactId: c.id, customerId: cust!.id, street: 'Rua Fictícia', number: String(10 + i * 7), district: pick(['Centro', 'Bairro Exemplo', 'Jardim Teste']), city: 'Cidade Exemplo', state: 'XX' });
  }

  // ---------- atividades (atrasadas, hoje, futuras, concluídas)
  const types = ['retorno', 'ligacao', 'tarefa', 'visita', 'reuniao'] as const;
  for (const o of opps.filter((x) => !['ganha', 'perdida'].includes(x.stage))) {
    const n = 1 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const bucket = r();
      const due = bucket < 0.25 ? daysAgo(1 + Math.floor(r() * 3)) : bucket < 0.5 ? new Date(new Date().setHours(9 + Math.floor(r() * 9), 0, 0, 0)) : daysAhead(1 + Math.floor(r() * 6));
      const done = bucket > 0.85;
      const type = pick(types);
      await db.insert(s.activities).values({
        tenantId: tenant.id,
        type,
        title: type === 'retorno' ? 'Retornar ao cliente com comparação' : type === 'visita' ? 'Visita de viabilidade' : type === 'ligacao' ? 'Ligar para confirmar interesse' : 'Preparar condições da oferta',
        dueAt: due,
        priority: pick(['baixa', 'media', 'media', 'alta'] as const),
        ownerId: o.ownerId,
        opportunityId: o.id,
        contactId: o.contactId,
        completedAt: done ? new Date(due.getTime() - 3_600_000) : null,
        completedBy: done ? o.ownerId : null,
        createdBy: o.ownerId,
      });
    }
  }

  return { tenant, users };
}

export async function seed(url: string) {
  const { db, pool } = createDb(url);
  try {
    await seedTenant(db, {
      name: 'Provedor Exemplo Fibra (fictício)',
      slug: 'exemplo',
      seed: 42,
      volume: 48,
      users: [
        { name: 'Admin Exemplo', email: 'admin@exemplo.test', roles: ['admin'] },
        { name: 'Gestora Comercial', email: 'gestor@exemplo.test', roles: ['gestor'] },
        { name: 'Sérgio Supervisor', email: 'supervisor@exemplo.test', roles: ['supervisor', 'vendedor'] },
        { name: 'Ana Vendedora', email: 'ana@exemplo.test', roles: ['vendedor'] },
        { name: 'Bruno Vendedor', email: 'bruno@exemplo.test', roles: ['vendedor'] },
        { name: 'Marta Marketing', email: 'analista@exemplo.test', roles: ['analista'] },
        { name: 'Fábio Financeiro', email: 'financeiro@exemplo.test', roles: ['financeiro'] },
      ],
    });
    await seedTenant(db, {
      name: 'Outro Provedor (fictício — teste de isolamento)',
      slug: 'outro',
      seed: 7,
      volume: 6,
      users: [{ name: 'Vendedor Outro', email: 'vendedor@outro.test', roles: ['vendedor'] }],
    });
  } finally {
    await pool.end();
  }
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL não definido');
  seed(url)
    .then(() => console.log(`Seed fictícia criada. Senha de todos os usuários de demo: ${SEED_PASSWORD}`))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
