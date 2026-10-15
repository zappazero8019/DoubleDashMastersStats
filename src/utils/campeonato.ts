import type { Idioma } from '../i18n';
import type { CampeonatoDto, JogadorEstatisticaDto } from '../types/api';
import { compararNome } from './ordenar.ts';

/**
 * Campeonato — regra de pontuação e classificação.
 *
 * As vitórias (recurso `campeonato` / `vw_campeonato`) são **sempre por
 * temporada** e confiáveis: cada live finalizada vale 1 vitória para quem fez
 * mais pontos nela (desempate determinístico do servidor pelo menor
 * `player_id`).
 *
 * PONTOS: a API pública **não** expõe pontos por `(temporada, jogador)`. O
 * único campo de pontos é `jogadores.pontos_totais_live`, que soma o placar
 * interno das lives finalizadas de **todas** as temporadas. Por isso os pontos
 * só podem ser atribuídos a uma temporada quando o conjunto cobre **uma única
 * temporada** (total acumulado == total daquela temporada) ou quando a seleção
 * é "todas as temporadas" (o acumulado é a soma geral). Fora disso, nenhum
 * valor é inventado: `pontos` fica `null` e a interface informa a limitação.
 */

export interface LinhaCampeonato {
  playerId: string;
  nome: string;
  /** Pontos acumulados da temporada; `null` quando não é possível atribuir. */
  pontos: number | null;
  vitorias: number;
  /** Colocação de competição (1, 1, 3, 4, ...): empates compartilham a posição. */
  posicao: number;
  /** Todos os jogadores empatados na primeira colocação. */
  lider: boolean;
}

export interface ClassificacaoCampeonato {
  linhas: LinhaCampeonato[];
  /** Temporadas presentes nos dados, da mais recente para a mais antiga. */
  temporadas: number[];
  /** `false` quando os pontos por temporada não podem ser atribuídos com segurança. */
  pontosDisponiveis: boolean;
}

type LinhaParcial = Pick<LinhaCampeonato, 'playerId' | 'nome' | 'pontos' | 'vitorias'>;

interface Acumulado {
  playerId: string;
  nome: string;
  vitorias: number;
}

/** Temporadas presentes no recurso `campeonato` (ordem decrescente). */
export function temporadasDoCampeonato(campeonato: readonly CampeonatoDto[]): number[] {
  const anos = new Set<number>();
  for (const linha of campeonato) {
    if (typeof linha.temporada === 'number' && Number.isFinite(linha.temporada)) {
      anos.add(linha.temporada);
    }
  }
  return [...anos].sort((a, b) => b - a);
}

/** Quantidade de grupos distintos de temporada (conta "desconhecida" quando null). */
function gruposDeTemporada(campeonato: readonly CampeonatoDto[]): number {
  const grupos = new Set<string>();
  for (const linha of campeonato) {
    const ano = linha.temporada;
    grupos.add(typeof ano === 'number' && Number.isFinite(ano) ? String(ano) : 'desconhecida');
  }
  return grupos.size;
}

function textoLimpo(nome: string | null | undefined): string {
  return (nome ?? '').trim();
}

function numeroFinito(valor: number | null | undefined): number | null {
  return typeof valor === 'number' && Number.isFinite(valor) ? valor : null;
}

export function montarClassificacao(opcoes: {
  campeonato: readonly CampeonatoDto[];
  jogadores: readonly JogadorEstatisticaDto[];
  /** `null` representa "todas as temporadas". */
  temporada: number | null;
  idioma: Idioma;
}): ClassificacaoCampeonato {
  const { campeonato, jogadores, temporada, idioma } = opcoes;

  const temporadas = temporadasDoCampeonato(campeonato);
  const pontosDisponiveis = temporada === null || gruposDeTemporada(campeonato) <= 1;

  // 1) Vitórias por jogador (sempre por temporada, confiáveis).
  const porJogador = new Map<string, Acumulado>();
  for (const linha of campeonato) {
    if (temporada !== null) {
      const ano = linha.temporada;
      if (typeof ano !== 'number' || !Number.isFinite(ano) || ano !== temporada) continue;
    }
    const chave = String(linha.player_id);
    let acumulado = porJogador.get(chave);
    if (!acumulado) {
      acumulado = { playerId: chave, nome: '', vitorias: 0 };
      porJogador.set(chave, acumulado);
    }
    const nome = textoLimpo(linha.nome);
    if (nome) acumulado.nome = nome;
    const vitorias = numeroFinito(linha.vitorias);
    if (vitorias !== null) acumulado.vitorias += vitorias;
  }

  // 2) Participantes sem vitória na temporada: só podem ser atribuídos ao
  //    escopo quando participação/pontos são seguros (uma única temporada ou
  //    "todas"). Caso contrário, listar-se-iam jogadores de outras temporadas.
  if (pontosDisponiveis) {
    for (const jogador of jogadores) {
      const chave = String(jogador.player_id);
      const acumulado = porJogador.get(chave);
      const nome = textoLimpo(jogador.nome);
      if (!acumulado) {
        porJogador.set(chave, { playerId: chave, nome, vitorias: 0 });
      } else if (!acumulado.nome && nome) {
        acumulado.nome = nome;
      }
    }
  }

  const jogadorPorId = new Map<string, JogadorEstatisticaDto>();
  for (const jogador of jogadores) jogadorPorId.set(String(jogador.player_id), jogador);

  const linhasSemPosicao: LinhaParcial[] = [...porJogador.values()].map((acumulado) => {
    const pontosBrutos = jogadorPorId.get(acumulado.playerId)?.pontos_totais_live;
    const pontos = pontosDisponiveis ? numeroFinito(pontosBrutos) : null;
    return {
      playerId: acumulado.playerId,
      nome: acumulado.nome || `#${acumulado.playerId}`,
      pontos,
      vitorias: acumulado.vitorias,
    };
  });

  // 2) Ordenação: pontos decrescentes (quando disponíveis), vitórias, nome.
  const ordenadas = [...linhasSemPosicao].sort((a, b) => {
    if (pontosDisponiveis) {
      const pa = a.pontos ?? Number.NEGATIVE_INFINITY;
      const pb = b.pontos ?? Number.NEGATIVE_INFINITY;
      if (pa !== pb) return pb - pa;
    }
    if (a.vitorias !== b.vitorias) return b.vitorias - a.vitorias;
    return compararNome(a.nome, b.nome, idioma);
  });

  // 3) Colocação de competição: o nome é só desempate visual, então a chave
  //    competitiva NÃO inclui o nome (empates preservam a mesma posição).
  const chaveCompetitiva = (linha: LinhaParcial): string =>
    pontosDisponiveis ? `${linha.pontos ?? '?'}|${linha.vitorias}` : String(linha.vitorias);

  let posicao = 0;
  let chaveAnterior: string | null = null;
  const linhas: LinhaCampeonato[] = ordenadas.map((linha, indice) => {
    const chave = chaveCompetitiva(linha);
    if (chave !== chaveAnterior) {
      posicao = indice + 1;
      chaveAnterior = chave;
    }
    return { ...linha, posicao, lider: posicao === 1 };
  });

  return { linhas, temporadas, pontosDisponiveis };
}
