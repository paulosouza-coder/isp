import { expect, test, type Page } from '@playwright/test';

const PASSWORD = 'Sprint@2026';

async function login(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill(email);
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('button', { name: /^Conta de / })).toBeVisible();
}

async function newOpportunity(page: Page, name: string) {
  await page.getByRole('button', { name: 'Nova oportunidade' }).first().click();
  await expect(page).toHaveURL(/\/opportunities\/new$/);
  await page.getByLabel('Nome').fill(name);
  await page.getByText('Oferta / curiosidade').click();
  await page.getByRole('button', { name: 'Iniciar Sprint' }).click();
  await expect(page).toHaveURL(/\/opportunities\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  return page.url();
}

test('login inválido mostra erro e não entra', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('E-mail').fill('ana@exemplo.test');
  await page.getByLabel('Senha').fill('errada');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos');
  await expect(page).toHaveURL(/\/login/);
});

test('rota protegida redireciona para login e volta depois', async ({ page }) => {
  await page.goto('/pipeline');
  await expect(page).toHaveURL(/\/login\?next=%2Fpipeline/);
  await page.getByLabel('E-mail').fill('ana@exemplo.test');
  await page.getByLabel('Senha').fill(PASSWORD);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await expect(page).toHaveURL(/\/pipeline$/);
});

test('dashboard mostra KPIs com fórmula e atalhos de teclado funcionam', async ({ page }) => {
  await login(page, 'supervisor@exemplo.test');
  await expect(page.getByText('Contratos confirmados')).toBeVisible();
  await page.getByRole('button', { name: 'Como é calculado: Contratos confirmados' }).click();
  await expect(page.getByText('somente por confirmação externa validada')).toBeVisible();
  await page.locator('body').press('/');
  await expect(page.locator('#global-search')).toBeFocused();
  await page.locator('#global-search').press('Escape');
  await page.locator('main').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('n');
  await expect(page).toHaveURL(/\/opportunities\/new$/);
});

