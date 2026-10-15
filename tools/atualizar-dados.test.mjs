// ===========================================================================
// tools/atualizar-dados.test.mjs
// Testes do procedimento de atualização do snapshot (node --test).
// SEM tocar a API de produção e SEM publicar nada.
// Executar: node --test tools/atualizar-dados.test.mjs
// ===========================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { exportar } from './exportar-api.mjs';
import {
  atualizar,
  compararSnapshots,
  detectarRegressao,
  lerSnapshot,
  verificarMetadados,
} from './atualizar-dados.mjs';

const SID = 'e10d0f0d-738d-4174-befb-5839e14dd848';
const AGORA = new Date('2026-10-13T21:00:00Z');
const BASE = 'https://exemplo.test';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Conjunto coerente que espelha a forma real dos recursos da API. */
function base() {
  const itens = [
    { sessao_id: SID, temporada: 2026, player_id: 3, nome: 'João Paulo', nome_item: 'Casco Azul', classe: 'casco_azul', total: 20, aquisicoes: 20 },
    { sessao_id: SID, temporada: 2026, player_id: 1, nome: 'André', nome_item: 'Casco Azul', classe: 'casco_azul', total: 17, aquisicoes: 17 },
    { sessao_id: SID, temporada: 2026, player_id: 0, nome: 'Daniel', nome_item: 'Raio', classe: 'relampago', total: 11, aquisicoes: 11 },
  ];
  return {
    geral: [{ lives_finalizadas: 1, lives_em_andamento: 1, jogadores: 4, itens_totais: 48, relampagos: 11, cascos_azuis: 37 }],
    lives: [{ sessao_id: SID, temporada: 2026, iniciada_em: '2026-10-11T20:56:22+00:00', finalizada_em: '2026-10-11T22:13:57+00:00', url_live: '', vencedor_player_id: 1, vencedor_nome: 'André', vencedor_pontos: 10 }],
    campeonato: [{ temporada: 2026, player_id: 1, nome: 'André', vitorias: 1 }],
    jogadores: [
      { player_id: 0, nome: 'Daniel', lives_participadas: 1, pontos_totais_live: 9, melhor_live: 9 },
      { player_id: 1, nome: 'André', lives_participadas: 1, pontos_totais_live: 10, melhor_live: 10 },
      { player_id: 2, nome: 'Samuel', lives_participadas: 1, pontos_totais_live: 7, melhor_live: 7 },
      { player_id: 3, nome: 'João Paulo', lives_participadas: 1, pontos_totais_live: -2, melhor_live: -2 },
    ],
    itens,
    relampagos: itens.filter((i) => i.classe === 'relampago'),
    cascos_azuis: itens.filter((i) => i.classe === 'casco_azul'),
  };
}

/** Igual ao base, mas com +1 Casco Azul do André (atualização legítima). */
function baseComMaisUmCasco() {
  const d = base();
  const alvo = d.itens.find((i) => i.player_id === 1 && i.nome_item === 'Casco Azul');
  alvo.total += 1;
  alvo.aquisicoes += 1;
  d.cascos_azuis = d.itens.filter((i) => i.classe === 'casco_azul');
  d.relampagos = d.itens.filter((i) => i.classe === 'relampago');
  d.geral[0].itens_totais += 1;
  d.geral[0].cascos_azuis += 1;
  return d;
}

/** Tudo zerado, mas internamente consistente (simula resposta parcial da API). */
function vazio() {
  return {
    geral: [{ lives_finalizadas: 0, lives_em_andamento: 0, jogadores: 0, itens_totais: 0, relampagos: 0, cascos_azuis: 0 }],
    lives: [],
    campeonato: [],
    jogadores: [],
    itens: [],
    relampagos: [],
    cascos_azuis: [],
  };
}

function fetchDe(mapa) {
  return async (url) => {
    const recurso = new URL(url).searchParams.get('recurso');
    const dados = typeof mapa[recurso] === 'function' ? mapa[recurso](url) : mapa[recurso] ?? [];
    if (dados && dados.__resposta) return dados.__resposta;
    return { ok: true, status: 200, json: async () => ({ ok: true, recurso, dados }) };
  };
}

function respostaCrua(corpo, status = 200) {
  return { __resposta: { ok: status >= 200 && status < 300, status, json: async () => corpo } };
}

function pastaTemp() {
  return mkdtempSync(join(tmpdir(), 'atualizar-dados-'));
}

