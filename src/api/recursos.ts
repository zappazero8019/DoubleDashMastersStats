import { buscarRecurso } from './client';
import type {
  CampeonatoDto,
  GeralDto,
  ItemContagemDto,
  JogadorEstatisticaDto,
  LiveDto,
} from '../types/api';

// ---------------------------------------------------------------------------
// Adaptadores tipados para cada recurso REAL exposto pela API.
// Nenhum recurso, parâmetro ou campo inventado: espelha stats.js.
// ---------------------------------------------------------------------------

const LIMITE_MAX = 500;

function limitar(limite?: number): string | undefined {
  if (limite === undefined) return undefined;
  const n = Math.trunc(limite);
  if (!Number.isFinite(n)) return undefined;
  return String(Math.min(LIMITE_MAX, Math.max(1, n)));
}

interface Opcoes {
  sinal?: AbortSignal;
  limite?: number;
}

/** GET recurso=geral — totais (uma linha). */
export async function obterGeral(opcoes: Opcoes = {}): Promise<GeralDto | null> {
  const dados = await buscarRecurso<GeralDto>('geral', undefined, { signal: opcoes.sinal });
  return dados[0] ?? null;
}

/** GET recurso=lives — histórico de lives finalizadas. */
export function obterLives(opcoes: Opcoes = {}): Promise<LiveDto[]> {
  return buscarRecurso<LiveDto>('lives', { limite: limitar(opcoes.limite) }, { signal: opcoes.sinal });
}

/** GET recurso=live&sessao_id=... — detalhe de uma live pelo identificador. */
export async function obterLive(
  sessaoId: string,
  opcoes: { sinal?: AbortSignal } = {},
): Promise<LiveDto | null> {
  const dados = await buscarRecurso<LiveDto>(
    'live',
    { sessao_id: sessaoId },
    { signal: opcoes.sinal },
  );
  return dados[0] ?? null;
}

/** GET recurso=campeonato[&ano=...] — classificação anual (vitórias). */
export function obterCampeonato(
  opcoes: Opcoes & { ano?: number } = {},
): Promise<CampeonatoDto[]> {
  const params: Record<string, string> = {};
  const l = limitar(opcoes.limite);
  if (l) params.limite = l;
  if (opcoes.ano !== undefined) params.ano = String(opcoes.ano);
  return buscarRecurso<CampeonatoDto>('campeonato', params, { signal: opcoes.sinal });
}

/** GET recurso=jogadores — agregados por jogador. */
export function obterJogadores(opcoes: Opcoes = {}): Promise<JogadorEstatisticaDto[]> {
  return buscarRecurso<JogadorEstatisticaDto>(
    'jogadores',
    { limite: limitar(opcoes.limite) },
    { signal: opcoes.sinal },
  );
}

/** GET recurso=jogador&player_id=... — perfil de um jogador. */
export async function obterJogador(
  playerId: string,
  opcoes: { sinal?: AbortSignal } = {},
): Promise<JogadorEstatisticaDto | null> {
  const dados = await buscarRecurso<JogadorEstatisticaDto>(
    'jogador',
    { player_id: playerId },
    { signal: opcoes.sinal },
  );
  return dados[0] ?? null;
}

/** GET recurso=itens — contagens de todos os itens. */
export function obterItens(opcoes: Opcoes = {}): Promise<ItemContagemDto[]> {
  return buscarRecurso<ItemContagemDto>(
    'itens',
    { limite: limitar(opcoes.limite) },
    { signal: opcoes.sinal },
  );
}

/** GET recurso=relampagos — contagens de itens da classe relâmpago. */
export function obterRelampagos(opcoes: Opcoes = {}): Promise<ItemContagemDto[]> {
  return buscarRecurso<ItemContagemDto>(
    'relampagos',
    { limite: limitar(opcoes.limite) },
    { signal: opcoes.sinal },
  );
}

/** GET recurso=cascos_azuis — contagens de itens da classe casco azul. */
export function obterCascosAzuis(opcoes: Opcoes = {}): Promise<ItemContagemDto[]> {
  return buscarRecurso<ItemContagemDto>(
    'cascos_azuis',
    { limite: limitar(opcoes.limite) },
    { signal: opcoes.sinal },
  );
}
