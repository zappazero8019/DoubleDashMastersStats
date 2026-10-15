#!/usr/bin/env node
// ===========================================================================
// tools/gerador-dados.mjs
// ===========================================================================
//
// Gerador do `dados.json` público do painel Double Dash Masters.
//
// ENTREGA APENAS O QUE É RECONSTRUÍVEL com segurança a partir de CÓPIAS dos
// arquivos de sessão FINALIZADOS do MKDDTracker
// (`%APPDATA%\MKTracker\sessoes\{sessao_id}.json`).
//
// O que o arquivo de sessão REALMENTE contém (ver
// mk_tracker/stats/session_manager.py):
//
//   versao, sessao_id, revisao, iniciada_em, finalizada_em, status,
//   jogadores[{player_id, nome}], baseline{pontuacao, contagens},
//   tempos{pid:{pos:seg}}, url_live, colocacoes{pid:pos}
//
// ATENÇÃO (limitação real documentada): a sessão arquivada NÃO guarda as
// contagens FINAIS de itens nem os pontos ganhos na live — só `colocacoes`
// (o resultado oficial). Logo este gerador NÃO consegue reproduzir:
//
//   - itens / relampagos / cascos_azuis        (vêm de `item_contagens`, que
//                                                só existe via sincronização)
//   - vencedor_pontos                           (pontuação da live)
//   - pontos_totais_live / melhor_live          (pontuação por jogador)
//
// Nesses casos o gerador emite `null` e lista o campo em
// `campos_indisponiveis` — NUNCA inventa números.
//
// Garantias: determinístico, idempotente, somente-leitura na origem, valida
// esquema, detecta `sessao_id` duplicado (falha segura) e NUNCA inclui
// baseline/tempos/eventos/tokens.
//
// Uso:
//   node tools/gerador-dados.mjs \
//        --sessoes <pasta-com-copias> \
//        --saida tools/saida/dados.json \
//        --relatorio tools/saida/relatorio.json
// ===========================================================================

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const SCHEMA = 1;
const VERSAO_SESSAO_SUPORTADA = 1;
const POSICOES_VALIDAS = new Set([1, 2, 3, 4]);

// Chaves que NUNCA podem aparecer na saída (dados privados/segredos).
const CHAVES_PROIBIDAS = [
  'baseline',
  'tempos',
  'revisao',
  'sync_url',
  'sync_token',
  'token',
  'secret',
  'senha',
  'password',
  'apikey',
  'anon_key',
  'service_role',
];

export class ErroValidacao extends Error {
  constructor(mensagem, detalhes = []) {
    super(mensagem);
    this.name = 'ErroValidacao';
    this.detalhes = detalhes;
  }
}

/**
 * Normaliza um id de sessão para UUID canônico 8-4-4-4-12 (mesma forma que a
 * API expõe e que `src/utils/identificadores.ts` valida). Hex puro de 32
 * dígitos ganha hífens; qualquer outra coisa é devolvida como veio.
 */
