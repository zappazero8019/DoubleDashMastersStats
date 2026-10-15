#!/usr/bin/env node
// ===========================================================================
// tools/exportar-api.mjs
// ===========================================================================
//
// Exporta as estatísticas PÚBLICAS do MKDDTracker da API de leitura atual
// (`GET /stats?recurso=...`) para um `dados.json` consolidado, compatível com o
// adaptador experimental do painel (`src/api/client.ts`, VITE_FONTE_DADOS=json).
//
// SOMENTE LEITURA. Não escreve na API/Supabase, não usa credenciais, não publica
// nada e NÃO troca a fonte de dados do painel.
//
// Recursos públicos consultados (ver api-site/netlify/functions/stats.js):
//   geral, lives, campeonato, jogadores, itens, relampagos, cascos_azuis
//
// Garantias:
//   - apenas GET nos endpoints públicos existentes (sem token/segredo);
//   - valida o envelope `{ok,recurso,dados}` de cada recurso;
//   - detecta TRUNCAMENTO (limite de 500 sem paginação => não aprovado);
//   - detecta DUPLICIDADES e INCONSISTÊNCIAS entre recursos/agregados;
//   - preserva IDs, datas e fusos horários (nada é reinterpretado);
//   - falha segura (exit != 0) e NÃO sobrescreve um JSON válido anterior;
//   - escrita atômica (tmp + rename) só após TODAS as validações passarem;
//   - nunca inventa valores nem altera regras de classificação;
//   - auditoria de chaves proibidas (baseline/eventos/tokens) na saída.
//
// Limitações reais (documentadas em `campos_indisponiveis`): a API pública NÃO
// expõe tempos/colocações por corrida, placar individual por live, participantes
// completos, baseline nem eventos brutos.
//
// Uso:
//   node tools/exportar-api.mjs --base <url> --saida tools/saida/dados.json \
//        --relatorio tools/saida/relatorio-exportacao.json [--timeout 15000]
//   Variáveis de ambiente: MKDD_API_URL, MKDD_TIMEOUT_MS.
// ===========================================================================

import { mkdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const SCHEMA = 1;
export const LIMITE_MAX = 500;
export const TIMEOUT_PADRAO_MS = 15000;
export const BASE_PADRAO = 'https://mkddtracker-api.netlify.app';

// Recursos públicos. `geral` devolve 1 linha; os demais, listas (limite 500).
export const RECURSOS = [
  'geral',
  'lives',
  'campeonato',
  'jogadores',
  'itens',
  'relampagos',
  'cascos_azuis',
];

// Campos que a API pública, hoje, NÃO permite reconstruir. São documentados na
// saída — nunca aproximados.
export const CAMPOS_INDISPONIVEIS = [
  'tempos',
  'colocacoes_por_live',
  'pontuacao_por_live',
  'participantes_por_live',
  'baseline',
  'eventos',
];

// Chaves que NUNCA podem aparecer na saída (dados privados/segredos).
const CHAVES_PROIBIDAS = [
  'baseline',
  'revisao',
  'eventos',
  'sync_url',
  'sync_token',
  'token',
  'secret',
  'senha',
  'password',
  'apikey',
  'anon_key',
  'service_role',
  'authorization',
];

export class ErroExportacao extends Error {
  constructor(codigo, mensagem, detalhes = []) {
    super(mensagem);
    this.name = 'ErroExportacao';
    this.codigo = codigo;
    this.detalhes = detalhes;
  }
}

/** Normaliza id de sessão para UUID canônico 8-4-4-4-12 (paridade com a API). */
export function uuidCanonico(id) {
  const hex = String(id ?? '')
    .replace(/-/g, '')
    .toLowerCase();
  if (/^[0-9a-f]{32}$/.test(hex)) {
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  return String(id ?? '');
}

/** ISO-8601 com fuso local (ex.: 2026-10-13T18:00:00-03:00). */
export function isoAgora(data) {
  const base = data instanceof Date ? data : new Date(data);
  const offsetMin = -base.getTimezoneOffset();
  const sinal = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  const local = new Date(base.getTime() - base.getTimezoneOffset() * 60000);
  return `${local.toISOString().slice(0, 19)}${sinal}${hh}:${mm}`;
}

/** Monta a URL de um recurso (só parâmetros públicos). */
export function urlRecurso(baseUrl, recurso, params = {}) {
  const url = new URL('/stats', baseUrl);
  url.searchParams.set('recurso', recurso);
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== '') {
      url.searchParams.set(chave, String(valor));
    }
  }
  return url.toString();
}