async function snapshotValido(bruto) {
  const { dados } = await exportar({ baseUrl: BASE, fetchImpl: fetchDe(bruto), timeoutMs: 1000, agora: AGORA });
  return dados;
}

function opcoes(dir, fetchImpl, extra = {}) {
  const destino = join(dir, 'public', 'dados.json');
  mkdirSync(join(dir, 'public'), { recursive: true });
  return {
    destino,
    baseUrl: BASE,
    fetchImpl,
    timeoutMs: 1000,
    agora: AGORA,
    relatorioPath: join(dir, 'relatorio-atualizacao.json'),
    dirTemp: join(dir, 'tmp'),
    ...extra,
  };
}

// ---------------------------------------------------------------------------
// Unidades puras
// ---------------------------------------------------------------------------

test('lerSnapshot devolve null para ausente, inválido ou sem recursos', () => {
  const dir = pastaTemp();
  try {
    assert.equal(lerSnapshot(join(dir, 'nao-existe.json')), null);
    const ruim = join(dir, 'ruim.json');
    writeFileSync(ruim, 'não é json', 'utf-8');
    assert.equal(lerSnapshot(ruim), null);
    const semRecursos = join(dir, 'sem.json');
    writeFileSync(semRecursos, JSON.stringify({ schema: 1 }), 'utf-8');
    assert.equal(lerSnapshot(semRecursos), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('compararSnapshots relata deltas e não inventa lives novas', async () => {
  const anterior = await snapshotValido(base());
  const novo = await snapshotValido(baseComMaisUmCasco());
  const c = compararSnapshots(anterior, novo);
  assert.equal(c.deltas.itens_totais, 1);
  assert.equal(c.deltas.cascos_azuis, 1);
  assert.deepEqual(c.lives_novas, []);
  assert.deepEqual(c.lives_removidas, []);
  assert.equal(c.schema_mudou, false);
  assert.ok(c.anterior && c.novo);
});

test('detectarRegressao aprova aumento e acusa queda/zeragem', async () => {
  const anterior = await snapshotValido(base());
  const maior = await snapshotValido(baseComMaisUmCasco());
  assert.deepEqual(detectarRegressao(anterior, maior), []);

  const zerado = await snapshotValido(vazio());
  const motivos = detectarRegressao(anterior, zerado);
  assert.ok(motivos.some((m) => m.includes('lives_finalizadas')));
  assert.ok(motivos.some((m) => m.includes('perdeu todas as lives')));
  assert.ok(motivos.some((m) => m.includes('itens_totais')));
});

test('detectarRegressao acusa troca de esquema', async () => {
  const anterior = await snapshotValido(base());
  const novo = await snapshotValido(base());
  novo.schema = 99;
  assert.ok(detectarRegressao(anterior, novo).some((m) => m.includes('esquema')));
});

test('verificarMetadados aprova snapshot válido e acusa campos ausentes', async () => {
  const ok = await snapshotValido(base());
  assert.deepEqual(verificarMetadados(ok), []);

  const semCampos = await snapshotValido(base());
  delete semCampos.campos_indisponiveis;
  assert.ok(verificarMetadados(semCampos).some((p) => p.includes('campos_indisponiveis')));

  const semCompletude = await snapshotValido(base());
  semCompletude.completude.completo = false;
  assert.ok(verificarMetadados(semCompletude).some((p) => p.includes('completude')));

  const semLives = await snapshotValido(base());
  delete semLives.recursos.lives[0].sessao_id;
  assert.ok(verificarMetadados(semLives).some((p) => p.includes('sessao_id')));
});

// ---------------------------------------------------------------------------
// atualizar (fluxo completo, com fetch falso)
// ---------------------------------------------------------------------------

test('atualizar grava o destino e o relatório quando a exportação é completa', async () => {
  const dir = pastaTemp();
  try {
    const anterior = await snapshotValido(base());
    const opts = opcoes(dir, fetchDe(baseComMaisUmCasco()));
    writeFileSync(opts.destino, JSON.stringify(anterior, null, 2), 'utf-8');

    const saida = await atualizar(opts);
    assert.equal(saida.codigo, 0);
    const gravado = JSON.parse(readFileSync(opts.destino, 'utf-8'));
    assert.equal(gravado.recursos.geral.itens_totais, 49);
    assert.equal(gravado.completude.completo, true);
    assert.ok(gravado.campos_indisponiveis.length > 0);
    const rel = JSON.parse(readFileSync(opts.relatorioPath, 'utf-8'));
    assert.equal(rel.status, 'ok');
    assert.equal(rel.comparacao.deltas.itens_totais, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('atualizar falha seguro (HTTP 503) e PRESERVA o snapshot anterior', async () => {
  const dir = pastaTemp();
  try {
    const opts = opcoes(dir, fetchDe({ lives: respostaCrua({ ok: false }, 503) }));
    const anteriorTexto = '{\n  "anterior": true\n}\n';
    writeFileSync(opts.destino, anteriorTexto, 'utf-8');

    const saida = await atualizar(opts);
    assert.equal(saida.codigo, 2);
    assert.equal(readFileSync(opts.destino, 'utf-8'), anteriorTexto, 'o anterior foi alterado');
    const rel = JSON.parse(readFileSync(opts.relatorioPath, 'utf-8'));
    assert.equal(rel.status, 'falha_segura');
    assert.equal(rel.saida_nao_gravada, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('atualizar falha seguro quando a exportação fica INCOMPLETA e preserva o anterior', async () => {
  const dir = pastaTemp();
  try {
    const d = base();
    d.geral[0].lives_finalizadas = 42; // sem correspondência em lives => agregação inconsistente
    const opts = opcoes(dir, fetchDe(d));
    const anteriorTexto = '{"anterior":true}\n';
    writeFileSync(opts.destino, anteriorTexto, 'utf-8');

    const saida = await atualizar(opts);
    assert.equal(saida.codigo, 2);
    assert.equal(readFileSync(opts.destino, 'utf-8'), anteriorTexto);
    const rel = JSON.parse(readFileSync(opts.relatorioPath, 'utf-8'));
    assert.equal(rel.completo, false);
    assert.equal(rel.saida_nao_gravada, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('atualizar RECUSA regressão (novo "vazio" consistente) e preserva o anterior', async () => {
  const dir = pastaTemp();
  try {
    const anterior = await snapshotValido(base());
    const opts = opcoes(dir, fetchDe(vazio()));
    const anteriorTexto = JSON.stringify(anterior, null, 2);
    writeFileSync(opts.destino, anteriorTexto, 'utf-8');

    const saida = await atualizar(opts);
    assert.equal(saida.codigo, 3);
    assert.ok(saida.regressoes.length > 0);
    assert.equal(readFileSync(opts.destino, 'utf-8'), anteriorTexto, 'o anterior foi alterado');
    const rel = JSON.parse(readFileSync(opts.relatorioPath, 'utf-8'));
    assert.equal(rel.status, 'regressao');
    assert.equal(rel.saida_nao_gravada, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('atualizar com forcar substitui mesmo diante de regressão', async () => {
  const dir = pastaTemp();
  try {
    const anterior = await snapshotValido(base());
    const opts = opcoes(dir, fetchDe(vazio()), { forcar: true });
    writeFileSync(opts.destino, JSON.stringify(anterior, null, 2), 'utf-8');

    const saida = await atualizar(opts);
    assert.equal(saida.codigo, 0);
    const gravado = JSON.parse(readFileSync(opts.destino, 'utf-8'));
    assert.equal(gravado.recursos.geral.lives_finalizadas, 0);
    const rel = JSON.parse(readFileSync(opts.relatorioPath, 'utf-8'));
    assert.equal(rel.status, 'ok');
    assert.ok(Array.isArray(rel.regressoes) && rel.regressoes.length > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('atualizar não deixa arquivo temporário após sucesso', async () => {
  const dir = pastaTemp();
  try {
    const opts = opcoes(dir, fetchDe(baseComMaisUmCasco()));
    const saida = await atualizar(opts);
    assert.equal(saida.codigo, 0);
    assert.deepEqual(readdirSync(opts.dirTemp).filter((n) => n.startsWith('dados-')), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('atualizar preserva o anterior também quando o esquema muda', async () => {
  const dir = pastaTemp();
  try {
    const anterior = await snapshotValido(base());
    anterior.schema = 99;
    const opts = opcoes(dir, fetchDe(base()));
    const anteriorTexto = JSON.stringify(anterior, null, 2);
    writeFileSync(opts.destino, anteriorTexto, 'utf-8');

    const saida = await atualizar(opts);
    assert.equal(saida.codigo, 3);
    assert.ok(saida.regressoes.some((m) => m.includes('esquema')));
    assert.equal(readFileSync(opts.destino, 'utf-8'), anteriorTexto);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
