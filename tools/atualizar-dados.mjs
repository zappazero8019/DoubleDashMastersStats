#!/usr/bin/env node
// ===========================================================================
// tools/atualizar-dados.mjs
// ===========================================================================
//
// PROCEDIMENTO SEGURO de atualização do snapshot estático `public/dados.json`
// do painel Double Dash Masters, a partir da API pública de leitura.
//
// Fluxo (nunca publica, nunca escreve na API/Supabase):
//   1. lê o endpoint público SOMENTE por GET (delega a tools/exportar-api.mjs);
//   2. grava o snapshot NOVO em arquivo TEMPORÁRIO (fora de public/);
//   3. valida estrutura, os recursos, a completude e as consistências do
//      exportador (as mesmas checagens de tools/exportar-api.mjs);
//   4. confere os metadados e os campos indisponíveis explícitos;
//   5. COMPARA o snapshot novo com o anterior (diff legível);
//   6. GUARDA DE REGRESSÃO: recusa substituir um snapshot completo por um que
//      tenha retrocedido (menos lives, itens/jogadores zerados, schema trocado)
//      — protege contra resposta parcial/vazia da API marcada como "ok";
//   7. só então SUBSTITUI o arquivo de destino (rename atômico); em QUALQUER
//      falha o snapshot anterior permanece INTACTO.
//
// Nada aqui faz deploy, commit ou chamada de escrita. O arquivo gerado é
// ignorado pelo Git (ver .gitignore) e não é enviado a lugar nenhum.
//
// Uso:
//   node tools/atualizar-dados.mjs                       # atualiza public/dados.json
//   node tools/atualizar-dados.mjs --destino <arquivo>   # destino alternativo
//   node tools/atualizar-dados.mjs --base <url> --timeout 15000 --forcar
//   Variáveis de ambiente: MKDD_API_URL, MKDD_TIMEOUT_MS.
//
// Códigos de saída:
//   0 = snapshot validado e substituído;
//   2 = falha segura (rede/HTTP/envelope/incompletude); destino NÃO tocado;
//   3 = regressão detectada; destino NÃO tocado (a menos que use `--forcar`).
// ===========================================================================

import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import {
  BASE_PADRAO,
  ErroExportacao,
  SCHEMA,
  TIMEOUT_PADRAO_MS,
  exportar,
} from './exportar-api.mjs';

// Recursos que o PAINEL consome (9). Os 7 primeiros vêm direto do snapshot; os
// 2 últimos (`live`, `jogador`) são DERIVADOS em tempo de leitura pelo painel, a
// partir de `lives`/`jogadores` — por isso não são armazenados.
export const RECURSOS_ARMAZENADOS = [
  'geral',
  'lives',
  'campeonato',
  'jogadores',
  'itens',
  'relampagos',
  'cascos_azuis',
];
export const RECURSOS_DERIVADOS = ['live', 'jogador'];

export const DESTINO_PADRAO = 'public/dados.json';
export const RELATORIO_PADRAO = 'tools/saida/relatorio-atualizacao.json';
export const DIR_TEMP_PADRAO = 'tools/saida/tmp';

/** Lê um snapshot. Devolve `null` se ausente/ilegível/fora do esquema. */
export function lerSnapshot(caminho) {
  const destino = resolve(caminho);
  if (!existsSync(destino)) return null;
  try {
    const texto = readFileSync(destino, 'utf-8');
    const dados = JSON.parse(texto);
    if (!dados || typeof dados !== 'object' || !dados.recursos) return null;
    return dados;
  } catch {
    return null;
  }
}

function resumir(snapshot) {
  if (!snapshot || !snapshot.recursos) return null;
  const recursos = snapshot.recursos;
  return {
    schema: snapshot.schema ?? null,
    gerado_em: snapshot.gerado_em ?? null,
    atualizado_em: snapshot.atualizado_em ?? null,
    temporadas: snapshot.temporadas ?? [],
    geral: recursos.geral ?? null,
    linhas: Object.fromEntries(
      Object.entries(recursos).map(([chave, valor]) => [
        chave,
        Array.isArray(valor) ? valor.length : 1,
      ]),
    ),
    lives: (recursos.lives ?? []).map((l) => l?.sessao_id),
    campos_indisponiveis: snapshot.campos_indisponiveis ?? [],
  };
}

const CAMPOS_GERAIS = [
  'lives_finalizadas',
  'lives_em_andamento',
  'jogadores',
  'itens_totais',
  'relampagos',
  'cascos_azuis',
];

