// ===========================================================================
// tools/preparar-publicacao.test.mjs
// Testes do pipeline de preparação (node --test). NÃO toca a API, NÃO faz
// deploy e NÃO roda build real: `rodarAtualizacao`/`rodarBuild` são injetados.
// Executar: node --test tools/preparar-publicacao.test.mjs
// ===========================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  BASE_PADRAO,
  caminhoDados,
  detectarBase,
  lerSnapshotValidado,
  normalizarBase,
  preparar,
  prepararGithubPages,
  verificarArtefato,
  verificarBundle,
  verificarGithubPages,
} from './preparar-publicacao.mjs';

const SID = 'e10d0f0d-738d-4174-befb-5839e14dd848';
const OUTRO_BASE = '/Sub/';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function snapshotValido() {
  return {
    schema: 1,
    gerado_em: '2026-10-13T18:59:41-03:00',
    fonte: 'https://exemplo.test',
    atualizado_em: '2026-10-11T22:13:57+00:00',
    temporadas: [2026],
    disponibilidade: { geral: 'completo', lives: 'completo', campeonato: 'completo', jogadores: 'completo', itens: 'completo', relampagos: 'completo', cascos_azuis: 'completo' },
    completude: { completo: true, recursos: {}, verificacoes: [], avisos: [] },
    campos_indisponiveis: ['tempos', 'colocacoes_por_live', 'pontuacao_por_live', 'participantes_por_live', 'baseline', 'eventos'],
    recursos: {
      geral: { lives_finalizadas: 1, lives_em_andamento: 1, jogadores: 4, itens_totais: 48, relampagos: 11, cascos_azuis: 37 },
      lives: [{ sessao_id: SID, temporada: 2026, iniciada_em: '2026-10-11T20:56:22+00:00', finalizada_em: '2026-10-11T22:13:57+00:00', url_live: '' }],
      campeonato: [{ temporada: 2026, player_id: 1, vitorias: 1 }],
      jogadores: [{ player_id: 1, nome: 'André' }],
      itens: [],
      relampagos: [],
      cascos_azuis: [],
    },
  };
}

function pastaTemp() {
  return mkdtempSync(join(tmpdir(), 'preparar-publicacao-'));
}

function gravarSnapshot(caminho, objeto) {
  mkdirSync(join(caminho, '..'), { recursive: true });
  writeFileSync(caminho, `${JSON.stringify(objeto, null, 2)}\n`, 'utf-8');
}

/**
 * Simula um `dist/` de build Vite: `index.html` com assets sob o base,
 * `dados.json` (opcional) e um bundle `.js`. O conteúdo do bundle referencia,
 * por padrão, o `dados.json` NO CAMINHO-BASE (como o build real em modo JSON).
 */
function gravarBuild(distDir, { dadosJson, assets, base = BASE_PADRAO } = {}) {
  mkdirSync(join(distDir, 'assets'), { recursive: true });
  if (dadosJson !== undefined) writeFileSync(join(distDir, 'dados.json'), dadosJson, 'utf-8');
  writeFileSync(
    join(distDir, 'index.html'),
    `<!doctype html><html><head><script type="module" src="${base}assets/index-abc.js"></script></head><body><div id="root"></div></body></html>`,
    'utf-8',
  );
  const conteudoAssets = assets ?? `console.log('${base}dados.json');`;
  writeFileSync(join(distDir, 'assets', 'index-abc.js'), conteudoAssets, 'utf-8');
}

