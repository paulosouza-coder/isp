import { formatBRL } from '@isp/domain';

let tz = 'America/Sao_Paulo';
export const setTimezone = (t: string) => { tz = t; };
export const getTimezone = () => tz;

const d = (v: string | Date) => (typeof v === 'string' ? new Date(v) : v);

export function fmtDate(v?: string | Date | null) {
  if (!v) return '—';
  return d(v).toLocaleDateString('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric' });
}
export function fmtDateTime(v?: string | Date | null) {
  if (!v) return '—';
  return d(v).toLocaleString('pt-BR', { timeZone: tz, day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}
export function fmtRelative(v?: string | Date | null) {
  if (!v) return '—';
  const diff = d(v).getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), 'hour');
  return rtf.format(Math.round(diff / 86_400_000), 'day');
}
export const fmtBRL = (cents?: number | null) => formatBRL(cents ?? null);
export const fmtPct = (r?: number | null) => (r === null || r === undefined ? 'N/D' : `${(r * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
export const fmtInt = (n?: number | null) => (n === null || n === undefined ? 'N/D' : n.toLocaleString('pt-BR'));
export function fmtDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Converte valor de <input type="datetime-local"> (fuso local do navegador) para ISO UTC. */
export function localInputToIso(v: string) {
  return v ? new Date(v).toISOString() : null;
}
export function isoToLocalInput(v?: string | null) {
  if (!v) return '';
  const x = new Date(v);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}