export function formatarUuid(id) {
  const hex = String(id ?? '')
    .replace(/-/g, '')
    .toLowerCase();
  if (/^[0-9a-f]{32}$/.test(hex)) {
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return String(id ?? '');
}

function anoIso(valor) {
  if (!valor) return null;
  const texto = String(valor);
  const ano = Number.parseInt(texto.slice(0, 4), 10);
  return Number.isFinite(ano) ? ano : null;
}

/**
 * Valida UMA sessão (objeto já parseado). Devolve { ok, sessao?, motivo? }.
 * Nunca lança: problemas viram motivo de descarte.
 */
export function validarSessao(dados, arquivo = '') {
  if (typeof dados !== 'object' || dados === null || Array.isArray(dados)) {
    return { ok: false, motivo: 'nao_e_objeto' };
  }
  const status = dados.status;
  if (status !== 'finalizada') {
    return { ok: false, motivo: status === 'ativa' ? 'sessao_ativa' : 'nao_finalizada' };
  }
  const versao = dados.versao;
  if (versao !== undefined && versao !== VERSAO_SESSAO_SUPORTADA) {
    return { ok: false, motivo: `versao_nao_suportada:${versao}` };
  }
  const sessaoId = dados.sessao_id;
  if (typeof sessaoId !== 'string' || sessaoId.trim() === '') {
    return { ok: false, motivo: 'sessao_id_ausente' };
  }
  if (!Array.isArray(dados.jogadores) || dados.jogadores.length === 0) {
    return { ok: false, motivo: 'jogadores_ausentes' };
  }
  const ids = new Set();
  for (const jogador of dados.jogadores) {
    if (typeof jogador !== 'object' || jogador === null) {
      return { ok: false, motivo: 'jogador_invalido', arquivo };
    }
    if (!Number.isInteger(jogador.player_id)) {
      return { ok: false, motivo: 'player_id_invalido', arquivo };
    }
    ids.add(jogador.player_id);
  }
  if (typeof dados.colocacoes !== 'object' || dados.colocacoes === null) {
    return { ok: false, motivo: 'colocacoes_ausentes', arquivo };
  }
  for (const [chave, valor] of Object.entries(dados.colocacoes)) {
    const pid = Number.parseInt(chave, 10);
    if (!ids.has(pid)) {
      return { ok: false, motivo: 'colocacao_de_jogador_desconhecido', arquivo };
    }
    if (!Number.isInteger(valor) || !POSICOES_VALIDAS.has(valor)) {
      return { ok: false, motivo: 'colocacao_fora_de_1a4', arquivo };
    }
  }
  if (!dados.finalizada_em || anoIso(dados.finalizada_em) === null) {
    return { ok: false, motivo: 'finalizada_em_invalida', arquivo };
  }
  return { ok: true, sessao: dados };
}

/** Nome "canônico" do jogador: o lexicograficamente maior (espelha max(nome)). */
function nomeCanonico(mapaNomes) {
  let melhor = '';
  for (const nome of mapaNomes) {
    const texto = String(nome ?? '');
    if (texto > melhor) melhor = texto;
  }
  return melhor;
}

/** Vencedor da live: colocação 1; empate resolvido pelo menor player_id (API). */
function vencedorDaSessao(sessao) {
  const candidatos = [];
  for (const [chave, posicao] of Object.entries(sessao.colocacoes)) {
    if (posicao === 1) candidatos.push(Number.parseInt(chave, 10));
  }
  if (candidatos.length === 0) return null;
  candidatos.sort((a, b) => a - b);
  const vencedor = candidatos[0];
  const registro = (sessao.jogadores || []).find((j) => j.player_id === vencedor);
  return { player_id: vencedor, nome: registro ? String(registro.nome ?? '') : '' };
}

/**
 * Monta o objeto público a partir das sessões JÁ VALIDADAS.
 * Puro e determinístico (não usa relógio).
 */
export function montarDados(sessoes) {
  const porTemporada = new Map();
  const participacoes = new Map();
  const nomesPorJogador = new Map();
  const sessaoIds = new Set();

  for (const sessao of sessoes) {
    const temporada = anoIso(sessao.finalizada_em);
    porTemporada.set(temporada, (porTemporada.get(temporada) ?? 0) + 1);
    sessaoIds.add(sessao.sessao_id);

    for (const jogador of sessao.jogadores) {
      const pid = jogador.player_id;
      participacoes.set(pid, (participacoes.get(pid) ?? 0) + 1);
      if (!nomesPorJogador.has(pid)) nomesPorJogador.set(pid, new Set());
      nomesPorJogador.get(pid).add(String(jogador.nome ?? ''));
    }
  }

  // ---- lives (ordem finalizada_em DESC, desempate sessao_id ASC) ----
  const lives = [...sessoes]
    .sort((a, b) => {
      if (a.finalizada_em !== b.finalizada_em) {
        return a.finalizada_em < b.finalizada_em ? 1 : -1;
      }
      return a.sessao_id < b.sessao_id ? -1 : a.sessao_id > b.sessao_id ? 1 : 0;
    })
    .map((sessao) => {
      const vencedor = vencedorDaSessao(sessao);
      return {
        sessao_id: formatarUuid(sessao.sessao_id),
        temporada: anoIso(sessao.finalizada_em),
        iniciada_em: sessao.iniciada_em ?? null,
        finalizada_em: sessao.finalizada_em ?? null,
        url_live: sessao.url_live ?? '',
        vencedor_player_id: vencedor ? vencedor.player_id : null,
        vencedor_nome: vencedor ? vencedor.nome : null,
        vencedor_pontos: null, // indisponível: não está na sessão arquivada
      };
    });

  // ---- campeonato: uma vitória por vida vencida (colocacao == 1) ----
  const vitorias = new Map();
  for (const sessao of sessoes) {
    const temporada = anoIso(sessao.finalizada_em);
    for (const [chave, posicao] of Object.entries(sessao.colocacoes)) {
      if (posicao !== 1) continue;
      const pid = Number.parseInt(chave, 10);
      const chaveCamp = `${temporada}|${pid}`;
      vitorias.set(chaveCamp, (vitorias.get(chaveCamp) ?? 0) + 1);
    }
  }
  const campeonato = [...vitorias.entries()]
    .map(([chaveCamp, qtd]) => {
      const [temporadaTexto, pidTexto] = chaveCamp.split('|');
      const pid = Number.parseInt(pidTexto, 10);
      return {
        temporada: Number.parseInt(temporadaTexto, 10),
        player_id: pid,
        nome: nomeCanonico(nomesPorJogador.get(pid) ?? []),
        vitorias: qtd,
      };
    })
    .sort(
      (a, b) =>
        b.vitorias - a.vitorias ||
        (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0) ||
        a.player_id - b.player_id,
    );

  // ---- jogadores: participações contável; pontos indisponíveis ----
  const jogadores = [...participacoes.keys()]
    .map((pid) => ({
      player_id: pid,
      nome: nomeCanonico(nomesPorJogador.get(pid) ?? []),
      lives_participadas: participacoes.get(pid),
      pontos_totais_live: null, // indisponível
      melhor_live: null, // indisponível
    }))
    .sort((a, b) => (a.nome < b.nome ? -1 : a.nome > b.nome ? 1 : 0) || a.player_id - b.player_id);

  const jogadoresUnicos = participacoes.size;
  const atualizadoEm =
    lives.length > 0 ? lives[0].finalizada_em : null; // lives[0] = mais recente

  const camposIndisponiveis = [
    'geral.itens_totais',
    'geral.relampagos',
    'geral.cascos_azuis',
    'lives[].vencedor_pontos',
    'jogadores[].pontos_totais_live',
    'jogadores[].melhor_live',
    'itens',
    'relampagos',
    'cascos_azuis',
  ];

  return {
    schema: SCHEMA,
    atualizado_em: atualizadoEm,
    temporadas: [...porTemporada.keys()].sort((a, b) => a - b),
    disponibilidade: {
      geral: 'parcial',
      lives: 'parcial',
      campeonato: 'completo',
      jogadores: 'parcial',
      itens: 'indisponivel',
      relampagos: 'indisponivel',
      cascos_azuis: 'indisponivel',
    },
    campos_indisponiveis: camposIndisponiveis,
    recursos: {
      geral: {
        lives_finalizadas: lives.length,
        lives_em_andamento: 0, // arquivos arquivados não guardam a sessão ativa
        jogadores: jogadoresUnicos,
        itens_totais: null,
        relampagos: null,
        cascos_azuis: null,
      },
      lives,
      campeonato,
      jogadores,
      itens: null,
      relampagos: null,
      cascos_azuis: null,
    },
  };
}

/** Garante que a saída não contém chaves proibidas (recursivo). */
export function auditarSeguranca(objeto, caminho = '$') {
  const achados = [];
  if (Array.isArray(objeto)) {
    objeto.forEach((item, i) => achados.push(...auditarSeguranca(item, `${caminho}[${i}]`)));
  } else if (objeto && typeof objeto === 'object') {
    for (const [chave, valor] of Object.entries(objeto)) {
      if (CHAVES_PROIBIDAS.includes(chave.toLowerCase())) {
        achados.push(`${caminho}.${chave}`);
      }
      achados.push(...auditarSeguranca(valor, `${caminho}.${chave}`));
    }
  }
  return achados;
}

/**
 * Lê CÓPIAS de sessões de um diretório e devolve { dados, relatorio }.
 * Lança ErroValidacao em inconsistência bloqueante (ex.: sessao_id duplicado
 * ou nenhuma sessão válida) — nunca gera um agregado duvidoso.
 */
export function gerarDeDiretorio(dirSessoes) {
  const pasta = resolve(dirSessoes);
  const relatorio = {
    schema: SCHEMA,
    pasta_origem: pasta,
    arquivos_lidos: 0,
    sessoes_aceitas: 0,
    ignoradas: [],
    invalidas: [],
    duplicadas: [],
    avisos: [],
    campos_indisponiveis: [],
  };

  if (!existsSync(pasta) || !statSync(pasta).isDirectory()) {
    throw new ErroValidacao(`Pasta de sessões inexistente: ${pasta}`);
  }

  const arquivos = readdirSync(pasta)
    .filter((nome) => nome.toLowerCase().endsWith('.json'))
    .sort();

  const aceitas = [];
  const vistos = new Map(); // sessao_id -> arquivo

  for (const nome of arquivos) {
    const caminho = join(pasta, nome);
    relatorio.arquivos_lidos += 1;
    let conteudo;
    try {
      conteudo = JSON.parse(readFileSync(caminho, 'utf-8'));
    } catch (erro) {
      relatorio.invalidas.push({ arquivo: nome, motivo: `json_invalido:${erro.message}` });
      continue;
    }
    const resultado = validarSessao(conteudo, nome);
    if (!resultado.ok) {
      if (resultado.motivo === 'sessao_ativa') {
        relatorio.ignoradas.push({ arquivo: nome, motivo: 'sessao_ativa' });
      } else {
        relatorio.invalidas.push({ arquivo: nome, motivo: resultado.motivo });
      }
      continue;
    }
    const sessaoId = resultado.sessao.sessao_id;
    if (vistos.has(sessaoId)) {
      relatorio.duplicadas.push({
        sessao_id: sessaoId,
        arquivos: [vistos.get(sessaoId), nome],
      });
      continue;
    }
    vistos.set(sessaoId, nome);
    aceitas.push(resultado.sessao);
  }

  relatorio.sessoes_aceitas = aceitas.length;

  if (relatorio.duplicadas.length > 0) {
    throw new ErroValidacao('sessao_id duplicado encontrado', relatorio.duplicadas);
  }
  if (aceitas.length === 0) {
    throw new ErroValidacao('nenhuma sessão finalizada válida encontrada', relatorio.invalidas);
  }

  const dados = montarDados(aceitas);

  const seguranca = auditarSeguranca(dados);
  if (seguranca.length > 0) {
    throw new ErroValidacao(`saída contém campos proibidos: ${seguranca.join(', ')}`);
  }

  relatorio.campos_indisponiveis = dados.campos_indisponiveis;
  relatorio.avisos.push(
    'itens e pontuações NÃO são reconstruíveis a partir das sessões arquivadas ' +
      '(só existem via sincronização); foram emitidos como null.',
  );
  if (aceitas.length <= 2) {
    relatorio.avisos.push(
      `histórico local insuficiente para representar o site (${aceitas.length} sessão(ões)).`,
    );
  }

  return { dados, relatorio };
}

function lerArgs(argv) {
  const args = { sessoes: null, saida: null, relatorio: null };
  for (let i = 0; i < argv.length; i += 1) {
    const atual = argv[i];
    if (atual === '--sessoes') args.sessoes = argv[++i];
    else if (atual === '--saida') args.saida = argv[++i];
    else if (atual === '--relatorio') args.relatorio = argv[++i];
  }
  return args;
}

function escreverJson(caminho, objeto) {
  const destino = resolve(caminho);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, `${JSON.stringify(objeto, null, 2)}\n`, 'utf-8');
  return destino;
}

