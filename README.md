# ISP Sprint — CRM comercial para provedores de internet

CRM B2B com a ergonomia de um CRM profissional (sidebar, dashboard, leads, pipeline Kanban, oportunidades, clientes, atividades) e uma exceção: **“+ Nova oportunidade” abre o workspace Sprint**, com meta de decisão em 7 minutos que orienta, nunca bloqueia.

> Estado atual: **Fase 0 (auditoria) e Fase 1 (fundação CRM) concluídas.** O copiloto de playbook, a comparação de ofertas e a integração IXC são fases seguintes — veja `docs/PROGRESS.md`. Nenhuma integração IXC real existe nesta versão.

## Requisitos

- Node 22+, pnpm 10 (`corepack enable`)
- PostgreSQL 16 — via Docker Compose (recomendado) ou instância local com as mesmas credenciais

## Como executar

```bash
cp .env.example .env
docker compose up -d db          # cria isp_sprint e isp_sprint_test
pnpm install
pnpm db:reset                    # migrations + seed 100% fictícia
pnpm dev                         # API em :3333, web em :5173
```

Abra http://localhost:5173. Todos os usuários de demonstração usam a senha `Sprint@2026`:

| Usuário | Papel | Para ver |
|---|---|---|
| `ana@exemplo.test`, `bruno@exemplo.test` | Vendedor | Só a própria carteira |
| `supervisor@exemplo.test` | Supervisor + vendedor | Equipe, reatribuição, reabrir oportunidade |
| `gestor@exemplo.test` | Gestor comercial | Visão gerencial |
| `analista@exemplo.test` | Marketing/analista | Dados com telefone mascarado, sem criar oportunidade |
| `financeiro@exemplo.test` | Operações/financeiro | Leitura |
| `admin@exemplo.test` | Administrador | Auditoria |
| `vendedor@outro.test` | Vendedor de **outra empresa** | Teste de isolamento |

Atalhos: `/` busca global · `N` nova oportunidade (fora de campos de texto).

## Testes

```bash
pnpm typecheck
pnpm test        # domínio + web (unit) + API contra Postgres real (isp_sprint_test)
pnpm e2e         # Playwright: sobe API :3334 e web :5174 com banco de teste
```

Sem acesso ao download de navegadores do Playwright, aponte para um Chromium local: `PW_CHROMIUM_PATH=/caminho/chrome pnpm e2e`.

## Estrutura

```text
apps/api          Fastify + Drizzle: auth por sessão, RBAC, rotas /api/v1, OpenAPI em /api/v1/openapi.json
apps/web          React + Vite + Tailwind; tokens em src/styles/tokens.css
packages/domain   Regras puras: permissões, estados e transições, temperatura, SLA, dinheiro, CSV seguro
packages/shared   Schemas Zod compartilhados (entrada da API = validação do formulário)
tests/e2e         Jornadas Playwright
docs/             AUDIT_LEGACY_v1.5, DECISIONS (ADRs), PROGRESS (estado e backlog)
```

## Garantias desta versão

- Autenticação individual por sessão (cookie httpOnly, token só como hash no banco), bloqueio após 5 falhas, limite de tentativas por minuto, proteção CSRF por origem.
- Tenant vem só da sessão; registro de outra empresa responde 404. RBAC negado por padrão em toda rota.
- Estados separados: etapa, proposta, pedido de contrato e cobertura. **Ganha ≠ contrato confirmado**; nenhuma rota atual consegue confirmar contrato.
- Concorrência otimista (`rowVersion`, 409) e eventos append-only protegidos por trigger no banco.
- Dinheiro em centavos; datas em UTC no banco, exibidas no fuso da empresa.
- Seed fictícia: telefones com DDD 00, e-mails `.test`, clientes marcados `seed_ficticio`.

## Não usar em produção ainda

Faltam MFA para administradores, backups testados, observabilidade completa, revisão de LGPD por categoria de dado e hardening de implantação (Fase 7). Veja a seção de limitações em `docs/PROGRESS.md`.
