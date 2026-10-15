#!/usr/bin/env node
// ===========================================================================
// tools/preparar-publicacao.mjs
// ===========================================================================
//
// PREPARAÇÃO LOCAL do artefato de publicação estática do painel Double Dash
// Masters (React/Vite). NÃO publica, NÃO faz deploy, NÃO fala com o Netlify e
// NÃO escreve na API: apenas gera o snapshot, valida, constrói o site em modo
// JSON e confere o que saiu — deixando tudo parado para inspeção/deploy manual.
//
// O artefato é preparado para ser servido em um SUBDIRETÓRIO (GitHub Pages de
// projeto), conforme `base` do `vite.config.ts`. O caminho-base efetivo é
// DERIVADO do próprio `dist/index.html`, nunca presumido, e alimenta tanto a
// verificação do bundle quanto o fallback de rotas.
//
// Pipeline (cada etapa interrompe o processo em caso de falha):
//   1. GERA o snapshot com `npm run dados:atualizar` (somente GET na API);
//      falha segura (2) ou regressão (3) abortam SEM construir nada;
//   2. VALIDA o snapshot (`verificarMetadados` + `completude.completo`);
//   3. EXIGE APROVAÇÃO EXPLÍCITA (`--aprovar`); sem ela, para com código 4 e
//      NÃO constrói — para o humano revisar os resultados de validação;
//   4. CONSTRÓI com `VITE_FONTE_DADOS=json npm run build`;
//   5. VERIFICA que `dist/dados.json` existe e é BYTE A BYTE idêntico ao
//      snapshot validado;
//   6. CONFERE que o bundle referencia o `dados.json` NO CAMINHO-BASE
//      (ex.: `/DoubleDashMastersStats/dados.json`) e NÃO chama `/stats`;
//   7. GERA e VERIFICA os arquivos exigidos pelo GitHub Pages: `.nojekyll`
//      (sem processamento Jekyll) e `404.html` (fallback de rotas SPA do
//      React Router, cópia IDÊNTICA de `index.html`);
//   8. PRESERVA o artefato (`dist/`) e grava um relatório de preparação.
//
// Decisão de arquitetura (provisória): `public/dados.json` continua FORA do
// Git. O snapshot real só existe no artefato de build local; nenhum dado real
// entra em arquivo versionado.
//
// IMPORTANTE: este script só PREPARA o artefato local. A publicação real no
// GitHub Pages é uma ação MANUAL e separada (ver tools/PUBLICAR-ESTATICO.md).
//
// Uso:
//   node tools/preparar-publicacao.mjs                # gera e PARA para aprovação
//   node tools/preparar-publicacao.mjs --aprovar      # gera, valida e constrói
//   node tools/preparar-publicacao.mjs --sem-gerar --aprovar   # usa o snapshot atual
//   node tools/preparar-publicacao.mjs --sem-gerar --aprovar --base /OutroBase/
//
// Códigos de saída:
//   0 = artefato pronto (dist/ verificado); publicar é ação manual;
//   2 = falha (geração/validação/build/artefato/bundle/github-pages); nada foi publicado;
//   3 = regressão detectada na geração; snapshot anterior preservado;
//   4 = aguardando aprovação; nada foi construído.

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';

import { verificarMetadados } from './atualizar-dados.mjs';
import { SCHEMA } from './exportar-api.mjs';

export const SNAPSHOT_PADRAO = 'public/dados.json';
export const DIST_PADRAO = 'dist';
export const RELATORIO_PADRAO = 'tools/saida/relatorio-publicacao.json';
// Caminho-base padrão do painel no GitHub Pages (projeto:
// usuário.github.io/DoubleDashMastersStats/). Deve espelhar `base` do
// `vite.config.ts`; é apenas o ponto de partida — o valor efetivo é DERIVADO
// do `dist/index.html` para nunca divergir do build real.
export const BASE_PADRAO = '/DoubleDashMastersStats/';