/**
 * Busca UM recurso. Só aceita o envelope `{ok:true,recurso,dados:[...]}`.
 * Lança ErroExportacao em rede/timeout/HTTP/envelope inválidos.
 */
export async function buscarRecurso(recurso, { baseUrl, fetchImpl, timeoutMs, params } = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new ErroExportacao('config', 'fetchImpl ausente');
  }
  const url = urlRecurso(baseUrl, recurso, params);
  const controlador = new AbortController();
  let porTimeout = false;
  const temporizador = setTimeout(() => {
    porTimeout = true;
    controlador.abort();
  }, timeoutMs);

  let resposta;
  try {
    resposta = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controlador.signal,
    });
  } catch (erro) {
    if (porTimeout) {
      throw new ErroExportacao('timeout', `tempo excedido (${timeoutMs} ms) ao ler "${recurso}"`);
    }
    if (erro instanceof ErroExportacao) throw erro;
    throw new ErroExportacao('rede', `falha de rede ao ler "${recurso}": ${erro?.message ?? erro}`);
  } finally {
    clearTimeout(temporizador);
  }

  if (!resposta || resposta.ok !== true) {
    const status = resposta && typeof resposta.status === 'number' ? resposta.status : 0;
    throw new ErroExportacao('http', `HTTP ${status} ao ler "${recurso}"`, [{ recurso, status }]);
  }

  let corpo;
  try {
    corpo = await resposta.json();
  } catch (erro) {
    throw new ErroExportacao('resposta', `resposta não é JSON em "${recurso}": ${erro?.message ?? erro}`);
  }

  if (
    typeof corpo !== 'object' ||
    corpo === null ||
    corpo.ok !== true ||
    !Array.isArray(corpo.dados)
  ) {
    throw new ErroExportacao('envelope', `envelope inesperado em "${recurso}"`);
  }
  if (String(corpo.recurso) !== String(recurso)) {
    throw new ErroExportacao(
      'envelope',
      `envelope de "${recurso}" veio rotulado como "${corpo.recurso}"`,
    );
  }
  return corpo.dados;
}

/**
 * Coleta todos os recursos. Cada lista é pedida com `limite=LIMITE_MAX` para
 * maximizar a cobertura e permitir detectar truncamento.
 */
export async function coletarRecursos({ baseUrl, fetchImpl, timeoutMs } = {}) {
  const bruto = {};
  for (const recurso of RECURSOS) {
    const params = recurso === 'geral' ? {} : { limite: LIMITE_MAX };
    bruto[recurso] = await buscarRecurso(recurso, { baseUrl, fetchImpl, timeoutMs, params });
  }
  return bruto;
}

// ---------------------------------------------------------------------------
// Validação / consolidação (pura, determinística).
// ---------------------------------------------------------------------------

function exigir(condicao, codigo, mensagem, detalhes) {
  if (!condicao) throw new ErroExportacao(codigo, mensagem, detalhes);
}

function ehNumeroFinito(valor) {
  return typeof valor === 'number' && Number.isFinite(valor);
}

function somaTotal(linhas) {
  return linhas.reduce((acc, linha) => acc + (Number(linha?.total) || 0), 0);
}

/** Detecta chaves proibidas recursivamente. Devolve a lista de caminhos. */
export function auditarChavesProibidas(valor, caminho = '$') {
  const achados = [];
  if (Array.isArray(valor)) {
    valor.forEach((item, i) => achados.push(...auditarChavesProibidas(item, `${caminho}[${i}]`)));
    return achados;
  }
  if (valor && typeof valor === 'object') {
    for (const [chave, filho] of Object.entries(valor)) {
      if (CHAVES_PROIBIDAS.includes(chave.toLowerCase())) achados.push(`${caminho}.${chave}`);
      achados.push(...auditarChavesProibidas(filho, `${caminho}.${chave}`));
    }
  }
  return achados;
}

function camposDeLives(l) {
  return ['sessao_id', 'temporada', 'iniciada_em', 'finalizada_em', 'url_live'];
}

/**
 * Consolida o bruto em `{ dados, relatorio }`. NÃO escreve nada.
 * `dados` só deve ser gravado se `relatorio.completo === true`.
 */
