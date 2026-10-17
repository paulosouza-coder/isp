# Decisões de arquitetura (ADRs)

Formato: contexto → decisão → consequências. Decisões marcadas **(reversível)** podem mudar sem migração de dados.

## ADR-001 — Reescrever em vez de evoluir o v1.5
**Contexto:** auditoria (`AUDIT_LEGACY_v1.5.md`) encontrou falhas críticas de autenticação, XSS armazenado, estado de contrato forjável pela API, armazenamento JSON sem concorrência e código minificado sem testes.
**Decisão:** novo monorepo; do legado aproveitamos conteúdo de playbook e as salvaguardas do adaptador IXC. Dados legados entram pelo importador como `legacy_v1.5`, não verificados.

## ADR-002 — Monorepo pnpm com pacotes de domínio
`apps/web`, `apps/api`, `packages/domain` (regras puras: permissões, estados, temperatura de lead, formatação), `packages/shared` (schemas Zod/DTOs usados por web e API). Pacotes consumidos como fonte TypeScript (sem build intermediário) para simplificar o desenvolvimento local. **(reversível)**

## ADR-003 — Frontend: React + Vite (não Next.js)
**Contexto:** aplicação inteira atrás de login, sem necessidade de SEO/SSR; já existe API própria.
**Decisão:** React 18 + Vite + React Router + TanStack Query + Tailwind com tokens semânticos em CSS variables (`apps/web/src/styles/tokens.css`). Componentes próprios acessíveis (sem kit pesado), foco visível e navegação por teclado. **(reversível)**
**Consequência:** um único servidor de aplicação (a API); o web é estático e pode ir para CDN.

## ADR-004 — API: Fastify + Zod + Drizzle ORM + PostgreSQL
- Fastify: desempenho, hooks para auth/RBAC por rota, plugins maduros (cookie, rate-limit, helmet).
- Zod: validação de entrada compartilhada com o frontend; erros no formato `application/problem+json`.
- Drizzle: schema em TypeScript, SQL previsível, migrations SQL versionadas geradas pelo `drizzle-kit` e revisáveis.
- PostgreSQL 16 em Docker Compose (ou instância local).

## ADR-005 — Autenticação por sessão em cookie
Cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção; token aleatório de 32 bytes, **armazenado apenas como hash SHA-256** na tabela `sessions`, com expiração e revogação (logout). Senhas com `scrypt` (Node nativo, sem dependência nativa). Proteção CSRF: toda requisição que altera estado exige `Origin` igual a `WEB_ORIGIN` **e** `Content-Type: application/json`. Rate limit global e mais estrito no login. MFA para admin fica para a Fase 7 (registrado em PROGRESS). OIDC pode substituir depois. **(reversível)**

## ADR-006 — Autorização: RBAC no backend, negação por padrão
Permissões granulares em `packages/domain/src/permissions.ts`; papéis no banco (`roles`, `role_permissions`, `user_roles`) com seed dos 6 papéis padrão. Cada rota declara a permissão exigida; escopo "próprios × todos" via `*.read_all`. O frontend só esconde o que não pode; a API sempre revalida.

## ADR-007 — Isolamento multiempresa por `tenant_id` em toda consulta
`tenant_id` vem **somente da sessão**, nunca do corpo/URL. Todo acesso por ID filtra por `(tenant_id, id)`; ID de outro tenant responde 404 (não 403, para não revelar existência). Testes de acesso cruzado obrigatórios. RLS no Postgres considerado para a Fase 7 como defesa em profundidade.

## ADR-008 — Estados separados e transições no servidor
`opportunity_stage`, `proposal_status`, `contract_request_status`, `coverage_status` são colunas distintas. Mudança de etapa só via `POST /opportunities/:id/transition`, com `row_version` (409 em conflito), validação (422) e evento append-only com ator, motivo e versão. Ganha/Perdida são terminais; reabrir exige `opportunity.reopen` e motivo. **Ganha ≠ contrato confirmado**: o contador de contratos usa exclusivamente `contract_request_status = 'confirmada'`, que nenhuma rota da Fase 1 consegue definir.

## ADR-009 — Dinheiro em centavos inteiros
Colunas `*_cents integer/bigint`; formatação BRL só na borda (UI/exportação).

