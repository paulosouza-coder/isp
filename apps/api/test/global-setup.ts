import { resetDatabase } from '../src/db/reset';

export const TEST_DB = process.env.TEST_DATABASE_URL ?? 'postgres://isp:isp@localhost:5432/isp_sprint_test';

/** Recria o banco de teste do zero (migrations + seed fictícia) antes da suíte. */
export default async function setup() {
  await resetDatabase(TEST_DB, { seed: true });
}