function opcoesBase(dir, extra = {}) {
  return {
    snapshotPath: join(dir, 'public', 'dados.json'),
    distDir: join(dir, 'dist'),
    relatorioPath: join(dir, 'relatorio-publicacao.json'),
    relatorioAtualizacao: join(dir, 'sem-relatorio.json'),
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Unidades puras
// ---------------------------------------------------------------------------

test('lerSnapshotValidado lança para arquivo ausente', () => {
  const dir = pastaTemp();
  try {
    assert.throws(() => lerSnapshotValidado(join(dir, 'nada.json')), /ausente/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('lerSnapshotValidado lança para JSON inválido e metadados incompletos', () => {
  const dir = pastaTemp();
  try {
    const ruim = join(dir, 'ruim.json');
    writeFileSync(ruim, '{ nope', 'utf-8');
    assert.throws(() => lerSnapshotValidado(ruim), /ilegível|inválido/);

    const semMeta = join(dir, 'semetadata.json');
    const s = snapshotValido();
    delete s.campos_indisponiveis;
    writeFileSync(semMeta, JSON.stringify(s), 'utf-8');
    assert.throws(() => lerSnapshotValidado(semMeta), /validação falhou/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('normalizarBase e caminhoDados normalizam raiz e subdiretório', () => {
  assert.equal(normalizarBase('/'), '/');
  assert.equal(normalizarBase(''), '/');
  assert.equal(normalizarBase('DoubleDashMastersStats'), '/DoubleDashMastersStats/');
  assert.equal(normalizarBase('/DoubleDashMastersStats'), '/DoubleDashMastersStats/');
  assert.equal(normalizarBase('//Sub//'), '/Sub/');
  assert.equal(caminhoDados('/'), '/dados.json');
  assert.equal(caminhoDados('/DoubleDashMastersStats/'), '/DoubleDashMastersStats/dados.json');
});

test('detectarBase lê o subdiretório do index.html', () => {
  const dir = pastaTemp();
  try {
    const dist = join(dir, 'dist');
    gravarBuild(dist, { base: BASE_PADRAO });
    assert.equal(detectarBase(dist), BASE_PADRAO);

    gravarBuild(dist, { base: '/' });
    assert.equal(detectarBase(dist), '/');

    rmSync(join(dist, 'index.html'), { force: true });
    assert.equal(detectarBase(dist), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('verificarArtefato acusa ausência e divergência', () => {
  const dir = pastaTemp();
  try {
    const snap = join(dir, 'public', 'dados.json');
    gravarSnapshot(snap, snapshotValido());
    mkdirSync(join(dir, 'dist'), { recursive: true });

    assert.equal(verificarArtefato(snap, join(dir, 'dist')).ok, false);

    writeFileSync(join(dir, 'dist', 'dados.json'), 'outro conteudo', 'utf-8');
    const div = verificarArtefato(snap, join(dir, 'dist'));
    assert.equal(div.ok, false);
    assert.ok(div.motivos.some((m) => m.includes('difere')));

    const bytes = readFileSync(snap);
    writeFileSync(join(dir, 'dist', 'dados.json'), bytes);
    assert.equal(verificarArtefato(snap, join(dir, 'dist')).ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test(`verificarBundle exige o dados.json no caminho-base e proíbe /stats`, () => {
  const dir = pastaTemp();
  try {
    const dist = join(dir, 'dist');
    gravarBuild(dist, {}); // assets referenciam `${BASE_PADRAO}dados.json`
    const ok = verificarBundle(dist);
    assert.equal(ok.ok, true);
    assert.equal(ok.base, BASE_PADRAO);
    assert.equal(ok.marcaJson, `${BASE_PADRAO}dados.json`);
    assert.equal(ok.ocorrenciasJson, 1);
    assert.equal(ok.ocorrenciasStats, 0);

    gravarBuild(dist, { assets: "fetch('/stats');" });
    const ruim = verificarBundle(dist);
    assert.equal(ruim.ok, false);
    assert.ok(ruim.motivos.some((m) => m.includes('dados.json')));
    assert.ok(ruim.motivos.some((m) => m.includes('stats')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('verificarBundle é sensível ao caminho-base do artefato', () => {
  const dir = pastaTemp();
  try {
    const dist = join(dir, 'dist');

    // Bundle sob o base real (subdiretório) e index.html coerente: OK.
    gravarBuild(dist, { base: OUTRO_BASE, assets: `fetch('${OUTRO_BASE}dados.json');` });
    const ok = verificarBundle(dist);
    assert.equal(ok.ok, true);
    assert.equal(ok.base, OUTRO_BASE);

    // index.html declara subdiretório, mas o bundle perdeu o prefixo: REPROVA.
    gravarBuild(dist, { base: OUTRO_BASE, assets: "fetch('/dados.json');" });
    const semPrefixo = verificarBundle(dist);
    assert.equal(semPrefixo.ok, false);
    assert.ok(semPrefixo.motivos.some((m) => m.includes(`${OUTRO_BASE}dados.json`)));

    // Sem index.html, o base explícito é respeitado.
    rmSync(join(dist, 'index.html'), { force: true });
    const explicito = verificarBundle(dist, { base: OUTRO_BASE });
    assert.equal(explicito.ok, false);
    gravarBuild(dist, { base: OUTRO_BASE, assets: `fetch('${OUTRO_BASE}dados.json');` });
    rmSync(join(dist, 'index.html'), { force: true });
    assert.equal(verificarBundle(dist, { base: OUTRO_BASE }).ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('prepararGithubPages cria .nojekyll e 404.html idêntico ao index.html', () => {
  const dir = pastaTemp();
  try {
    const dist = join(dir, 'dist');
    gravarBuild(dist, { base: BASE_PADRAO });

    const gerado = prepararGithubPages(dist);
    assert.equal(gerado.ok, true);
    assert.equal(gerado.base, BASE_PADRAO);
    assert.ok(existsSync(join(dist, '.nojekyll')));
    assert.deepEqual(
      readFileSync(join(dist, '404.html')),
      readFileSync(join(dist, 'index.html')),
    );

    const verificado = verificarGithubPages(dist);
    assert.equal(verificado.ok, true);
    assert.equal(verificado.nojekyll, true);
    assert.equal(verificado.fallback, true);
    assert.equal(verificado.base, BASE_PADRAO);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('verificarGithubPages reprova .nojekyll ausente e 404.html divergente', () => {
  const dir = pastaTemp();
  try {
    const dist = join(dir, 'dist');
    gravarBuild(dist, { base: BASE_PADRAO });
    prepararGithubPages(dist);

    rmSync(join(dist, '.nojekyll'), { force: true });
    const semNojekyll = verificarGithubPages(dist);
    assert.equal(semNojekyll.ok, false);
    assert.ok(semNojekyll.motivos.some((m) => m.includes('.nojekyll')));

    prepararGithubPages(dist);
    writeFileSync(join(dist, '404.html'), 'outra coisa', 'utf-8');
    const divergente = verificarGithubPages(dist);
    assert.equal(divergente.ok, false);
    assert.ok(divergente.motivos.some((m) => m.includes('404.html')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('prepararGithubPages falha quando o index.html está ausente', () => {
  const dir = pastaTemp();
  try {
    const dist = join(dir, 'dist');
    mkdirSync(join(dist, 'assets'), { recursive: true });
    const saida = prepararGithubPages(dist);
    assert.equal(saida.ok, false);
    assert.ok(saida.motivos.some((m) => m.includes('index.html')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

test('sucesso: gera, valida, constrói e prepara o artefato para o GitHub Pages', async () => {
  const dir = pastaTemp();
  try {
    const opts = opcoesBase(dir, {
      gerar: false,
      aprovar: true,
      rodarBuild: async () => {
        gravarBuild(join(dir, 'dist'), {
          dadosJson: readFileSync(join(dir, 'public', 'dados.json')),
        });
        return 0;
      },
    });
    gravarSnapshot(opts.snapshotPath, snapshotValido());

    const saida = await preparar(opts);
    assert.equal(saida.codigo, 0);
    assert.equal(saida.etapa, 'concluido');
    assert.equal(saida.artefato.ok, true);
    assert.equal(saida.bundle.ok, true);
    assert.equal(saida.bundle.base, BASE_PADRAO);
    assert.equal(saida.bundle.marcaJson, `${BASE_PADRAO}dados.json`);
    assert.equal(saida.bundle.ocorrenciasStats, 0);
    assert.equal(saida.githubPages.ok, true);
    assert.ok(existsSync(join(dir, 'dist', '.nojekyll')));
    assert.ok(existsSync(join(dir, 'dist', '404.html')));
    assert.deepEqual(
      readFileSync(join(dir, 'dist', '404.html')),
      readFileSync(join(dir, 'dist', 'index.html')),
    );
    const rel = JSON.parse(readFileSync(saida.relatorioPath, 'utf-8'));
    assert.equal(rel.status, 'ok');
    assert.equal(rel.publicado, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('aguardando aprovação NÃO constrói nada', async () => {
  const dir = pastaTemp();
  try {
    let buildChamado = false;
    const opts = opcoesBase(dir, {
      gerar: false,
      aprovar: false,
      rodarBuild: async () => {
        buildChamado = true;
        return 0;
      },
    });
    gravarSnapshot(opts.snapshotPath, snapshotValido());

    const saida = await preparar(opts);
    assert.equal(saida.codigo, 4);
    assert.equal(saida.etapa, 'aprovacao');
    assert.equal(buildChamado, false);
    assert.equal(existsSync(join(dir, 'dist')), false);
    assert.equal(JSON.parse(readFileSync(saida.relatorioPath, 'utf-8')).status, 'aguardando_aprovacao');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('snapshot ausente aborta antes do build', async () => {
  const dir = pastaTemp();
  try {
    let buildChamado = false;
    const saida = await preparar(
      opcoesBase(dir, { gerar: false, aprovar: true, rodarBuild: async () => { buildChamado = true; return 0; } }),
    );
    assert.equal(saida.codigo, 2);
    assert.equal(saida.etapa, 'validacao');
    assert.equal(buildChamado, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('snapshot inválido aborta sem construir', async () => {
  const dir = pastaTemp();
  try {
    const opts = opcoesBase(dir, { gerar: false, aprovar: true, rodarBuild: async () => 0 });
    gravarSnapshot(opts.snapshotPath, { schema: 1 }); // sem recursos
    const saida = await preparar(opts);
    assert.equal(saida.codigo, 2);
    assert.equal(saida.etapa, 'validacao');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('falha de geração (regressão) aborta sem construir', async () => {
  const dir = pastaTemp();
  try {
    let buildChamado = false;
    const saida = await preparar(
      opcoesBase(dir, {
        gerar: true,
        aprovar: true,
        rodarAtualizacao: async () => ({ codigo: 3 }),
        rodarBuild: async () => { buildChamado = true; return 0; },
      }),
    );
    assert.equal(saida.codigo, 3);
    assert.equal(saida.etapa, 'geracao');
    assert.equal(buildChamado, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('falha de geração (falha segura) aborta sem construir', async () => {
  const dir = pastaTemp();
  try {
    let buildChamado = false;
    const saida = await preparar(
      opcoesBase(dir, {
        gerar: true,
        aprovar: true,
        rodarAtualizacao: async () => ({ codigo: 2, erro: 'sem rede' }),
        rodarBuild: async () => { buildChamado = true; return 0; },
      }),
    );
    assert.equal(saida.codigo, 2);
    assert.equal(saida.etapa, 'geracao');
    assert.equal(buildChamado, false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('falha de build interrompe o processo', async () => {
  const dir = pastaTemp();
  try {
    const opts = opcoesBase(dir, { gerar: false, aprovar: true, rodarBuild: async () => 1 });
    gravarSnapshot(opts.snapshotPath, snapshotValido());
    const saida = await preparar(opts);
    assert.equal(saida.codigo, 2);
    assert.equal(saida.etapa, 'build');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('artefato ausente ou divergente reprova', async () => {
  const dir = pastaTemp();
  try {
    const opts = opcoesBase(dir, {
      gerar: false,
      aprovar: true,
      rodarBuild: async () => {
        gravarBuild(join(dir, 'dist'), { assets: `fetch('${BASE_PADRAO}dados.json');` }); // sem dados.json
        return 0;
      },
    });
    gravarSnapshot(opts.snapshotPath, snapshotValido());
    assert.equal((await preparar(opts)).etapa, 'artefato');

    const opts2 = opcoesBase(dir, {
      gerar: false,
      aprovar: true,
      rodarBuild: async () => {
        gravarBuild(join(dir, 'dist'), { dadosJson: 'conteudo-errado', assets: `fetch('${BASE_PADRAO}dados.json');` });
        return 0;
      },
    });
    gravarSnapshot(opts2.snapshotPath, snapshotValido());
    assert.equal((await preparar(opts2)).etapa, 'artefato');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('bundle em modo API (referencia /stats) reprova', async () => {
  const dir = pastaTemp();
  try {
    const opts = opcoesBase(dir, {
      gerar: false,
      aprovar: true,
      rodarBuild: async () => {
        gravarBuild(join(dir, 'dist'), {
          dadosJson: readFileSync(join(dir, 'public', 'dados.json')),
          assets: "fetch('/stats');",
        });
        return 0;
      },
    });
    gravarSnapshot(opts.snapshotPath, snapshotValido());
    const saida = await preparar(opts);
    assert.equal(saida.codigo, 2);
    assert.equal(saida.etapa, 'bundle');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('bundle sem o prefixo do base reprova na etapa bundle', async () => {
  const dir = pastaTemp();
  try {
    const opts = opcoesBase(dir, {
      gerar: false,
      aprovar: true,
      rodarBuild: async () => {
        // index.html ainda declara o subdiretório, mas o bundle aponta para a raiz.
        gravarBuild(join(dir, 'dist'), {
          base: BASE_PADRAO,
          dadosJson: readFileSync(join(dir, 'public', 'dados.json')),
          assets: "fetch('/dados.json');",
        });
        return 0;
      },
    });
    gravarSnapshot(opts.snapshotPath, snapshotValido());
    const saida = await preparar(opts);
    assert.equal(saida.codigo, 2);
    assert.equal(saida.etapa, 'bundle');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('produto final não é publicado e dist permanece para inspeção', async () => {
  const dir = pastaTemp();
  try {
    const opts = opcoesBase(dir, {
      gerar: false,
      aprovar: true,
      rodarBuild: async () => {
        gravarBuild(join(dir, 'dist'), {
          dadosJson: readFileSync(join(dir, 'public', 'dados.json')),
        });
        return 0;
      },
    });
    gravarSnapshot(opts.snapshotPath, snapshotValido());
    const saida = await preparar(opts);
    assert.equal(saida.relatorio.publicado, false);
    assert.ok(existsSync(join(dir, 'dist', 'dados.json')));
    assert.ok(existsSync(join(dir, 'dist', 'assets', 'index-abc.js')));
    assert.ok(existsSync(join(dir, 'dist', '.nojekyll')));
    assert.ok(existsSync(join(dir, 'dist', '404.html')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
