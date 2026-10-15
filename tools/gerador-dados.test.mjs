// ===========================================================================
// tools/gerador-dados.test.mjs
// Testes do gerador estático (node --test, sem dependências externas).
// Executar: node --test tools/gerador-dados.test.mjs
// ===========================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  ErroValidacao,
  auditarSeguranca,
  formatarUuid,
  gerarDeDiretorio,
  montarDados,
  validarSessao,
} from './gerador-dados.mjs';

function sessao(over = {}) {
  return {
    versao: 1,
    sessao_id: 'aa'.repeat(16),
    revisao: 10,
    iniciada_em: '2026-03-01T20:00:00',
    finalizada_em: '2026-03-01T21:00:00',
    status: 'finalizada',
    jogadores: [
      { player_id: 0, nome: 'Ana' },
      { player_id: 1, nome: 'Bia' },
      { player_id: 2, nome: 'Caio' },
      { player_id: 3, nome: 'Duda' },
    ],
    baseline: { pontuacao: { '0': 5 }, contagens: {} },
    tempos: { '0': { '1': 100 } },
    url_live: '',
    colocacoes: { '0': 1, '1': 2, '2': 3, '3': 4 },
    ...over,
  };
}

function pastaTemporaria(sessoes, extras = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'gerador-'));
  sessoes.forEach((s, i) => {
    // Nome por índice: nunca colide, mesmo com sessao_id repetido.
    writeFileSync(join(dir, `sessao-${String(i).padStart(3, '0')}.json`), JSON.stringify(s), 'utf-8');
  });
  for (const [nome, conteudo] of Object.entries(extras)) {
    writeFileSync(join(dir, nome), conteudo, 'utf-8');
  }
  return dir;
}

test('validarSessao aceita sessão finalizada válida', () => {
  assert.equal(validarSessao(sessao()).ok, true);
});

test('formatarUuid normaliza hex para UUID com hífens (paridade com a API)', () => {
  assert.equal(
    formatarUuid('e10d0f0d738d4174befb5839e14dd848'),
    'e10d0f0d-738d-4174-befb-5839e14dd848',
  );
  assert.equal(
    formatarUuid('E10D0F0D-738D-4174-BEFB-5839E14DD848'),
    'e10d0f0d-738d-4174-befb-5839e14dd848',
  );
  assert.equal(formatarUuid('nao-e-uuid'), 'nao-e-uuid');
});

test('lives[].sessao_id sai no formato UUID da API', () => {
  const dados = montarDados([sessao({ sessao_id: 'e10d0f0d738d4174befb5839e14dd848' })]);
  assert.equal(dados.recursos.lives[0].sessao_id, 'e10d0f0d-738d-4174-befb-5839e14dd848');
});

test('validarSessao recusa ativa, sem sessao_id e colocação inválida', () => {
  assert.equal(validarSessao(sessao({ status: 'ativa' })).motivo, 'sessao_ativa');
  assert.equal(validarSessao(sessao({ sessao_id: '' })).motivo, 'sessao_id_ausente');
  assert.equal(validarSessao(sessao({ colocacoes: { '0': 9 } })).motivo, 'colocacao_fora_de_1a4');
  assert.equal(validarSessao('nao-objeto').ok, false);
});

test('montarDados reconstrói geral, lives, campeonato e jogadores', () => {
  const s1 = sessao({ sessao_id: 'a'.repeat(32), finalizada_em: '2026-03-01T21:00:00' });
  const s2 = sessao({
    sessao_id: 'b'.repeat(32),
    iniciada_em: '2026-03-08T20:00:00',
    finalizada_em: '2026-03-08T21:00:00',
    colocacoes: { '0': 2, '1': 1, '2': 4, '3': 3 },
  });
  const dados = montarDados([s1, s2]);

  assert.equal(dados.recursos.geral.lives_finalizadas, 2);
  assert.equal(dados.recursos.geral.jogadores, 4);
  assert.equal(dados.recursos.geral.itens_totais, null);
  assert.equal(dados.recursos.itens, null);

  // lives: mais recente primeiro
  assert.equal(dados.recursos.lives[0].sessao_id, 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');
  assert.equal(dados.recursos.lives[0].vencedor_player_id, 1); // Bia
  assert.equal(dados.recursos.lives[0].vencedor_nome, 'Bia');
  assert.equal(dados.recursos.lives[0].vencedor_pontos, null);

  // campeonato: 1 vitória para Ana e 1 para Bia
  const camp = Object.fromEntries(
    dados.recursos.campeonato.map((c) => [c.player_id, c.vitorias]),
  );
  assert.equal(camp[0], 1);
  assert.equal(camp[1], 1);

  // jogadores: participações; pontos indisponíveis
  const jog = dados.recursos.jogadores.find((j) => j.player_id === 0);
  assert.equal(jog.lives_participadas, 2);
  assert.equal(jog.pontos_totais_live, null);
  assert.equal(jog.melhor_live, null);
});

test('empate em 1º: vencedor é o menor player_id, mas o campeonato conta 2 vitórias', () => {
  const empate = sessao({ sessao_id: 'c'.repeat(32), colocacoes: { '0': 1, '1': 1, '2': 3, '3': 4 } });
  const dados = montarDados([empate]);
  assert.equal(dados.recursos.lives[0].vencedor_player_id, 0);
  const vitorias = dados.recursos.campeonato.map((c) => c.vitorias);
  assert.deepEqual(vitorias, [1, 1]); // divergência a documentar vs API (1 vencedor)
});

test('gerarDeDiretorio ignora ativas/inválidas e é idempotente', () => {
  const dir = pastaTemporaria(
    [
      sessao({ sessao_id: 'a'.repeat(32) }),
      sessao({ sessao_id: 'b'.repeat(32), finalizada_em: '2026-03-09T21:00:00', status: 'ativa' }),
    ],
    { 'corrompido.json': '{ isso nao e json' },
  );
  try {
    const r1 = gerarDeDiretorio(dir);
    const r2 = gerarDeDiretorio(dir);
    assert.equal(r1.relatorio.sessoes_aceitas, 1);
    assert.equal(r1.relatorio.ignoradas.length, 1);
    assert.equal(r1.relatorio.invalidas.length, 1);
    assert.equal(JSON.stringify(r1.dados), JSON.stringify(r2.dados));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('gerarDeDiretorio falha seguro com sessao_id duplicado', () => {
  const dir = pastaTemporaria([
    sessao({ sessao_id: 'd'.repeat(32) }),
    sessao({ sessao_id: 'd'.repeat(32) }),
  ]);
  try {
    assert.throws(() => gerarDeDiretorio(dir), ErroValidacao);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('gerarDeDiretorio falha seguro sem sessões finalizadas', () => {
  const dir = pastaTemporaria([sessao({ status: 'ativa' })]);
  try {
    assert.throws(() => gerarDeDiretorio(dir), ErroValidacao);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('saída não contém chaves proibidas (baseline/tempos/token...)', () => {
  const dados = montarDados([sessao()]);
  assert.deepEqual(auditarSeguranca(dados), []);
  const texto = JSON.stringify(dados);
  for (const proibido of ['baseline', 'tempos', 'token', 'revisao']) {
    assert.equal(texto.includes(`"${proibido}"`), false, `não deveria conter ${proibido}`);
  }
});
