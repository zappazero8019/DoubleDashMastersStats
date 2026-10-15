// ===========================================================================
// tools/exportar-api.test.mjs
// Testes do exportador da API (node --test, SEM tocar a API de produção).
// Executar: node --test tools/exportar-api.test.mjs
// ===========================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ErroExportacao,
  LIMITE_MAX,
  auditarChavesProibidas,
  buscarRecurso,
  exportar,
  main,
  urlRecurso,
} from './exportar-api.mjs';

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

/** fetch falso: devolve o envelope a partir de um mapa recurso->dados. */
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

function exportarFake(mapa, extra = {}) {
  return exportar({ baseUrl: BASE, fetchImpl: fetchDe(mapa), timeoutMs: 1000, agora: AGORA, ...extra });
}

// ---------------------------------------------------------------------------
// buscarRecurso
// ---------------------------------------------------------------------------

test('buscarRecurso aceita envelope válido', async () => {
  const dados = await buscarRecurso('lives', { baseUrl: BASE, fetchImpl: fetchDe(base()), timeoutMs: 1000 });
  assert.equal(dados.length, 1);
  assert.equal(dados[0].sessao_id, SID);
});

test('buscarRecurso rejeita envelope inválido (dados não é lista)', async () => {
  const fetch = fetchDe({ lives: respostaCrua({ ok: true, recurso: 'lives', dados: 'x' }) });
  await assert.rejects(
    () => buscarRecurso('lives', { baseUrl: BASE, fetchImpl: fetch, timeoutMs: 1000 }),
    (e) => e instanceof ErroExportacao && e.codigo === 'envelope',
  );
});

test('buscarRecurso rejeita recurso rotulado errado', async () => {
  const fetch = fetchDe({ lives: respostaCrua({ ok: true, recurso: 'outro', dados: [] }) });
  await assert.rejects(
    () => buscarRecurso('lives', { baseUrl: BASE, fetchImpl: fetch, timeoutMs: 1000 }),
    (e) => e instanceof ErroExportacao && e.codigo === 'envelope',
  );
});

test('buscarRecurso sinaliza erro HTTP', async () => {
  const fetch = fetchDe({ lives: respostaCrua({ ok: false }, 503) });
  await assert.rejects(
    () => buscarRecurso('lives', { baseUrl: BASE, fetchImpl: fetch, timeoutMs: 1000 }),
    (e) => e instanceof ErroExportacao && e.codigo === 'http',
  );
});

test('buscarRecurso sinaliza timeout', async () => {
  const fetch = (_url, opts) =>
    new Promise((_resolve, reject) => {
      opts.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    });
  await assert.rejects(
    () => buscarRecurso('lives', { baseUrl: BASE, fetchImpl: fetch, timeoutMs: 10 }),
    (e) => e instanceof ErroExportacao && e.codigo === 'timeout',
  );
});

test('urlRecurso inclui limite=LIMITE_MAX', () => {
  const url = urlRecurso(BASE, 'itens', { limite: LIMITE_MAX });
  assert.match(url, /recurso=itens/);
  assert.match(url, new RegExp(`limite=${LIMITE_MAX}`));
});

// ---------------------------------------------------------------------------
// exportar / consolidar
// ---------------------------------------------------------------------------

test('exportação válida é marcada como completa e preserva IDs/datas/fusos', async () => {
  const { dados, relatorio } = await exportarFake(base());
  assert.equal(relatorio.completo, true);
  assert.equal(dados.completude.completo, true);
  assert.equal(dados.schema, 1);
  assert.equal(dados.fonte, BASE);
  assert.equal(dados.gerado_em, '2026-10-13T18:00:00-03:00');

  // IDs e datas passam intactos (com o fuso original).
  assert.equal(dados.recursos.lives[0].sessao_id, SID);
  assert.equal(dados.recursos.lives[0].iniciada_em, '2026-10-11T20:56:22+00:00');
  assert.equal(dados.recursos.lives[0].vencedor_pontos, 10);
  assert.equal(dados.recursos.itens.length, 3);

  // Campos indisponíveis documentados explicitamente.
  for (const campo of ['tempos', 'colocacoes_por_live', 'baseline', 'eventos']) {
    assert.ok(dados.campos_indisponiveis.includes(campo), `faltou ${campo}`);
  }
  // nenhum recurso incompleto
  assert.deepEqual(dados.completude.recursos.lives.truncado, false);
});

test('duplicidade de sessao_id reprova a exportação', async () => {
  const d = base();
  d.lives.push({ ...d.lives[0] });
  const { relatorio } = await exportarFake(d);
  assert.equal(relatorio.completo, false);
  assert.equal(relatorio.duplicadas.some((x) => x.recurso === 'lives.sessao_id'), true);
});

