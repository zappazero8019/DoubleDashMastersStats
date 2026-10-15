import type { CampeonatoDto, Identificador, ItemContagemDto } from '../types/api';
import { comoTexto } from '../utils/formatar';

export interface LinhaVitorias {
  playerId: Identificador;
  nome: string;
  vitorias: number;
}

export interface LinhaItens {
  playerId: Identificador;
  nome: string;
  total: number;
  aquisicoes: number;
}

/** Soma vitórias do campeonato por jogador (somando temporadas). */
export function agregarVitoriasPorJogador(linhas: CampeonatoDto[]): LinhaVitorias[] {
  const mapa = new Map<string, LinhaVitorias>();
  for (const linha of linhas) {
    const chave = comoTexto(linha.player_id);
    const atual = mapa.get(chave) ?? {
      playerId: linha.player_id,
      nome: linha.nome?.trim() || `#${chave}`,
      vitorias: 0,
    };
    atual.vitorias += linha.vitorias ?? 0;
    if (linha.nome?.trim()) atual.nome = linha.nome.trim();
    mapa.set(chave, atual);
  }
  return [...mapa.values()];
}

/** Soma contagens de itens por jogador. */
export function agregarItensPorJogador(linhas: ItemContagemDto[]): LinhaItens[] {
  const mapa = new Map<string, LinhaItens>();
  for (const linha of linhas) {
    const chave = comoTexto(linha.player_id);
    const atual = mapa.get(chave) ?? {
      playerId: linha.player_id,
      nome: linha.nome?.trim() || `#${chave}`,
      total: 0,
      aquisicoes: 0,
    };
    atual.total += linha.total ?? 0;
    atual.aquisicoes += linha.aquisicoes ?? 0;
    if (linha.nome?.trim()) atual.nome = linha.nome.trim();
    mapa.set(chave, atual);
  }
  return [...mapa.values()];
}
