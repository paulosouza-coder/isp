import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { login, makeApp, ORIGIN, type Client } from './helpers';

let ctx: Awaited<ReturnType<typeof makeApp>>;
let ana: Client, bruno: Client, supervisor: Client, analista: Client, outro: Client;

beforeAll(async () => {
  ctx = await makeApp();
  [ana, bruno, supervisor, analista, outro] = await Promise.all([
    login(ctx.app, 'ana@exemplo.test'),
    login(ctx.app, 'bruno@exemplo.test'),
    login(ctx.app, 'supervisor@exemplo.test'),
    login(ctx.app, 'analista@exemplo.test'),
    login(ctx.app, 'vendedor@outro.test'),
  ]);
});
afterAll(async () => ctx.close());

const newOpp = (c: Client, extra: Record<string, unknown> = {}) =>
  c.post('/opportunities', { newContact: { name: 'Cliente Teste Fictício', phone: '(00) 91234-5678' }, reasons: ['oferta'], channel: 'telefone', ...extra });

describe('autenticação', () => {
  it('sem sessão responde 401 em problem+json', async () => {
    const r = await ctx.app.inject({ method: 'GET', url: '/api/v1/me' });
    expect(r.statusCode).toBe(401);
    expect(r.headers['content-type']).toContain('application/problem+json');
    expect(r.json().requestId).toBeTruthy();
  });

  it('senha errada é 401 genérico; cookie de sessão é httpOnly', async () => {
    const bad = await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: ORIGIN }, payload: { email: 'gestor@exemplo.test', password: 'errada' } });
    expect(bad.statusCode).toBe(401);
    const ok = await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: ORIGIN }, payload: { email: 'gestor@exemplo.test', password: 'Sprint@2026' } });
    expect(ok.statusCode).toBe(200);
    const cookie = String(ok.headers['set-cookie']);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it('logout revoga a sessão no servidor', async () => {
    const c = await login(ctx.app, 'financeiro@exemplo.test');
    expect((await c.get('/me')).statusCode).toBe(200);
    expect((await c.post('/auth/logout')).statusCode).toBe(204);
    expect((await c.get('/me')).statusCode).toBe(401);
  });

  it('bloqueia a conta após 5 falhas seguidas', async () => {
    for (let i = 0; i < 5; i++) {
      await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: ORIGIN }, payload: { email: 'admin@exemplo.test', password: `x${i}` } });
    }
    const r = await ctx.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: ORIGIN }, payload: { email: 'admin@exemplo.test', password: 'Sprint@2026' } });
    expect(r.statusCode).toBe(423);
    await ctx.db.execute(sql`update users set failed_logins = 0, locked_until = null where email = 'admin@exemplo.test'`);
  });

  it('limita tentativas de login por minuto (429)', async () => {
    const strict = await makeApp({ LOGIN_RATE_LIMIT_PER_MINUTE: '3' });
    const codes: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await strict.app.inject({ method: 'POST', url: '/api/v1/auth/login', headers: { origin: ORIGIN }, payload: { email: 'ninguem@exemplo.test', password: 'x' } });
      codes.push(r.statusCode);
    }
    await strict.close();
    expect(codes).toEqual([401, 401, 401, 429]);
  });

  it('CSRF: origem não permitida é bloqueada antes da rota', async () => {
    const r = await ctx.app.inject({ method: 'POST', url: '/api/v1/opportunities', headers: { cookie: ana.cookie, origin: 'https://atacante.test' }, payload: {} });
    expect(r.statusCode).toBe(403);
  });

  it('senhas e cookies não aparecem na trilha de auditoria', async () => {
    const rows = await ctx.db.execute(sql`select metadata::text m from audit_logs where action like 'auth.%'`);
    const dump = rows.rows.map((r) => String(r.m)).join(' ');
    expect(dump).not.toMatch(/Sprint@2026|isp_session/);
  });
});