const ARQUIVO_NOJEKYLL = '.nojekyll';
const ARQUIVO_FALLBACK = '404.html';
const MARCA_STATS = '/stats';

// ---------------------------------------------------------------------------
// Utilidades puras
// ---------------------------------------------------------------------------

export function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function escreverJson(caminho, objeto) {
  const destino = resolve(caminho);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, `${JSON.stringify(objeto, null, 2)}\n`, 'utf-8');
  return destino;
}

/**
 * Normaliza um caminho-base para sempre começar E terminar com uma única '/'.
 * Ex.: `'/DoubleDashMastersStats/'`, `'/DoubleDashMastersStats'` e
 * `'DoubleDashMastersStats'` viram `'/DoubleDashMastersStats/'`; `''` e `'/'`
 * viram `'/'`.
 */
export function normalizarBase(base) {
  const texto = String(base ?? '').trim();
  if (texto === '' || texto === '/') return '/';
  return `/${texto.replace(/^\/+/, '').replace(/\/+$/, '')}/`;
}

/**
 * Deriva o caminho-base EFETIVO a partir dos caminhos de assets declarados em
 * `dist/index.html` (fonte da verdade: o próprio build). Devolve a base com
 * barras normalizadas, `'/'` se o site está na raiz, ou `null` se o
 * `index.html` não existir/declarar assets com caminho absoluto.
 */
export function detectarBase(distDir) {
  const caminho = join(resolve(distDir), 'index.html');
  if (!existsSync(caminho)) return null;
  const html = readFileSync(caminho, 'utf-8');
  const encontrado = html.match(/(?:src|href)="(\/[^"]*?)assets\//);
  if (!encontrado) return null;
  return normalizarBase(encontrado[1]);
}

/** Caminho do `dados.json` como aparece no bundle para um dado base. */
export function caminhoDados(base) {
  return `${normalizarBase(base)}dados.json`;
}

/**
 * Lê e valida o snapshot. Lança `Error` com motivo legível se ausente/fora do
 * esquema. Não aproxima valores — apenas confere o que a API já produziu.
 */
export function lerSnapshotValidado(caminho) {
  const destino = resolve(caminho);
  if (!existsSync(destino)) {
    throw new Error(`snapshot ausente: ${destino}`);
  }
  const bruto = readFileSync(destino, 'utf-8');
  let dados;
  try {
    dados = JSON.parse(bruto);
  } catch (erro) {
    throw new Error(`snapshot ilegível (JSON inválido): ${erro.message}`);
  }
  if (!dados || typeof dados !== 'object' || dados.schema !== SCHEMA) {
    throw new Error(`snapshot fora do esquema ${SCHEMA}`);
  }
  const problemas = verificarMetadados(dados);
  if (problemas.length > 0) {
    throw new Error(`validação falhou: ${problemas.join('; ')}`);
  }
  return { dados, bytes: Buffer.from(bruto, 'utf-8') };
}

/**
 * Confere que `dist/dados.json` existe e é idêntico ao snapshot validado
 * (hash SHA-256). O snapshot pode ser informado por `bytes` (evita reler e
 * garante que foi validado nesta execução).
 */
export function verificarArtefato(caminhoSnapshot, distDir, bytesSnapshot) {
  const motivos = [];
  const caminhoDist = join(resolve(distDir), 'dados.json');
  if (!existsSync(caminhoDist)) {
    return { ok: false, motivos: [`dist/dados.json ausente (esperado em ${caminhoDist})`] };
  }
  const bytes = bytesSnapshot ?? readFileSync(resolve(caminhoSnapshot));
  const bytesDist = readFileSync(caminhoDist);
  const hashSnapshot = sha256(bytes);
  const hashDist = sha256(bytesDist);
  if (hashSnapshot !== hashDist) {
    motivos.push('dist/dados.json difere do snapshot validado (sha256)');
  }
  return {
    ok: motivos.length === 0,
    motivos,
    hashSnapshot,
    hashDist,
    tamanho: bytesDist.length,
  };
}

