# Progresso e pendências

Atualizado em 2026-10-17. Leia junto com `DECISIONS.md` e `AUDIT_LEGACY_v1.5.md` ao retomar.

## Fase 0 — Auditoria ✅
- Legado v1.5 auditado (`AUDIT_LEGACY_v1.5.md`): 4 achados críticos (API aberta sem token, contrato confirmado forjável, XSS armazenado via `id`, sobrescrita arbitrária). Decisão: reescrever; portar só conteúdo de playbook e salvaguardas do adaptador IXC; migrar dados como `legacy_v1.5` não verificado (Fase 3).

## Fase 1 — Fundação CRM ✅

### Implementado
- **Monorepo** pnpm: `apps/api`, `apps/web`, `packages/domain`, `packages/shared`.
- **Banco**: 21 tabelas com `tenant_id`, `row_version`, CHECKs de estados, índices por tenant; migration custom com triggers append-only em `opportunity_events`, `activity_events`, `audit_logs`. Seed determinística e fictícia com 2 empresas.
- **Auth/RBAC/tenant**: sessão em cookie assinado, scrypt, lockout, rate limit no login, CSRF por Origin, 6 papéis padrão e 31 permissões; toda rota declara política (rota sem política impede o boot).
- **API /api/v1** (20 rotas, OpenAPI gerado dos schemas): `me`, `auth/login|logout`, `meta/lookups`, `audit`, `dashboard`, `leads` (lista/detalhe/criar/editar/atribuir em massa/converter), `opportunities` (lista/criar/detalhe/editar/transição/timeline), `pipeline`, `activities` (lista/criar idempotente/editar), `contacts` (busca/criar/ficha), `customers`. Erros `application/problem+json` com `requestId`.
- **Web**: AppShell com sidebar recolhível e menu por permissão, busca global (`/`), CTA “Nova oportunidade” (`N`), sino de vencidas, tema claro/escuro; Dashboard com KPIs que declaram fórmula, fonte e tipo (período × posição atual) e fila de próximas ações; Leads (filtros na URL, colunas configuráveis, seleção e atribuição em massa com confirmação, temperatura explicada, SLA, conversão); Pipeline Kanban (arrastar com mouse ou teclado, menu “Mover para” como alternativa, UI otimista com rollback, confirmação para ganhar/perder/reabrir); Oportunidades em tabela (alterna com Kanban mantendo filtros); **workspace Sprint** (criação mínima, régua de 7 min que não para, 3 painéis ≥1280 / 2 + gaveta 900–1279 / abas ≤899, autosave com debounce, rascunho local recuperado após refresh, flush ao sair, banner de conflito 409, pendências por regra fixa); Clientes e ficha (aviso de dados desatualizados, abas futuras sem dados inventados); Atividades (minhas/equipe, vencidas/hoje, concluir em um clique); Configurações (leitura + auditoria).

### Testes executados (2026-10-17, todos passando)
| Suíte | Resultado |
|---|---|
| `packages/domain` (Vitest) | 15/15 |
| `apps/web` (Vitest) | 5/5 |
| `apps/api` integração com Postgres real | 28/28 — auth, lockout, 429, CSRF, isolamento entre empresas (ler/editar/mover/vincular), RBAC, máscara de PII, 409, regras de ganha/perdida/reabrir, ganha não conta contrato, append-only, idempotência de atividade e conversão, OpenAPI |
| E2E Playwright (Chromium 1194 local) | 14/14 — login, redirect, atalhos, autosave + refresh sem zerar tempo, ganha ≠ contrato, mover pelo menu, conflito entre abas, isolamento por URL, menus por papel, lead→oportunidade, retorno sem duplicar, sem overflow horizontal em 390/768/1280 |
| `typecheck` e `build` dos 4 pacotes | OK |

### Limitações conhecidas (não verificado ou não feito)
- Docker não estava disponível nesta sessão: o `docker-compose.yml` foi escrito mas **não executado**; os testes usaram Postgres 16 local com as mesmas credenciais.
- Sem lint (ESLint) configurado ainda.
- Cronômetro: usa `sprint_started_at` da criação; pausa/retomada e acúmulo de sessões (`sprint_elapsed_seconds`) entram na Fase 2. Uma oportunidade reaberta depois de 12 h mostra só o tempo registrado.
- Supervisor com `*.read_all` enxerga o tenant inteiro (escopo por equipe pendente).
- Paginação por offset nas tabelas (adequada a milhares de linhas; cursor quando houver volume maior).
- Configurações somente leitura; edição de funil, papéis e catálogo não implementada.
- “Vistas salvas” = filtros na URL (link compartilhável); vistas nomeadas no servidor pendentes.
- Exportação CSV ainda não exposta na UI (`csvSafe` já existe e é testado).
- Fonte IBM Plex via Google Fonts; sem rede cai para a fonte do sistema.
- Valor mensal da oportunidade é digitado pelo vendedor (com aviso “use o catálogo oficial”) até o catálogo da Fase 2/4.
- E-mail de login é único globalmente (usuário multiempresa adiado).

## Próxima etapa — Fase 2 (Sprint completo)
1. Tabelas `playbooks`, `playbook_versions`, `opportunity_answers`, `recommendations`, `offers`/`plans`/`plan_versions` (catálogo), `coverage_checks`, `proposals`, `objections`.
2. Motor determinístico versionado em `packages/playbook` com testes por cenário; portar perguntas e objeções do `engine.js` legado.
3. Ramo “interesse em oferta” completo (perguntas condicionais, comparação “situação atual × proposta” com origem de cada dado, objeções, desfechos).
4. Cobertura via adaptador mock rotulado; proposta com validade; pedido de contratação só com aceite registrado.
5. Cronômetro com sessões, pausa e retomada.
6. E2E da jornada “oferta” do cenário de aceite da spec §14.

## Backlog posterior
- Fase 3: wizard CSV/JSON com dry-run, snapshots SCD2, migração do legado v1.5.
- Fase 4: matriz de endpoints IXC verificados na documentação e na instância; conector mock/sandbox/live.
- Fase 5: custos, atribuição versionada, CAC/LTV/churn/ICP com amostra e incerteza.
- Fase 6: contratação IXC idempotente e reconciliada.
- Fase 7: MFA, RLS no Postgres, backups testados, observabilidade, CI/CD, mapa LGPD por categoria.