/** Diff legível entre dois snapshots (informativo; não decide bloqueios). */
export function compararSnapshots(anterior, novo) {
  const resumoAnterior = resumir(anterior);
  const resumoNovo = resumir(novo);
  if (!resumir(anterior)) {
    return { anterior: null, novo: resumir(novo), primeira_exportacao: true, deltas: {}, lives_novas: [], lives_removidas: [], avisos: [] };
  }
  const gA = anterior.recursos.geral ?? {};
  const gN = novo.recursos?.geral ?? {};
  const deltas = {};
  for (const campo of Object.keys({ ...gA, ...gN })) {
    const a = Number(gA[campo]);
    const n = Number(gN[campo]);
    if (Number.isFinite(a) && Number.isFinite(n) && a !== n) deltas[campo] = n - a;
  }
  const idsA = new Set((anterior.recursos.lives ?? []).map((l) => String(l?.sessao_id)));
  const idsN = new Set((novo.recursos?.lives ?? []).map((l) => String(l?.sessao_id)));
  const lives_novas = [...idsN].filter((id) => !idsA.has(id));
  const lives_removidas = [...idsA].filter((id) => !idsN.has(id));
  return {
    anterior: resumir(anterior),
    novo: resumir(novo),
    deltas,
    lives_novas,
    lives_removidas,
    schema_mudou: anterior.schema !== novo.schema,
    campos_indisponiveis_mudou:
      JSON.stringify(anterior.campos_indisponiveis ?? []) !==
      JSON.stringify(novo.campos_indisponiveis ?? []),
  };
}

/**
 * Guarda de regressão. Devolve a lista de motivos que justificam NÃO substituir
 * o snapshot anterior. Lista vazia = seguro substituir.
 */
export function detectarRegressao(anterior, novo) {
  const motivos = [];
  if (!anterior || !anterior.recursos) return motivos;
  const gA = anterior.recursos.geral ?? {};
  const gN = novo.recursos?.geral ?? {};
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  if (num(gN.lives_finalizadas) < num(gA.lives_finalizadas)) {
    motivos.push(
      `lives_finalizadas caiu de ${num(gA.lives_finalizadas)} para ${num(gN.lives_finalizadas)}`,
    );
  }
  const nA = (anterior.recursos.lives ?? []).length;
  const nN = (novo.recursos?.lives ?? []).length;
  if (nN < nA) motivos.push(`número de lives caiu de ${nA} para ${nN}`);
  if (nA > 0 && nN === 0) motivos.push('o snapshot novo perdeu todas as lives');
  if (num(gA.itens_totais) > 0 && num(gN.itens_totais) === 0) {
    motivos.push('itens_totais zerou em relação ao snapshot anterior');
  }
  if (num(gA.jogadores) > 0 && num(gN.jogadores) === 0) {
    motivos.push('o número de jogadores zerou em relação ao snapshot anterior');
  }
  if (anterior.schema != null && novo.schema !== anterior.schema) {
    motivos.push(`o esquema mudou de ${anterior.schema} para ${novo.schema}`);
  }
  return motivos;
}

/** Confere que os metadados e os campos indisponíveis seguem explícitos. */
export function verificarMetadados(dados) {
  const problemas = [];
  if (!Array.isArray(dados.campos_indisponiveis) || dados.campos_indisponiveis.length === 0) {
    problemas.push('campos_indisponiveis ausente ou vazio');
  }
  if (!dados.completude || dados.completude.completo !== true) {
    problemas.push('completude.completo não é true');
  }
  if (!dados.disponibilidade || typeof dados.disponibilidade !== 'object') {
    problemas.push('disponibilidade ausente');
  }
  if (dados.schema !== SCHEMA) problemas.push(`schema inesperado: ${dados.schema}`);
  // Os 9 recursos do painel precisam ser reconstruíveis.
  for (const r of RECURSOS_ARMAZENADOS) {
    if (!(r in (dados.recursos ?? {}))) problemas.push(`recurso armazenado ausente: ${r}`);
  }
  const temIdsLives = (dados.recursos?.lives ?? []).every((l) => l?.sessao_id !== undefined);
  if (!temIdsLives) problemas.push('há lives sem sessao_id (impossibilita o recurso derivado "live")');
  const temIdsJogadores = (dados.recursos?.jogadores ?? []).every(
    (j) => j?.player_id !== undefined,
  );
  if (!temIdsJogadores) {
    problemas.push('há jogadores sem player_id (impossibilita o recurso derivado "jogador")');
  }
  return problemas;
}