test('truncamento (limite 500) reprova e não aprova para publicação', async () => {
  const d = base();
  d.itens = Array.from({ length: LIMITE_MAX }, (_, i) => ({
    sessao_id: SID,
    temporada: 2026,
    player_id: i % 4,
    nome: 'X',
    nome_item: 'Item',
    classe: null,
    total: 0,
    aquisicoes: 0,
  }));
  const { dados, relatorio } = await exportarFake(d);
  assert.equal(relatorio.completo, false);
  assert.equal(dados.completude.recursos.itens.truncado, true);
  assert.ok(relatorio.avisos.some((a) => a.includes('itens')));
});

test('inconsistência de agregados reprova a exportação', async () => {
  const d = base();
  d.geral[0].itens_totais = 999; // soma real: 48
  const { relatorio } = await exportarFake(d);
  assert.equal(relatorio.completo, false);
  assert.equal(
    relatorio.verificacoes.find((v) => v.nome.includes('itens_totais'))?.ok,
    false,
  );
});

test('item órfão (sessao_id fora de lives) reprova a exportação', async () => {
  const d = base();
  d.itens[0] = { ...d.itens[0], sessao_id: '11111111-1111-1111-1111-111111111111' };
  d.relampagos = d.itens.filter((i) => i.classe === 'relampago');
  d.cascos_azuis = d.itens.filter((i) => i.classe === 'casco_azul');
  const { relatorio } = await exportarFake(d);
  assert.equal(relatorio.completo, false);
  assert.equal(relatorio.verificacoes.find((v) => v.nome.includes('sessao_id ∈ lives'))?.ok, false);
});

test('saída não contém chaves proibidas', async () => {
  const { dados } = await exportarFake(base());
  assert.deepEqual(auditarChavesProibidas(dados), []);
});

test('determinismo: mesma entrada + mesmo instante => saída idêntica', async () => {
  const a = await exportarFake(base());
  const b = await exportarFake(base());
  assert.equal(JSON.stringify(a.dados), JSON.stringify(b.dados));
});

// ---------------------------------------------------------------------------
// CLI / escrita atômica
// ---------------------------------------------------------------------------

function pastaTemp() {
  return mkdtempSync(join(tmpdir(), 'exportar-api-'));
}

test('main grava o arquivo só quando a exportação é completa', async () => {
  const dir = pastaTemp();
  const saida = join(dir, 'dados.json');
  const rel = join(dir, 'rel.json');
  try {
    const codigo = await main(['--saida', saida, '--relatorio', rel], {
      fetchImpl: fetchDe(base()),
      agora: () => AGORA,
    });
    assert.equal(codigo, 0);
    assert.equal(existsSync(saida), true);
    const gravado = JSON.parse(readFileSync(saida, 'utf-8'));
    assert.equal(gravado.schema, 1);
    assert.equal(gravado.completude.completo, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('main falha seguro e PRESERVA o JSON anterior quando a exportação falha', async () => {
  const dir = pastaTemp();
  const saida = join(dir, 'dados.json');
  const rel = join(dir, 'rel.json');
  const anterior = '{\n  "schema": 1,\n  "antigo": true\n}\n';
  writeFileSync(saida, anterior, 'utf-8');
  try {
    const codigo = await main(['--saida', saida, '--relatorio', rel], {
      fetchImpl: fetchDe({ lives: respostaCrua({ ok: false }, 503) }),
      agora: () => AGORA,
    });
    assert.equal(codigo, 2);
    assert.equal(readFileSync(saida, 'utf-8'), anterior, 'o arquivo anterior foi alterado');
    const relatorio = JSON.parse(readFileSync(rel, 'utf-8'));
    assert.equal(relatorio.status, 'falha_segura');
    assert.equal(relatorio.codigo, 'http');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('main NÃO grava dados incompletos (preserva o arquivo anterior)', async () => {
  const dir = pastaTemp();
  const saida = join(dir, 'dados.json');
  const rel = join(dir, 'rel.json');
  const anterior = '{"antigo":true}\n';
  writeFileSync(saida, anterior, 'utf-8');
  const d = base();
  d.geral[0].lives_finalizadas = 42; // inconsistente com lives.length = 1
  try {
    const codigo = await main(['--saida', saida, '--relatorio', rel], {
      fetchImpl: fetchDe(d),
      agora: () => AGORA,
    });
    assert.equal(codigo, 2);
    assert.equal(readFileSync(saida, 'utf-8'), anterior);
    const relatorio = JSON.parse(readFileSync(rel, 'utf-8'));
    assert.equal(relatorio.saida_nao_gravada, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