/**
 * Confere no bundle compilado que existe a marca do `dados.json` NO CAMINHO-BASE
 * efetivo (ex.: `/DoubleDashMastersStats/dados.json`) e NÃO existe `/stats`.
 * Base-awareness: um artefato que perdeu o prefixo (servido para a raiz) é
 * REPROVADO, assim como um artefato que ainda fala com a API.
 * Devolve `{ ok, motivos, arquivos, base, marcaJson, ocorrenciasJson, ocorrenciasStats }`.
 */
export function verificarBundle(distDir, opcoes = {}) {
  const motivos = [];
  const pastaAssets = join(resolve(distDir), 'assets');
  if (!existsSync(pastaAssets) || !statSync(pastaAssets).isDirectory()) {
    return { ok: false, motivos: [`pasta de assets ausente: ${pastaAssets}`] };
  }
  const arquivos = readdirSync(pastaAssets).filter((n) => n.endsWith('.js'));
  if (arquivos.length === 0) {
    return { ok: false, motivos: ['nenhum bundle .js encontrado em dist/assets'] };
  }
  const base = normalizarBase(opcoes.base ?? detectarBase(distDir) ?? BASE_PADRAO);
  const marcaJson = caminhoDados(base);
  let ocorrenciasJson = 0;
  let ocorrenciasStats = 0;
  for (const nome of arquivos) {
    const conteudo = readFileSync(join(resolve(distDir), 'assets', nome), 'utf-8');
    ocorrenciasJson += conteudo.split(marcaJson).length - 1;
    ocorrenciasStats += conteudo.split(MARCA_STATS).length - 1;
  }
  if (ocorrenciasJson < 1) {
    motivos.push(`o bundle não referencia '${marcaJson}' (modo JSON não aplicado para o base ${base}?)`);
  }
  if (ocorrenciasStats > 0) {
    motivos.push(`o bundle ainda referencia '/stats' (${ocorrenciasStats}x) — modo API no artefato`);
  }
  return { ok: motivos.length === 0, motivos, arquivos, base, marcaJson, ocorrenciasJson, ocorrenciasStats };
}

/**
 * Gera os arquivos exigidos pelo GitHub Pages:
 *   - `.nojekyll` (vazio) — impede o processamento Jekyll do site;
 *   - `404.html` — fallback de rotas do React Router: cópia IDÊNTICA de
 *     `dist/index.html`, servida pelo GitHub Pages em qualquer caminho
 *     desconhecido sob o base. O router (basename) resolve a rota a partir da
 *     própria URL, então o deep-link é preservado.
 * Não publica nada. Devolve `{ ok, motivos, base, caminhoNojekyll, caminhoFallback }`.
 */
export function prepararGithubPages(distDir, opcoes = {}) {
  const raiz = resolve(distDir);
  const caminhoOrigem = join(raiz, 'index.html');
  if (!existsSync(caminhoOrigem)) {
    return { ok: false, motivos: [`dist/index.html ausente (${caminhoOrigem})`], base: null };
  }
  const base = normalizarBase(opcoes.base ?? detectarBase(distDir) ?? BASE_PADRAO);
  const caminhoNojekyll = join(raiz, ARQUIVO_NOJEKYLL);
  const caminhoFallback = join(raiz, ARQUIVO_FALLBACK);
  writeFileSync(caminhoNojekyll, '');
  writeFileSync(caminhoFallback, readFileSync(caminhoOrigem));
  return { ok: true, motivos: [], base, caminhoNojekyll, caminhoFallback };
}

/**
 * Verifica o artefato para GitHub Pages: `.nojekyll` presente, `404.html`
 * presente e BYTE A BYTE idêntico a `dist/index.html`, e base detectável.
 * Devolve `{ ok, motivos, base, nojekyll, fallback }`.
 */