describe('isolamento entre empresas (tenant)', () => {
  it('usuário de outra empresa recebe 404 ao ler, editar ou mover oportunidade', async () => {
    const created = (await newOpp(ana)).json();
    expect((await outro.get(`/opportunities/${created.id}`)).statusCode).toBe(404);
    expect((await outro.patch(`/opportunities/${created.id}`, { title: 'invasão', rowVersion: 1 })).statusCode).toBe(404);
    expect((await outro.post(`/opportunities/${created.id}/transition`, { toStage: 'oferta', rowVersion: 1 })).statusCode).toBe(404);
    expect((await outro.get(`/opportunities/${created.id}/timeline`)).statusCode).toBe(404);
    const list = (await outro.get('/opportunities?status=todas&pageSize=100')).json();
    expect(list.items.every((o: { id: string }) => o.id !== created.id)).toBe(true);
  });

  it('não permite vincular contato, origem ou responsável de outra empresa', async () => {
    const lookupsA = (await ana.get('/meta/lookups')).json();
    const r1 = await outro.post('/opportunities', { newContact: { name: 'X Fictício' }, sourceId: lookupsA.sources[0].id });
    expect(r1.statusCode).toBe(422);
    const r2 = await outro.post('/opportunities', { newContact: { name: 'X Fictício' }, ownerId: ana.me.user.id });
    expect(r2.statusCode).toBe(403);
    const contactA = (await ana.get('/customers?pageSize=1')).json().items[0];
    const r3 = await outro.post('/opportunities', { contactId: contactA.id });
    expect(r3.statusCode).toBe(422);
  });

  it('leads, contatos e dashboard não vazam dados entre empresas', async () => {
    const leadsA = (await supervisor.get('/leads?pageSize=100')).json();
    const leadId = leadsA.items[0].id;
    expect((await outro.get(`/leads/${leadId}`)).statusCode).toBe(404);
    const contact = leadsA.items[0].contactId;
    expect((await outro.get(`/contacts/${contact}`)).statusCode).toBe(404);
    const search = (await outro.get(`/contacts?q=${encodeURIComponent(leadsA.items[0].name.split(' ')[0])}`)).json();
    expect(search.items.every((c: { id: string }) => c.id !== contact)).toBe(true);
  });
});

describe('RBAC', () => {
  it('vendedor não vê oportunidade de outro vendedor; supervisor vê', async () => {
    const o = (await newOpp(bruno)).json();
    expect((await ana.get(`/opportunities/${o.id}`)).statusCode).toBe(404);
    expect((await supervisor.get(`/opportunities/${o.id}`)).statusCode).toBe(200);
  });

  it('vendedor não acessa visão de equipe nem atribui a terceiros', async () => {
    expect((await ana.get('/dashboard?scope=equipe')).statusCode).toBe(403);
    expect((await ana.post('/leads', { name: 'Lead Fictício', ownerId: bruno.me.user.id })).statusCode).toBe(403);
    const leads = (await ana.get('/leads?pageSize=1')).json();
    expect((await ana.post('/leads/bulk-assign', { ids: [leads.items[0].id], ownerId: ana.me.user.id })).statusCode).toBe(403);
  });

  it('analista vê telefone mascarado e não cria oportunidade', async () => {
    const list = (await analista.get('/opportunities?pageSize=5')).json();
    expect(list.items.length).toBeGreaterThan(0);
    for (const o of list.items) {
      expect(o.piiMasked).toBe(true);
      if (o.contactPhone) expect(o.contactPhone).toMatch(/^\(••\)/);
    }
    expect((await newOpp(analista)).statusCode).toBe(403);
  });

  it('auditoria é restrita', async () => {
    expect((await ana.get('/audit')).statusCode).toBe(403);
  });
});