export function consolidar(bruto, { agora = new Date(), baseUrl = BASE_PADRAO } = {}) {
  const verificacoes = [];
  const avisos = [];
  const duplicadas = [];
  const truncados = [];
  const verificar = (nome, ok, detalhe) => verificacoes.push({ nome, ok: !!ok, detalhe: detalhe ?? '' });

  // --- estrutura mínima de cada recurso ---
  for (const recurso of RECURSOS) {
    exigir(Array.isArray(bruto[recurso]), 'recurso', `recurso "${recurso}" não é uma lista`);
  }
  exigir(bruto.geral.length === 1, 'recurso', '"geral" deveria ter exatamente 1 linha');

  const geral = bruto.geral[0];
  const camposGeral = [
    'lives_finalizadas',
    'lives_em_andamento',
    'jogadores',
    'itens_totais',
    'relampagos',
    'cascos_azuis',
  ];
  for (const campo of camposGeral) {
    exigir(ehNumeroFinito(geral?.[campo]), 'recurso', `"geral.${campo}" ausente ou não numérico`);
  }

  const { lives, campeonato, jogadores, itens, relampagos, cascos_azuis } = bruto;

  // --- truncamento (limite 500 sem paginação => completude indeterminável) ---
  for (const recurso of RECURSOS) {
    if (recurso === 'geral') continue;
    if (bruto[recurso].length >= LIMITE_MAX) {
      truncados.push(recurso);
      avisos.push(
        `recurso "${recurso}" retornou ${bruto[recurso].length} linhas (= limite ${LIMITE_MAX}) ` +
          'e a API não oferece paginação: a completude NÃO pode ser confirmada.',
      );
    }
  }

  // --- presença de campos esperados (por linha) ---
  const faltando = [];
  for (const l of lives) for (const c of camposDeLives(l)) if (l?.[c] === undefined) faltando.push(`lives.${c}`);
  for (const j of jogadores) {
    for (const c of ['player_id', 'nome', 'lives_participadas']) {
      if (j?.[c] === undefined) faltando.push(`jogadores.${c}`);
    }
  }
  for (const it of itens) {
    for (const c of ['sessao_id', 'player_id', 'nome_item', 'classe', 'total']) {
      if (it?.[c] === undefined) faltando.push(`itens.${c}`);
    }
  }
  verificar('campos_esperados', faltando.length === 0, faltando.slice(0, 5).join(', '));

  // --- duplicidades ---
  const chaveDuplicada = (linhas, fn, rotulo) => {
    const vistos = new Map();
    for (const linha of linhas) {
      const k = fn(linha);
      if (vistos.has(k)) {
        duplicadas.push({ recurso: rotulo, chave: k, ocorrencias: vistos.get(k) + 1 });
      }
      vistos.set(k, (vistos.get(k) ?? 0) + 1);
    }
  };
  chaveDuplicada(lives, (l) => uuidCanonico(l.sessao_id), 'lives.sessao_id');
  chaveDuplicada(jogadores, (j) => String(j.player_id), 'jogadores.player_id');
  chaveDuplicada(campeonato, (c) => `${c.temporada}|${c.player_id}`, 'campeonato.temporada|player_id');
  chaveDuplicada(
    itens,
    (it) => `${uuidCanonico(it.sessao_id)}|${it.player_id}|${String(it.nome_item)}`,
    'itens.sessao_id|player_id|nome_item',
  );
  verificar('sem_duplicidades', duplicadas.length === 0, duplicadas.map((d) => d.recurso).join(', '));

  // --- reconciliação de agregados (só quando não truncado) ---
  const livesOk = !truncados.includes('lives');
  const itensOk = !truncados.includes('itens');
  const jogadoresOk = !truncados.includes('jogadores');

  if (truncados.length > 0) {
    verificar('agregados', false, `não verificável: recurso(s) truncado(s): ${truncados.join(', ')}`);
  } else {
    verificar(
      'geral.lives_finalizadas == lives.length',
      geral.lives_finalizadas === lives.length,
      `${geral.lives_finalizadas} vs ${lives.length}`,
    );
    verificar(
      'geral.jogadores == jogadores distintos',
      geral.jogadores === jogadores.length,
      `${geral.jogadores} vs ${jogadores.length}`,
    );
    const totalItens = somaTotal(itens);
    verificar('Σ itens.total == geral.itens_totais', totalItens === geral.itens_totais, `${totalItens} vs ${geral.itens_totais}`);
    const totalRelampagos = somaTotal(itens.filter((i) => i.classe === 'relampago'));
    verificar(
      'Σ relâmpagos == geral.relampagos',
      totalRelampagos === geral.relampagos,
      `${totalRelampagos} vs ${geral.relampagos}`,
    );
    const totalCascos = somaTotal(itens.filter((i) => i.classe === 'casco_azul'));
    verificar(
      'Σ cascos azuis == geral.cascos_azuis',
      totalCascos === geral.cascos_azuis,
      `${totalCascos} vs ${geral.cascos_azuis}`,
    );

    const totalVitorias = campeonato.reduce((acc, c) => acc + (Number(c.vitorias) || 0), 0);
    verificar(
      'Σ campeonato.vitorias == nº de lives',
      totalVitorias === lives.length,
      `${totalVitorias} vs ${lives.length}`,
    );

    // --- coerência entre recursos (subconjuntos) ---
    const idsLives = new Set(lives.map((l) => uuidCanonico(l.sessao_id)));
    const orfaosItens = itens.filter((i) => !idsLives.has(uuidCanonico(i.sessao_id))).length;
    verificar('todo itens.sessao_id ∈ lives', orfaosItens === 0, `órfãos: ${orfaosItens}`);

    const chaveItem = (i) => `${uuidCanonico(i.sessao_id)}|${i.player_id}|${i.nome_item}`;
    const setItens = new Set(itens.map(chaveItem));
    const relampagosFora = relampagos.filter((r) => !setItens.has(chaveItem(r)) || r.classe !== 'relampago').length;
    const cascosFora = cascos_azuis.filter((r) => !setItens.has(chaveItem(r)) || r.classe !== 'casco_azul').length;
    verificar('relampagos ⊆ itens', relampagosFora === 0, `fora: ${relampagosFora}`);
    verificar('cascos_azuis ⊆ itens', cascosFora === 0, `fora: ${cascosFora}`);
    verificar(
      'nº relampagos == itens classe relampago',
      relampagos.length === itens.filter((i) => i.classe === 'relampago').length,
    );
    verificar(
      'nº cascos_azuis == itens classe casco_azul',
      cascos_azuis.length === itens.filter((i) => i.classe === 'casco_azul').length,
    );

    const idsJogadores = new Set(jogadores.map((j) => String(j.player_id)));
    const campFora = campeonato.filter((c) => !idsJogadores.has(String(c.player_id))).length;
    verificar('campeonato.player_id ∈ jogadores', campFora === 0, `fora: ${campFora}`);
  }

  // --- metadados ---
  const temporadas = [...new Set(lives.map((l) => l?.temporada).filter((t) => Number.isFinite(t)))].sort(
    (a, b) => a - b,
  );
  const atualizadoEm = lives
    .map((l) => l.finalizada_em)
    .filter((v) => typeof v === 'string')
    .sort()
    .at(-1) ?? null;

  const incompleto = truncados.length > 0 || verificacoes.some((v) => !v.ok);

  const dados = {
    schema: SCHEMA,
    gerado_em: isoAgora(agora),
    fonte: String(baseUrl),
    atualizado_em: atualizadoEm,
    temporadas,
    disponibilidade: Object.fromEntries(
      RECURSOS.map((r) => [r, r !== 'geral' && truncados.includes(r) ? 'incompleto' : 'completo']),
    ),
    completude: {
      completo: !incompleto,
      recursos: Object.fromEntries(
        RECURSOS.map((r) => [
          r,
          { linhas: bruto[r].length, truncado: r !== 'geral' && truncados.includes(r) },
        ]),
      ),
      verificacoes,
      avisos,
    },
    campos_indisponiveis: [...CAMPOS_INDISPONIVEIS],
    recursos: {
      geral,
      lives,
      campeonato,
      jogadores,
      itens,
      relampagos,
      cascos_azuis,
    },
  };

  const proibidas = auditarChavesProibidas(dados);
  exigir(proibidas.length === 0, 'seguranca', `saída contém chaves proibidas: ${proibidas.join(', ')}`);

  const relatorio = {
    schema: SCHEMA,
    status: incompleto ? 'falha_segura' : 'ok',
    gerado_em: dados.gerado_em,
    fonte: String(baseUrl),
    completo: !incompleto,
    recursos: dados.completude.recursos,
    truncados,
    duplicadas,
    verificacoes,
    avisos,
    campos_indisponiveis: [...CAMPOS_INDISPONIVEIS],
  };

  return { dados, relatorio };
}