## ADR-010 — Datas em UTC no banco, exibição no fuso do tenant
`timestamptz` em todas as colunas; `tenants.timezone` (padrão `America/Sao_Paulo`) usado na UI.

## ADR-011 — Seed 100% fictícia e determinística
Nomes, telefones e endereços gerados; nenhum dado real. A seed usa semente fixa para que testes e capturas sejam reproduzíveis.

## ADR-012 — Ambiente de desenvolvimento sem Docker disponível
Nesta sessão o daemon Docker não está acessível; foi usado o PostgreSQL 16 local com as mesmas credenciais do `docker-compose.yml`. O compose segue sendo o caminho documentado.

## ADR-013 — Paginação por offset nas tabelas da Fase 1
Tabelas com ordenação por várias colunas usam `page/pageSize` com total. Suficiente para milhares de registros; cursor entra onde o volume exigir (Fase 3+). **(reversível)**

## ADR-014 — Autosave do workspace com rascunho local
Debounce de 900 ms, `PATCH` só dos campos alterados com `rowVersion`; rascunho em `localStorage` (mesma versão do servidor) recuperado após refresh com aviso; flush com `keepalive` ao sair; 409 mostra banner e nunca sobrescreve em silêncio.

## ADR-015 — E2E isolado
Playwright sobe API (:3334) e web (:5174) próprios contra `isp_sprint_test`, recriado no início. `PW_CHROMIUM_PATH` permite usar Chromium local quando o download é bloqueado.

## ADR-016 — Níveis de acesso por módulo e por perfil (substitui as 31 permissões)
Pedido do cliente (17/10): “no painel de configuração consiga setar níveis de segurança por módulo”. Modelo: 9 módulos × 4 níveis (`nenhum`, `proprio`, `equipe`, `total`), por **perfil** (Vendedor, Supervisão, Gerência) — não por pessoa. Padrão: Vendedor = Próprio (sem Campanhas, Inteligência, Configurações); Supervisão = Equipe; Gerência = Total, inclusive Configurações. Configurações só aceita Sem acesso/Total, e a Gerência não pode perder Configurações (evita trancar a empresa fora). “Equipe” = membros dos times que o usuário **lidera** (`team_memberships.is_lead`), somados, mais registros sem dono. Cada rota declara `module` + nível mínimo; o filtro de dono (`ownerScope`) é aplicado em SQL em toda consulta. A tela esconde o que a API já recusa.

## ADR-017 — Dados sensíveis e ranking
Decisão do cliente: o vendedor vê os dados de venda completos da própria carteira (sem máscara de telefone) e só os próprios números — o ranking do time aparece a partir do nível Equipe. Removida a máscara de PII por papel da Fase 1.

## ADR-018 — Valor da oportunidade vem do catálogo de planos
O vendedor escolhe o plano; o servidor grava `plan_id` e copia `price_cents` do catálogo (`plans`, origem `catalogo_manual` até a integração IXC). Não existe mais valor digitado. Preço mudou depois? A oportunidade guarda o valor do momento em que o plano foi escolhido.

## ADR-019 — Funil Yepnet e “Venda fechada”
Etapas: Novo lead → Qualificação → Cobertura → Proposta → Fechamento → Venda fechada / Perdido (migration 0002 mapeia as etapas antigas). “Venda fechada” é ganho comercial; contrato só conta como confirmado com validação externa (IXC). Receita nos relatórios = soma do valor mensal de catálogo das vendas fechadas, não faturamento — explicado no “Como é calculado” de cada indicador.

## ADR-020 — Imagens da marca no banco, sem SVG
12 espaços (`brand_assets`, por empresa) e fotos de usuário (`user_avatars`) em `bytea`, até 2 MB, tipo detectado pelos bytes (PNG/JPEG/WebP). SVG recusado (pode carregar script). Só a logo e o favicon têm rota pública (tela de login); os demais exigem sessão. Textos dos balões são fixos (decisão do cliente: “não edita os balões”).

## ADR-021 — Insights por regra fixa
“Principais insights” da Inteligência são frases geradas por regras sobre os números exibidos, com amostra mínima de 10 registros e o `n` visível. Mostram associação, não causa. Nada de modelo generativo aqui.
