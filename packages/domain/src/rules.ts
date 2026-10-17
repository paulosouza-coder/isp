/** Regras explicáveis da Fase 1 (temperatura, SLA, atraso, máscaras e formatação). */

export type Temperature = 'quente' | 'morno' | 'frio';
export type TemperatureResult = { level: Temperature; score: number; reasons: string[] };

export type TemperatureInput = {
  now: Date;
  createdAt: Date;
  lastContactAt?: Date | null;
  nextActionAt?: Date | null;
  interests: string[];
  status: string;
};

const DAY = 86_400_000;

/**
 * Temperatura do lead por regra aditiva e explicada — não é previsão estatística.
 * Cada ponto vem com o motivo exibido no tooltip da UI.
 */
export function leadTemperature(i: TemperatureInput): TemperatureResult {
  const reasons: string[] = [];
  let score = 0;
  const ageDays = (i.now.getTime() - i.createdAt.getTime()) / DAY;
  if (ageDays <= 2) { score += 2; reasons.push('Lead criado há até 2 dias (+2)'); }
  else if (ageDays > 14) { score -= 1; reasons.push('Lead com mais de 14 dias (−1)'); }

  if (i.lastContactAt) {
    const since = (i.now.getTime() - i.lastContactAt.getTime()) / DAY;
    if (since <= 3) { score += 2; reasons.push('Contato nos últimos 3 dias (+2)'); }
    else if (since > 10) { score -= 1; reasons.push('Sem contato há mais de 10 dias (−1)'); }
  } else {
    reasons.push('Ainda sem contato registrado (0)');
  }

  if (i.nextActionAt && i.nextActionAt.getTime() >= i.now.getTime()) { score += 1; reasons.push('Próxima ação agendada (+1)'); }
  if (i.interests.length > 0) { score += 1; reasons.push('Interesse declarado (+1)'); }
  if (i.status === 'qualificado') { score += 1; reasons.push('Lead qualificado (+1)'); }
  if (i.status === 'descartado') { score = -10; reasons.push('Lead descartado'); }

  const level: Temperature = score >= 4 ? 'quente' : score >= 2 ? 'morno' : 'frio';
  return { level, score, reasons };
}

/** SLA de primeiro contato (padrão 24h). */
export function leadSla(createdAt: Date, firstContactAt: Date | null | undefined, now: Date, slaHours = 24) {
  const deadline = new Date(createdAt.getTime() + slaHours * 3_600_000);
  if (firstContactAt) {
    return { state: firstContactAt <= deadline ? 'cumprido' : 'cumprido_atrasado', deadline } as const;
  }
  return { state: now > deadline ? 'violado' : 'no_prazo', deadline } as const;
}

export function isOverdue(dueAt: Date | null | undefined, completedAt: Date | null | undefined, now: Date) {
  return !!dueAt && !completedAt && dueAt.getTime() < now.getTime();
}

// --------------------------------------------------------------- máscaras

export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '••••';
  return `(••) •••••-${digits.slice(-4)}`;
}

export function maskEmail(email: string | null | undefined): string {
  if (!email) return '';
  const [user, domain] = email.split('@');
  if (!user || !domain) return '••••';
  return `${user.slice(0, 1)}•••@${domain}`;
}

// --------------------------------------------------------------- dinheiro

/** Converte "1.234,56" / "1234.56" / 1234.56 para centavos inteiros, sem float acumulado. */
export function toCents(value: string | number): number | null {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return null;
    return Math.round(value * 100);
  }
  const s = value.trim().replace(/\s|R\$/g, '');
  if (!s) return null;
  const normalized = s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s;
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [int, frac = ''] = normalized.replace('-', '').split('.');
  const cents = Number(int) * 100 + Number(frac.padEnd(2, '0'));
  return normalized.startsWith('-') ? -cents : cents;
}

export function formatBRL(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return '—';
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/** Neutraliza CSV formula injection (=, +, -, @, tab, CR) em exportações. */
export function csvSafe(value: unknown): string {
  const s = value === null || value === undefined ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${guarded.replace(/"/g, '""')}"`;
}