describe('oportunidade: criação, edição concorrente e etapas', () => {
  it('cria com contato provisório, owner = usuário e evento de criação', async () => {
    const r = await newOpp(ana);
    expect(r.statusCode).toBe(201);
    const o = r.json();
    expect(o.ownerId).toBe(ana.me.user.id);
    expect(o.stage).toBe('novo');
    expect(o.contactProvisional).toBe(true);
    expect(o.rowVersion).toBe(1);
    expect(o.sprintStartedAt).toBeTruthy();
    const tl = (await ana.get(`/opportunities/${o.id}/timeline`)).json();
    expect(tl.items.some((e: { type: string }) => e.type === 'created')).toBe(true);
  });

  it('exige contato existente OU novo (422 com campo)', async () => {
    const r = await ana.post('/opportunities', { reasons: ['oferta'] });
    expect(r.statusCode).toBe(422);
    expect(r.json().errors[0].path).toBe('contactId');
  });

  it('versão desatualizada gera 409 com a versão atual', async () => {
    const o = (await newOpp(ana)).json();
    expect((await ana.patch(`/opportunities/${o.id}`, { nextAction: 'Ligar amanhã', rowVersion: 1 })).statusCode).toBe(200);
    const stale = await ana.patch(`/opportunities/${o.id}`, { nextAction: 'Outra coisa', rowVersion: 1 });
    expect(stale.statusCode).toBe(409);
    expect(stale.json().currentRowVersion).toBe(2);
  });

  it('ganha exige confirmação e NÃO confirma contrato', async () => {
    const before = (await ana.get('/dashboard')).json().kpis.find((k: { key: string }) => k.key === 'contratos_confirmados').value;
    const o = (await newOpp(ana)).json();
    const noConfirm = await ana.post(`/opportunities/${o.id}/transition`, { toStage: 'ganha', rowVersion: 1 });
    expect(noConfirm.statusCode).toBe(422);
    const won = await ana.post(`/opportunities/${o.id}/transition`, { toStage: 'ganha', confirm: true, rowVersion: 1 });
    expect(won.statusCode).toBe(200);
    expect(won.json().stage).toBe('ganha');
    expect(won.json().contractRequestStatus).toBe('nao_solicitada');
    const after = (await ana.get('/dashboard')).json().kpis.find((k: { key: string }) => k.key === 'contratos_confirmados').value;
    expect(after).toBe(before);
  });

  it('perdida exige motivo; reabrir exige permissão e justificativa', async () => {
    const o = (await newOpp(ana)).json();
    expect((await ana.post(`/opportunities/${o.id}/transition`, { toStage: 'perdida', confirm: true, rowVersion: 1 })).statusCode).toBe(422);
    const lost = await ana.post(`/opportunities/${o.id}/transition`, { toStage: 'perdida', confirm: true, lossReason: 'preco', rowVersion: 1 });
    expect(lost.json().lossReason).toBe('preco');
    expect((await ana.post(`/opportunities/${o.id}/transition`, { toStage: 'retorno', reason: 'quero', rowVersion: 2 })).statusCode).toBe(422);
    expect((await supervisor.post(`/opportunities/${o.id}/transition`, { toStage: 'retorno', rowVersion: 2 })).statusCode).toBe(422);
    const reopened = await supervisor.post(`/opportunities/${o.id}/transition`, { toStage: 'retorno', reason: 'Cliente voltou a ligar', rowVersion: 2 });
    expect(reopened.statusCode).toBe(200);
    expect(reopened.json().lossReason).toBeNull();
    const tl = (await supervisor.get(`/opportunities/${o.id}/timeline`)).json();
    expect(tl.items.map((e: { type: string }) => e.type)).toEqual(expect.arrayContaining(['created', 'stage_changed', 'reopened']));
  });

  it('o banco recusa alteração de eventos (append-only)', async () => {
    await expect(ctx.db.execute(sql`delete from opportunity_events`)).rejects.toThrow(/append-only/);
  });

  it('pipeline agrupa por etapa com contagem e valor', async () => {
    const p = (await ana.get('/pipeline')).json();
    expect(p.stages.map((s: { key: string }) => s.key)).toEqual(['novo', 'descoberta', 'qualificacao', 'oferta', 'negociacao', 'retorno', 'ganha', 'perdida']);
    for (const st of p.stages) {
      expect(st.count).toBe(st.cards.length);
      for (const c of st.cards) expect(c.ownerId).toBe(ana.me.user.id);
    }
  });
});