/** CLI. Devolve o código de saída (0 ok, 2 falha segura). */
export function main(argv = process.argv.slice(2)) {
  const args = lerArgs(argv);
  if (!args.sessoes) {
    console.error('uso: node tools/gerador-dados.mjs --sessoes <pasta> [--saida arq] [--relatorio arq]');
    return 2;
  }
  const saida = args.saida ?? 'tools/saida/dados.json';
  const relatorioPath = args.relatorio ?? 'tools/saida/relatorio.json';

  let resultado;
  try {
    resultado = gerarDeDiretorio(args.sessoes);
  } catch (erro) {
    if (erro instanceof ErroValidacao) {
      const relatorioFalha = {
        schema: SCHEMA,
        status: 'falha_segura',
        erro: erro.message,
        detalhes: erro.detalhes,
      };
      escreverJson(relatorioPath, relatorioFalha);
      console.error(`FALHA SEGURA: ${erro.message}`);
      console.error(`relatório: ${resolve(relatorioPath)}`);
      return 2;
    }
    throw erro;
  }

  escreverJson(saida, resultado.dados);
  const relatorio = { ...resultado.relatorio, status: 'ok', saida: resolve(saida) };
  escreverJson(relatorioPath, relatorio);
  console.log(`dados.json: ${resolve(saida)}`);
  console.log(`relatório:  ${resolve(relatorioPath)}`);
  console.log(
    `aceitas=${relatorio.sessoes_aceitas} ignoradas=${relatorio.ignoradas.length} ` +
      `invalidas=${relatorio.invalidas.length}`,
  );
  return 0;
}

// Só executa como CLI quando chamado diretamente.
const chamadoDireto = process.argv[1] && process.argv[1].endsWith('gerador-dados.mjs');
if (chamadoDireto) {
  process.exit(main());
}