function escreverJson(caminho, objeto) {
  const destino = resolve(caminho);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, `${JSON.stringify(objeto, null, 2)}\n`, 'utf-8');
  return destino;
}

/**
 * Executa a atualização completa. Não publica nada.
 * Devolve `{ codigo, destino, temporario, comparacao, regressoes, relatorio }`.
 */
export async function atualizar(opcoes = {}) {
  const {
    destino = DESTINO_PADRAO,
    baseUrl = BASE_PADRAO,
    fetchImpl = globalThis.fetch,
    timeoutMs = TIMEOUT_PADRAO_MS,
    agora = new Date(),
    forcar = false,
    relatorioPath = RELATORIO_PADRAO,
    dirTemp = DIR_TEMP_PADRAO,
  } = opcoes;

  const destinoAbs = resolve(destino);
  const anterior = lerSnapshot(destinoAbs);

  const falhar = (relatorio, codigo, regressoes = []) => {
    const caminho = escreverJson(relatorioPath, relatorio);
    return { codigo, destino: destinoAbs, temporario: null, comparacao: relatorio.comparacao ?? null, regressoes, relatorio, relatorioPath: caminho };
  };

  // 1) GET público + validação (as checagens fortes ficam no exportador).
  let resultado;
  try {
    resultado = await exportar({ baseUrl, fetchImpl, timeoutMs, agora });
  } catch (erro) {
    if (erro instanceof ErroExportacao) {
      return falhar(
        {
          schema: SCHEMA,
          status: 'falha_segura',
          etapa: 'coleta',
          erro: erro.message,
          codigo: erro.codigo,
          detalhes: erro.detalhes,
          fonte: String(baseUrl),
          saida_nao_gravada: true,
          destino: destinoAbs,
        },
        2,
      );
    }
    throw erro;
  }

  const { dados, relatorio } = resultado;

  if (!relatorio.completo) {
    return falhar({ ...relatorio, etapa: 'validacao', saida_nao_gravada: true, destino: destinoAbs }, 2);
  }

  // 2) Metadados e campos indisponíveis explícitos.
  const problemasMeta = verificarMetadados(dados);
  if (problemasMeta.length > 0) {
    return falhar(
      { ...relatorio, status: 'falha_segura', etapa: 'metadados', problemas: problemasMeta, saida_nao_gravada: true, destino: destinoAbs },
      2,
    );
  }

  // 3) Comparação com o snapshot anterior.
  const comparacao = compararSnapshots(anterior, dados);
  const regressoes = detectarRegressao(anterior, dados);

  if (regressoes.length > 0 && !forcar) {
    return falhar(
      {
        ...relatorio,
        status: 'regressao',
        etapa: 'comparacao',
        regressoes,
        comparacao,
        saida_nao_gravada: true,
        destino: destinoAbs,
      },
      3,
      regressoes,
    );
  }

  // 4) Grava o candidato em arquivo TEMPORÁRIO (nunca em public/).
  mkdirSync(resolve(dirTemp), { recursive: true });
  const temporario = resolve(dirTemp, `dados-${process.pid}-${Date.now()}.json`);
  writeFileSync(temporario, `${JSON.stringify(dados, null, 2)}\n`, 'utf-8');

  // 5) Revalida a integridade do arquivo temporário (parse do que foi gravado).
  try {
    const relido = JSON.parse(readFileSync(temporario, 'utf-8'));
    if (relido?.schema !== SCHEMA || !relido?.recursos) {
      throw new Error('integridade: arquivo temporário inválido');
    }
  } catch (erro) {
    rmSync(temporario, { force: true });
    return falhar(
      { ...relatorio, status: 'falha_segura', etapa: 'temporario', erro: erro.message, saida_nao_gravada: true, destino: destinoAbs },
      2,
    );
  }

  // 6) Substituição atômica (mesmo volume: tools/ e public/ no mesmo disco).
  mkdirSync(dirname(destinoAbs), { recursive: true });
  try {
    renameSync(temporario, destinoAbs);
  } catch (erro) {
    try {
      rmSync(temporario, { force: true });
    } catch {
      /* nada a limpar */
    }
    throw erro;
  }

  const relatorioFinal = {
    ...relatorio,
    status: 'ok',
    etapa: 'substituicao',
    saida_nao_gravada: false,
    destino: destinoAbs,
    temporario,
    forcar,
    regressoes,
    comparacao,
  };
  const caminho = escreverJson(relatorioPath, relatorioFinal);
  return { codigo: 0, destino: destinoAbs, temporario, comparacao, regressoes, relatorio: relatorioFinal, relatorioPath: caminho };
}