/** Exporta (busca + consolida). NÃO escreve arquivo. */
export async function exportar({ baseUrl = BASE_PADRAO, fetchImpl, timeoutMs = TIMEOUT_PADRAO_MS, agora = new Date() } = {}) {
  const bruto = await coletarRecursos({ baseUrl, fetchImpl, timeoutMs });
  return consolidar(bruto, { agora, baseUrl });
}

/** Escreve JSON de forma atômica (tmp no mesmo diretório + rename). */
export function escreverAtomico(caminho, objeto) {
  const destino = resolve(caminho);
  mkdirSync(dirname(destino), { recursive: true });
  const temporario = `${destino}.tmp-${process.pid}-${Date.now()}`;
  try {
    writeFileSync(temporario, `${JSON.stringify(objeto, null, 2)}\n`, 'utf-8');
    renameSync(temporario, destino);
  } catch (erro) {
    try {
      rmSync(temporario, { force: true });
    } catch {
      /* ignora: nada a limpar */
    }
    throw erro;
  }
  return destino;
}

function escreverJson(caminho, objeto) {
  const destino = resolve(caminho);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, `${JSON.stringify(objeto, null, 2)}\n`, 'utf-8');
  return destino;
}

/** Resumo legível para o terminal. */
export function resumoTexto(relatorio) {
  const linhas = [];
  linhas.push(
    `exportação: ${relatorio.completo ? 'COMPLETA' : 'INCOMPLETA'} (status=${relatorio.status})`,
  );
  linhas.push(`fonte: ${relatorio.fonte}`);
  linhas.push(`gerado_em: ${relatorio.gerado_em}`);
  for (const [recurso, info] of Object.entries(relatorio.recursos)) {
    linhas.push(`  ${recurso}: ${info.linhas} linha(s)${info.truncado ? ' [TRUNCADO]' : ''}`);
  }
  const falhas = (relatorio.verificacoes ?? []).filter((v) => !v.ok);
  if (falhas.length > 0) {
    linhas.push('verificações que FALHARAM:');
    for (const f of falhas) linhas.push(`  - ${f.nome}${f.detalhe ? ` (${f.detalhe})` : ''}`);
  }
  for (const aviso of relatorio.avisos ?? []) linhas.push(`aviso: ${aviso}`);
  linhas.push(`campos indisponíveis: ${(relatorio.campos_indisponiveis ?? []).join(', ')}`);
  return linhas.join('\n');
}

