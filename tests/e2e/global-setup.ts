import { execSync } from 'node:child_process';

/** Recria o banco de teste (migrations + seed fictícia) antes da suíte E2E. */
export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://isp:isp@localhost:5432/isp_sprint_test';
  execSync('pnpm --filter @isp/api exec tsx src/db/reset.ts', { stdio: 'inherit', env: { ...process.env, DATABASE_URL: url } });
}