test('Sprint: cria, salva sozinho, sobrevive a refresh sem zerar o tempo', async ({ page }) => {
  await login(page, 'ana@exemplo.test');
  await newOpportunity(page, 'Cliente E2E Autosave');
  await page.getByLabel('Anotações da conversa').fill('Satisfeita com o atual, curiosa com a oferta. Preço atual não informado.');
  await expect(page.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();
  await page.waitForTimeout(2200);
  const before = await page.getByRole('timer').locator('p').first().textContent();
  await page.reload();
  await expect(page.getByLabel('Anotações da conversa')).toHaveValue(/curiosa com a oferta/);
  const after = await page.getByRole('timer').locator('p').first().textContent();
  expect(after).not.toBe('00:00');
  expect(after! >= before!).toBe(true);
  await page.getByRole('tab', { name: 'Histórico' }).click();
  await expect(page.getByText('Oportunidade criada')).toBeVisible();
  await expect(page.getByText(/Atualizou .*anotações/)).toBeVisible();
});

test('Sprint: ganha pede confirmação e não conta como contrato', async ({ page }) => {
  await login(page, 'ana@exemplo.test');
  await newOpportunity(page, 'Cliente E2E Ganho');
  await page.getByRole('button', { name: 'Marcar como ganha' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toContainText('Ganho comercial não confirma contrato');
  await dialog.getByRole('button', { name: 'Marcar como ganha' }).click();
  await expect(page.getByText('Contrato: Não solicitada')).toBeVisible();
  await expect(page.locator('#ws-stage')).toHaveValue('ganha');
  await page.goto('/');
  const card = page.locator('div.panel', { hasText: 'Contratos confirmados' });
  await expect(card).toContainText('0');
});

test('Pipeline: mover pelo menu (alternativa ao arrastar) e perder exige motivo', async ({ page }) => {
  await login(page, 'ana@exemplo.test');
  await newOpportunity(page, 'Cliente E2E Kanban');
  await page.goto('/pipeline?q=E2E%20Kanban');
  const card = page.locator('li', { hasText: 'Cliente E2E Kanban' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /Mover .* para outra etapa/ }).click();
  await page.getByRole('menuitem', { name: 'Oferta' }).click();
  await expect(page.getByRole('region', { name: /Oferta/ }).getByText('Cliente E2E Kanban')).toBeVisible();
  await card.getByRole('button', { name: /Mover .* para outra etapa/ }).click();
  await page.getByRole('menuitem', { name: 'Perdida' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('button', { name: 'Marcar como perdida' })).toBeDisabled();
  await dialog.getByLabel('Motivo da perda').selectOption('preco');
  await dialog.getByRole('button', { name: 'Marcar como perdida' }).click();
  await expect(page.getByRole('region', { name: /Perdida/ }).getByText('Cliente E2E Kanban')).toBeVisible();
});

test('edição simultânea gera conflito visível, não sobrescreve em silêncio', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await login(a, 'supervisor@exemplo.test');
  const url = await newOpportunity(a, 'Cliente E2E Conflito');
  const b = await (await browser.newContext()).newPage();
  await login(b, 'supervisor@exemplo.test');
  await b.goto(url);
  await expect(b.getByLabel('Anotações da conversa')).toBeVisible();
  await a.getByLabel('Próxima ação').fill('Versão da aba A');
  await expect(a.getByRole('status').filter({ hasText: 'Salvo' })).toBeVisible();
  await b.getByLabel('Anotações da conversa').fill('Versão da aba B');
  await expect(b.getByText('Outra pessoa alterou esta oportunidade')).toBeVisible();
  await b.getByRole('button', { name: 'Recarregar versão atual' }).click();
  await expect(b.getByLabel('Próxima ação')).toHaveValue('Versão da aba A');
});

test('usuário de outra empresa não abre oportunidade por URL', async ({ browser }) => {
  const a = await (await browser.newContext()).newPage();
  await login(a, 'ana@exemplo.test');
  const url = await newOpportunity(a, 'Cliente E2E Isolamento');
  const b = await (await browser.newContext()).newPage();
  await login(b, 'vendedor@outro.test');
  await b.goto(url);
  await expect(b.getByRole('alert')).toContainText('Oportunidade não encontrada');
});

test('vendedor não vê menus e dados restritos; analista vê telefone mascarado', async ({ browser }) => {
  const v = await (await browser.newContext()).newPage();
  await login(v, 'ana@exemplo.test');
  await expect(v.getByRole('link', { name: /Financeiro/ })).toHaveCount(0);
  await expect(v.getByRole('link', { name: /Integrações/ })).toHaveCount(0);
  const an = await (await browser.newContext()).newPage();
  await login(an, 'analista@exemplo.test');
  await expect(an.getByRole('button', { name: 'Nova oportunidade' })).toHaveCount(0);
  await an.goto('/leads');
  await expect(an.getByText(/\(••\) •••••-\d{4}/).first()).toBeVisible();
});

test('lead: criar, buscar e converter abre o workspace', async ({ page }) => {
  await login(page, 'ana@exemplo.test');
  await page.goto('/leads');
  await page.getByRole('button', { name: 'Novo lead' }).click();
  await page.getByLabel('Nome').fill('Lead E2E Conversão');
  await page.getByRole('button', { name: 'Criar lead' }).click();
  await expect(page.getByText('Lead criado')).toBeVisible();
  await page.getByLabel('Buscar leads').fill('E2E Conversão');
  await page.getByRole('cell', { name: 'Lead E2E Conversão' }).click();
  await page.getByRole('button', { name: 'Converter em oportunidade' }).click();
  await expect(page).toHaveURL(/\/opportunities\/[0-9a-f-]{36}$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Lead E2E Conversão' })).toBeVisible();
});

test('agendar retorno não duplica e aparece em atividades', async ({ page }) => {
  await login(page, 'ana@exemplo.test');
  await newOpportunity(page, 'Cliente E2E Retorno');
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Agendar retorno' }).first().click();
    await page.getByRole('dialog').getByLabel('O que fazer').fill('Retornar com comparação');
    await page.getByRole('dialog').getByRole('button', { name: 'Agendar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
  await expect(page.getByText('Essa atividade já estava agendada')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: /Concluir: Retornar com comparação/ })).toHaveCount(1);
});

for (const width of [390, 768, 1280]) {
  test(`sem rolagem horizontal da página em ${width}px`, async ({ browser }) => {
    const page = await (await browser.newContext({ viewport: { width, height: 900 } })).newPage();
    await login(page, 'supervisor@exemplo.test');
    for (const path of ['/', '/leads', '/opportunities', '/activities', '/customers']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${path} em ${width}px`).toBeLessThanOrEqual(1);
    }
  });
}