export function lerArgs(argv) {
  const args = { base: null, saida: null, relatorio: null, timeout: null };
  for (let i = 0; i < argv.length; i += 1) {
    const atual = argv[i];
    if (atual === '--base') args.base = argv[++i];
    else if (atual === '--saida') args.saida = argv[++i];
    else if (atual === '--relatorio') args.relatorio = argv[++i];
    else if (atual === '--timeout') args.timeout = argv[++i];
  }
  return args;
}

/**
 * CLI. Devolve o código de saída:
 *   0 = exportação completa e arquivo gravado
 *   2 = falha segura (erro ou incompletude; arquivo de dados NÃO foi tocado)
 */
export async function main(argv = process.argv.slice(2), deps = {}) {
  const args = lerArgs(argv);
  const baseUrl = args.base || process.env.MKDD_API_URL || BASE_PADRAO;
  const timeoutMs =
    Number.parseInt(args.timeout ?? process.env.MKDD_TIMEOUT_MS ?? '', 10) || TIMEOUT_PADRAO_MS;
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const agora = deps.agora ? deps.agora() : new Date();
  const saida = args.saida ?? 'tools/saida/dados.json';
  const relatorioPath = args.relatorio ?? 'tools/saida/relatorio-exportacao.json';

  let resultado;
  try {
    resultado = await exportar({ baseUrl, fetchImpl, timeoutMs, agora });
  } catch (erro) {
    if (erro instanceof ErroExportacao) {
      escreverJson(relatorioPath, {
        schema: SCHEMA,
        status: 'falha_segura',
        erro: erro.message,
        codigo: erro.codigo,
        detalhes: erro.detalhes,
        fonte: String(baseUrl),
      });
      console.error(`FALHA SEGURA (${erro.codigo}): ${erro.message}`);
      console.error(`relatório: ${resolve(relatorioPath)}`);
      return 2;
    }
    throw erro;
  }

  const { dados, relatorio } = resultado;

  if (!relatorio.completo) {
    escreverJson(relatorioPath, { ...relatorio, saida_nao_gravada: true });
    console.error(resumoTexto(relatorio));
    console.error('FALHA SEGURA: exportação incompleta; o arquivo de dados NÃO foi gravado.');
    console.error(`relatório: ${resolve(relatorioPath)}`);
    return 2;
  }

  escreverAtomico(saida, dados);
  escreverJson(relatorioPath, { ...relatorio, saida: resolve(saida) });
  console.log(resumoTexto(relatorio));
  console.log(`dados:     ${resolve(saida)}`);
  console.log(`relatório: ${resolve(relatorioPath)}`);
  return 0;
}

// Executa como CLI apenas quando chamado diretamente.
const chamadoDireto = process.argv[1] && process.argv[1].endsWith('exportar-api.mjs');
if (chamadoDireto) {
  main().then((codigo) => process.exit(codigo));
}