export function lerArgs(argv) {
  const args = { base: null, destino: null, relatorio: null, timeout: null, dirTemp: null, forcar: false };
  for (let i = 0; i < argv.length; i += 1) {
    const atual = argv[i];
    if (atual === '--base') args.base = argv[++i];
    else if (atual === '--destino') args.destino = argv[++i];
    else if (atual === '--relatorio') args.relatorio = argv[++i];
    else if (atual === '--timeout') args.timeout = argv[++i];
    else if (atual === '--dir-temp') args.dirTemp = argv[++i];
    else if (atual === '--forcar') args.forcar = true;
  }
  return args;
}

/** Resumo legível da atualização. */
export function resumoAtualizacao(saida) {
  const linhas = [];
  const { relatorio, comparacao, regressoes, codigo } = saida;
  if (codigo === 0) {
    linhas.push('ATUALIZAÇÃO: OK — snapshot validado e substituído.');
  } else if (codigo === 3) {
    linhas.push('ATUALIZAÇÃO: RECUSADA (regressão) — snapshot anterior preservado.');
  } else {
    linhas.push(`ATUALIZAÇÃO: FALHA SEGURA (${relatorio?.codigo ?? relatorio?.etapa ?? '?'}) — snapshot anterior preservado.`);
  }
  linhas.push(`destino: ${saida.destino}`);
  if (comparacao?.anterior) {
    linhas.push('comparação com o anterior:');
    for (const [campo, delta] of Object.entries(comparacao.deltas ?? {})) {
      linhas.push(`  ${campo}: ${delta > 0 ? '+' : ''}${delta}`);
    }
    if ((comparacao.lives_novas ?? []).length > 0) {
      linhas.push(`  lives novas: ${comparacao.lives_novas.join(', ')}`);
    }
    if ((comparacao.lives_removidas ?? []).length > 0) {
      linhas.push(`  lives removidas: ${comparacao.lives_removidas.join(', ')}`);
    }
    if (Object.keys(comparacao.deltas ?? {}).length === 0 &&
        (comparacao.lives_novas ?? []).length === 0 &&
        (comparacao.lives_removidas ?? []).length === 0) {
      linhas.push('  (sem mudanças de conteúdo)');
    }
  } else {
    linhas.push('comparação: sem snapshot anterior (primeira gravação).');
  }
  for (const r of regressoes ?? []) linhas.push(`regressão: ${r}`);
  if (relatorio?.erro) linhas.push(`erro: ${relatorio.erro}`);
  if (relatorio?.problemas) for (const p of relatorio.problemas) linhas.push(`problema: ${p}`);
  return linhas.join('\n');
}

/**
 * CLI. Devolve o código de saída: 0 (ok), 2 (falha segura), 3 (regressão).
 */
export async function main(argv = process.argv.slice(2), deps = {}) {
  const args = lerArgs(argv);
  const baseUrl = args.base || process.env.MKDD_API_URL || BASE_PADRAO;
  const timeoutMs =
    Number.parseInt(args.timeout ?? process.env.MKDD_TIMEOUT_MS ?? '', 10) || TIMEOUT_PADRAO_MS;
  const fetchImpl = deps.fetchImpl || globalThis.fetch;
  const agora = deps.agora ? deps.agora() : new Date();

  const saida = await atualizar({
    destino: args.destino ?? DESTINO_PADRAO,
    baseUrl,
    fetchImpl,
    timeoutMs,
    agora,
    forcar: args.forcar,
    relatorioPath: args.relatorio ?? RELATORIO_PADRAO,
    dirTemp: args.dirTemp ?? DIR_TEMP_PADRAO,
  });

  const texto = resumoAtualizacao(saida);
  (saida.codigo === 0 ? console.log : console.error)(texto);
  (saida.codigo === 0 ? console.log : console.error)(`relatório: ${saida.relatorioPath}`);
  return saida.codigo;
}

const chamadoDireto = process.argv[1] && process.argv[1].endsWith('atualizar-dados.mjs');
if (chamadoDireto) {
  main().then((codigo) => process.exit(codigo));
}