export function verificarGithubPages(distDir, opcoes = {}) {
  const motivos = [];
  const raiz = resolve(distDir);
  const caminhoOrigem = join(raiz, 'index.html');
  const caminhoNojekyll = join(raiz, ARQUIVO_NOJEKYLL);
  const caminhoFallback = join(raiz, ARQUIVO_FALLBACK);

  const base = opcoes.base ? normalizarBase(opcoes.base) : detectarBase(distDir);
  if (!existsSync(caminhoOrigem)) motivos.push(`dist/index.html ausente (${caminhoOrigem})`);
  if (!base) motivos.push('dist/index.html não referencia assets com caminho absoluto (base indefinido)');
  if (!existsSync(caminhoNojekyll)) motivos.push(`dist/${ARQUIVO_NOJEKYLL} ausente (${caminhoNojekyll})`);
  if (!existsSync(caminhoFallback)) {
    motivos.push(`dist/${ARQUIVO_FALLBACK} ausente (${caminhoFallback})`);
  } else if (existsSync(caminhoOrigem)) {
    if (sha256(readFileSync(caminhoFallback)) !== sha256(readFileSync(caminhoOrigem))) {
      motivos.push(`${ARQUIVO_FALLBACK} difere de index.html (fallback SPA inválido)`);
    }
  }
  return {
    ok: motivos.length === 0,
    motivos,
    base: base ?? null,
    nojekyll: existsSync(caminhoNojekyll),
    fallback: existsSync(caminhoFallback),
  };
}

// ---------------------------------------------------------------------------
// Preparação de alto nível
// ---------------------------------------------------------------------------

function executarNpm(args, env = {}) {
  const noWindows = process.platform === 'win32';
  const npm = noWindows ? 'npm.cmd' : 'npm';
  const resultado = spawnSync(npm, args, {
    stdio: 'inherit',
    env: { ...process.env, ...env },
    shell: noWindows, // .cmd exige shell no Windows
    windowsHide: true,
  });
  if (resultado.error) return { codigo: 1, erro: resultado.error.message };
  return { codigo: typeof resultado.status === 'number' ? resultado.status : 1 };
}

/** Padrão: roda `npm run dados:atualizar` (somente GET na API). */
export async function rodarAtualizacaoPadrao() {
  return executarNpm(['run', 'dados:atualizar']);
}

/** Padrão: roda `npm run build` com `VITE_FONTE_DADOS=json`. */
export async function rodarBuildPadrao() {
  return executarNpm(['run', 'build'], { VITE_FONTE_DADOS: 'json' }).codigo;
}

/**
 * Executa o pipeline completo. Não publica nada.
 * Devolve `{ codigo, etapa, snapshot, atualizacao, artefato, bundle, githubPages,
 * relatorio, relatorioPath, ... }`.
 */