describe('leads', () => {
  it('cria, busca, atualiza e converte (idempotente)', async () => {
    const created = await ana.post('/leads', { name: 'Lead Conversão Fictício', phone: '(00) 90000-1111', interests: ['velocidade'] });
    expect(created.statusCode).toBe(201);
    const lead = created.json();
    expect(lead.temperature.reasons.length).toBeGreaterThan(0);
    const found = (await ana.get('/leads?q=Convers%C3%A3o')).json();
    expect(found.items.some((l: { id: string }) => l.id === lead.id)).toBe(true);
    const upd = await ana.patch(`/leads/${lead.id}`, { lastContactAt: new Date().toISOString(), status: 'em_contato', rowVersion: 1 });
    expect(upd.json().firstContactAt).toBeTruthy();
    const conv = await ana.post(`/leads/${lead.id}/convert`, { rowVersion: 2 });
    expect(conv.statusCode).toBe(201);
    const again = await ana.post(`/leads/${lead.id}/convert`, { rowVersion: 3 });
    expect(again.statusCode).toBe(200);
    expect(again.json().opportunityId).toBe(conv.json().opportunityId);
  });

  it('não aceita "convertido" por PATCH nem filtros inválidos', async () => {
    const lead = (await ana.post('/leads', { name: 'Outro Lead Fictício' })).json();
    expect((await ana.patch(`/leads/${lead.id}`, { status: 'convertido', rowVersion: 1 })).statusCode).toBe(422);
    expect((await ana.get('/leads?sort=senha')).statusCode).toBe(422);
    expect((await ana.get('/leads/nao-e-uuid')).statusCode).toBe(422);
  });

  it('supervisor reatribui em massa com auditoria', async () => {
    const leads = (await supervisor.get('/leads?ownerId=none&pageSize=3')).json();
    const ids = leads.items.map((l: { id: string }) => l.id);
    if (!ids.length) return;
    const r = await supervisor.post('/leads/bulk-assign', { ids, ownerId: bruno.me.user.id });
    expect(r.json().updated).toBe(ids.length);
    const audit = (await (await login(ctx.app, 'admin@exemplo.test')).get('/audit')).json();
    expect(audit.items.some((a: { action: string }) => a.action === 'lead.bulk_assign')).toBe(true);
  });
});

describe('atividades', () => {
  it('não duplica lembrete idêntico, conclui e registra reagendamento', async () => {
    const o = (await newOpp(ana)).json();
    const due = new Date(Date.now() + 86_400_000).toISOString();
    const body = { type: 'retorno', title: 'Retornar com comparação', dueAt: due, opportunityId: o.id };
    const a1 = await ana.post('/activities', body);
    expect(a1.statusCode).toBe(201);
    const a2 = await ana.post('/activities', body);
    expect(a2.statusCode).toBe(200);
    expect(a2.json().deduplicated).toBe(true);
    expect(a2.json().id).toBe(a1.json().id);
    const later = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const r = await ana.patch(`/activities/${a1.json().id}`, { dueAt: later, rowVersion: 1 });
    expect(r.statusCode).toBe(200);
    const done = await ana.patch(`/activities/${a1.json().id}`, { completed: true, rowVersion: 2 });
    expect(done.json().completedAt).toBeTruthy();
    const tl = (await ana.get(`/opportunities/${o.id}/timeline`)).json();
    expect(tl.items.filter((e: { kind: string }) => e.kind === 'activity').map((e: { type: string }) => e.type)).toEqual(expect.arrayContaining(['created', 'rescheduled', 'completed']));
  });

  it('vendedor não cria atividade em oportunidade alheia', async () => {
    const o = (await newOpp(bruno)).json();
    const r = await ana.post('/activities', { type: 'tarefa', title: 'Tentativa', opportunityId: o.id });
    expect(r.statusCode).toBe(404);
  });
});

describe('dashboard e contrato da API', () => {
  it('cada KPI declara fórmula, unidade, fonte e tipo', async () => {
    const d = (await supervisor.get('/dashboard?scope=equipe&period=90d')).json();
    for (const k of d.kpis) {
      expect(k.formula).toBeTruthy();
      expect(k.source).toBeTruthy();
      expect(['count', 'brl_cents', 'ratio', 'days']).toContain(k.unit);
      if (k.kind === 'posicao_atual') expect(k.previous).toBeNull();
    }
    expect(d.charts.funnel.length).toBeGreaterThan(0);
  });

  it('publica OpenAPI com todas as rotas e permissões', async () => {
    const r = await ctx.app.inject({ method: 'GET', url: '/api/v1/openapi.json' });
    const doc = r.json();
    expect(doc.openapi).toBe('3.1.0');
    expect(doc.paths['/api/v1/opportunities/{id}/transition'].post['x-permissions']).toContain('opportunity.update');
  });
});
