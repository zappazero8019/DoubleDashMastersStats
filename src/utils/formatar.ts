import type { Idioma } from '../i18n';
import type { Identificador } from '../types/api';

const LOCALES: Record<Idioma, string> = {
  'pt-BR': 'pt-BR',
  en: 'en-US',
};

/** Converte um identificador (string|number) para string, sem inventar valor. */
export function comoTexto(valor: Identificador | null | undefined): string {
  if (valor === null || valor === undefined) return '';
  return String(valor);
}

/** Formata um número inteiro no idioma escolhido. */
export function formatarNumero(valor: number | null | undefined, idioma: Idioma): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return new Intl.NumberFormat(LOCALES[idioma]).format(valor);
}

/**
 * Formata uma data (string ISO ou timestamp) no idioma escolhido.
 * Devolve '—' quando ausente ou inválida — nunca inventa uma data.
 */
export function formatarData(
  valor: string | null | undefined,
  idioma: Idioma,
  comHora = false,
): string {
  if (!valor) return '—';
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return '—';
  const opcoes: Intl.DateTimeFormatOptions = comHora
    ? { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short', year: 'numeric' };
  return new Intl.DateTimeFormat(LOCALES[idioma], opcoes).format(data);
}

/** Formata apenas a hora (usada no "atualizado em"). */
export function formatarHora(valor: Date | null, idioma: Idioma): string {
  if (!valor) return '—';
  return new Intl.DateTimeFormat(LOCALES[idioma], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(valor);
}

/** Formata a temporada (ano). Sem valor => '—'. */
export function formatarTemporada(valor: number | null | undefined): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return '—';
  return String(valor);
}