export async function preparar(opcoes = {}) {
  const {
    gerar = true,
    aprovar = false,
    snapshotPath = SNAPSHOT_PADRAO,
    distDir = DIST_PADRAO,
    relatorioPath = RELATORIO_PADRAO,
    relatorioAtualizacao = 'tools/saida/relatorio-atualizacao.json',
    caminhoBase = null,
    rodarAtualizacao = rodarAtualizacaoPadrao,
    rodarBuild = rodarBuildPadrao,
  } = opcoes;

  const destino = resolve(snapshotPath);
  const baseRel = {
    esquema: SCHEMA,
    snapshot: destino,
    dist: resolve(distDir),
    base: caminhoBase ? normalizarBase(caminhoBase) : null,
    gerado: !!gerar,
    aprovado: !!aprovar,
    etapas: [],
  };

  const finalizar = (codigo, etapa, extra = {}) => {
    const relatorio = {
      ...baseRel,
      status: codigo === 0 ? 'ok' : codigo === 4 ? 'aguardando_aprovacao' : codigo === 3 ? 'regressao' : 'falha_segura',
      etapa,
      publicado: false,
      ...extra,
    };
    const caminho = escreverJson(relatorioPath, relatorio);
    return { codigo, etapa, relatorio, relatorioPath: caminho, ...extra };
  };

  // 1) GERA o snapshot (somente GET). Falha segura/regressão abortam.
  if (gerar) {
    const upd = await rodarAtualizacao();
    baseRel.etapas.push({ etapa: 'geracao', codigo: upd.codigo });
    if (upd.codigo === 3) {
      return finalizar(3, 'geracao', { erro: 'regressão detectada; snapshot anterior preservado' });
    }
    if (upd.codigo !== 0) {
      return finalizar(2, 'geracao', { erro: upd.erro ?? `npm run dados:atualizar saiu com código ${upd.codigo}` });
    }
  }

  // Resumo da atualização (se houver relatório), apenas informativo.
  let atualizacao = null;
  const caminhoRelUpd = resolve(relatorioAtualizacao);
  if (existsSync(caminhoRelUpd)) {
    try {
      const rel = JSON.parse(readFileSync(caminhoRelUpd, 'utf-8'));
      atualizacao = { status: rel.status, comparacao: rel.comparacao ?? null };
    } catch {
      atualizacao = null;
    }
  }
  baseRel.atualizacao = atualizacao;

  // 2) VALIDA o snapshot.
  let validado;
  try {
    validado = lerSnapshotValidado(destino);
  } catch (erro) {
    baseRel.etapas.push({ etapa: 'validacao', codigo: 2 });
    return finalizar(2, 'validacao', { erro: erro.message });
  }
  baseRel.etapas.push({ etapa: 'validacao', codigo: 0 });
  const dados = validado.dados;
  const resumoSnapshot = {
    schema: dados.schema,
    gerado_em: dados.gerado_em ?? null,
    atualizado_em: dados.atualizado_em ?? null,
    temporadas: dados.temporadas ?? [],
    geral: dados.recursos?.geral ?? null,
  };

  // 3) GATE de aprovação: sem `--aprovar` NÃO constrói.
  if (!aprovar) {
    baseRel.etapas.push({ etapa: 'aprovacao', codigo: 4 });
    return finalizar(4, 'aprovacao', { snapshotInfo: resumoSnapshot });
  }

  // 4) CONSTRÓI o site em modo JSON.
  const codigoBuild = await rodarBuild();
  baseRel.etapas.push({ etapa: 'build', codigo: codigoBuild });
  if (codigoBuild !== 0) {
    return finalizar(2, 'build', {
      erro: `npm run build saiu com código ${codigoBuild}`,
      snapshotInfo: resumoSnapshot,
    });
  }

  // 5) VERIFICA o artefato (dist/dados.json idêntico ao snapshot validado).
  const artefato = verificarArtefato(destino, distDir, validado.bytes);
  baseRel.etapas.push({ etapa: 'artefato', codigo: artefato.ok ? 0 : 2 });
  if (!artefato.ok) {
    return finalizar(2, 'artefato', { artefato, snapshotInfo: resumoSnapshot });
  }

  // 6) VERIFICA o bundle (usa o dados.json do base; não usa /stats).
  const bundle = verificarBundle(distDir, { base: caminhoBase });
  baseRel.etapas.push({ etapa: 'bundle', codigo: bundle.ok ? 0 : 2 });
  if (!bundle.ok) {
    return finalizar(2, 'bundle', { artefato, bundle, snapshotInfo: resumoSnapshot });
  }

  // 7) GERA e VERIFICA os arquivos exigidos pelo GitHub Pages.
  let githubPages;
  try {
    const preparado = prepararGithubPages(distDir, { base: caminhoBase });
    githubPages = { ...preparado, ...verificarGithubPages(distDir, { base: caminhoBase }) };
  } catch (erro) {
    githubPages = { ok: false, motivos: [erro.message] };
  }
  baseRel.etapas.push({ etapa: 'github-pages', codigo: githubPages.ok ? 0 : 2 });
  if (!githubPages.ok) {
    return finalizar(2, 'github-pages', { artefato, bundle, githubPages, snapshotInfo: resumoSnapshot });
  }

  // 8) Artefato pronto e verificado — deploy é ação MANUAL.
  return finalizar(0, 'concluido', { artefato, bundle, githubPages, snapshotInfo: resumoSnapshot });
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export function lerArgs(argv) {
  const args = { destino: null, dist: null, relatorio: null, base: null, aprovar: false, gerar: true };
  for (let i = 0; i < argv.length; i += 1) {
    const atual = argv[i];
    if (atual === '--destino') args.destino = argv[++i];
    else if (atual === '--dist') args.dist = argv[++i];
    else if (atual === '--relatorio') args.relatorio = argv[++i];
    else if (atual === '--base') args.base = argv[++i];
    else if (atual === '--aprovar') args.aprovar = true;
    else if (atual === '--sem-gerar') args.gerar = false;
  }
  return args;
}

export function resumoPreparacao(saida) {
  const linhas = [];
  if (saida.codigo === 0) {
    linhas.push('PREPARAÇÃO: OK — artefato verificado e pronto para PUBLICAR (ação manual).');
  } else if (saida.codigo === 4) {
    linhas.push('PREPARAÇÃO: AGUARDANDO APROVAÇÃO — nada foi construído.');
    linhas.push('  revise o relatório e rode novamente com --aprovar');
  } else if (saida.codigo === 3) {
    linhas.push('PREPARAÇÃO: RECUSADA (regressão) — nada foi construído.');
  } else {
    linhas.push(`PREPARAÇÃO: FALHA SEGURA na etapa "${saida.etapa}" — nada foi publicado.`);
  }
  const reg = saida.relatorio ?? {};
  linhas.push(`snapshot: ${reg.snapshot ?? '?'}`);
  linhas.push(`dist:     ${reg.dist ?? '?'}`);
  if (saida.artefato) {
    linhas.push(`artefato: dados.json ${saida.artefato.tamanho ?? '?'} bytes, sha256=${(saida.artefato.hashDist ?? '?').slice(0, 16)}…`);
  }
  if (saida.bundle) {
    linhas.push(
      `bundle:   ${saida.bundle.arquivos.length} js, ${saida.bundle.ocorrenciasJson}x '${saida.bundle.marcaJson}', ${saida.bundle.ocorrenciasStats}x '/stats'`,
    );
    linhas.push(`base:     ${saida.bundle.base}`);
  }
  if (saida.githubPages) {
    linhas.push(
      `github-pages: ${saida.githubPages.nojekyll ? '.nojekyll ok' : '.nojekyll AUSENTE'}, ${saida.githubPages.fallback ? '404.html ok' : '404.html AUSENTE'}`,
    );
  }
  if (reg.erro) linhas.push(`erro: ${reg.erro}`);
  for (const m of saida.artefato?.motivos ?? []) linhas.push(`artefato: ${m}`);
  for (const m of saida.bundle?.motivos ?? []) linhas.push(`bundle: ${m}`);
  for (const m of saida.githubPages?.motivos ?? []) linhas.push(`github-pages: ${m}`);
  linhas.push(`relatório: ${saida.relatorioPath}`);
  return linhas.join('\n');
}

export async function main(argv = process.argv.slice(2), deps = {}) {
  const args = lerArgs(argv);
  const saida = await preparar({
    gerar: args.gerar,
    aprovar: args.aprovar,
    snapshotPath: args.destino ?? SNAPSHOT_PADRAO,
    distDir: args.dist ?? DIST_PADRAO,
    relatorioPath: args.relatorio ?? RELATORIO_PADRAO,
    caminhoBase: args.base ?? null,
    rodarAtualizacao: deps.rodarAtualizacao,
    rodarBuild: deps.rodarBuild,
  });
  const texto = resumoPreparacao(saida);
  (saida.codigo === 0 ? console.log : console.error)(texto);
  return saida.codigo;
}

const chamadoDireto = process.argv[1] && process.argv[1].endsWith('preparar-publicacao.mjs');
if (chamadoDireto) {
  main().then((codigo) => process.exit(codigo));
}
