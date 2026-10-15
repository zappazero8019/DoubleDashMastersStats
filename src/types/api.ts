// Tipos dos DTOs retornados pela API pública de leitura.
//
// Origem dos campos (confirmada em api-site/netlify/functions/stats.js e
// supabase/migrations/0003_leitura_publica.sql):
//   geral       -> vw_geral
//   lives/live  -> vw_lives
//   campeonato  -> vw_campeonato
//   jogadores   -> vw_jogador_estatisticas
//   jogador     -> vw_jogador_estatisticas (filtro player_id)
//   itens       -> vw_item_contagens
//   relampagos  -> vw_item_contagens (classe = relampago)
//   cascos_azuis-> vw_item_contagens (classe = casco_azul)
//
// Identificadores (sessao_id / player_id) e temporada podem variar de tipo no
// banco; por isso usamos uniões e normalizamos nos adaptadores.

export type Identificador = string | number;

/** Envelope padrão da API: { ok, recurso, dados }. */
export interface RespostaApi<T> {
  ok: boolean;
  recurso: string;
  dados: T[];
}

/** vw_geral — uma única linha de totais. */
export interface GeralDto {
  lives_finalizadas: number;
  lives_em_andamento: number;
  jogadores: number;
  itens_totais: number;
  relampagos: number;
  cascos_azuis: number;
}

/** vw_lives — uma linha por live finalizada. */
export interface LiveDto {
  sessao_id: Identificador;
  temporada: number | null;
  iniciada_em: string | null;
  finalizada_em: string | null;
  url_live: string | null;
  vencedor_player_id: Identificador | null;
  vencedor_nome: string | null;
  vencedor_pontos: number | null;
}

/** vw_campeonato — uma linha por (temporada, jogador) com vitórias. */
export interface CampeonatoDto {
  temporada: number | null;
  player_id: Identificador;
  nome: string | null;
  vitorias: number;
}

/** vw_jogador_estatisticas — agregados por jogador (lives finalizadas). */
export interface JogadorEstatisticaDto {
  player_id: Identificador;
  nome: string | null;
  lives_participadas: number;
  pontos_totais_live: number;
  melhor_live: number;
}

/** vw_item_contagens — contagem de itens por (live, jogador, item). */
export interface ItemContagemDto {
  sessao_id: Identificador;
  temporada: number | null;
  player_id: Identificador;
  nome: string | null;
  nome_item: string;
  classe: string | null;
  total: number;
  aquisicoes: number;
}

/** Classes reconhecidas pela função classificar_item() no banco. */
export type ClasseItem = 'relampago' | 'casco_azul' | string;
