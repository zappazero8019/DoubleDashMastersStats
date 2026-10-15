import test from 'node:test';
import assert from 'node:assert/strict';
import { montarClassificacao, temporadasDoCampeonato } from '../src/utils/campeonato.ts';

// Fábricas mínimas (o módulo lê apenas temporada, player_id, nome, vitorias e
// pontos_totais_live).
const C = (temporada, player_id, nome, vitorias) => ({ temporada, player_id, nome, vitorias });
const J = (player_id, nome, pontos_totais_live) => ({
  player_id,
  nome,
  pontos_totais_live,
});

const IDIOMA = 'pt-BR';

function montar(campeonato, jogadores, temporada) {
  return montarClassificacao({ campeonato, jogadores, temporada, idioma: IDIOMA });
}

test('temporadasDoCampeonato ignora nulos e ordena decrescente', () => {
  const campeonato = [
    C(2026, 1, 'A', 1),
    C(2024, 2, 'B', 1),
    C(2025, 3, 'C', 1),
    C(null, 4, 'D', 1),
    C(Number.NaN, 5, 'E', 1),
  ];
  assert.deepEqual(temporadasDoCampeonato(campeonato), [2026, 2025, 2024]);
});

test('temporada única: líder isolado por pontos e posições definidas', () => {
  const campeonato = [C(2026, 1, 'André', 2), C(2026, 2, 'Bruno', 1)];
  const jogadores = [J(1, 'André', 30), J(2, 'Bruno', 20)];
  const r = montar(campeonato, jogadores, 2026);

  assert.equal(r.pontosDisponiveis, true);
  assert.deepEqual(r.temporadas, [2026]);
  assert.deepEqual(
    r.linhas.map((l) => [l.nome, l.pontos, l.vitorias, l.posicao, l.lider]),
    [
      ['André', 30, 2, 1, true],
      ['Bruno', 20, 1, 2, false],
    ],
  );
});

test('dois empatados em primeiro: ambos líderes com a mesma posição', () => {
  const campeonato = [C(2026, 1, 'Ana', 1), C(2026, 2, 'Bruno', 1), C(2026, 3, 'Carla', 0)];
  const jogadores = [J(1, 'Ana', 10), J(2, 'Bruno', 10), J(3, 'Carla', 5)];
  const r = montar(campeonato, jogadores, 2026);

  assert.deepEqual(
    r.linhas.map((l) => [l.nome, l.posicao, l.lider]),
    [
      ['Ana', 1, true],
      ['Bruno', 1, true],
      ['Carla', 3, false],
    ],
  );
});

test('empate de pontos desempata por vitórias; nomes iguais em vitórias mantêm a posição', () => {
  const campeonato = [C(2026, 1, 'Ana', 2), C(2026, 2, 'Bruno', 1), C(2026, 3, 'Carla', 1)];
  const jogadores = [J(1, 'Ana', 10), J(2, 'Bruno', 10), J(3, 'Carla', 10)];
  const r = montar(campeonato, jogadores, 2026);

  assert.deepEqual(
    r.linhas.map((l) => [l.nome, l.posicao, l.lider]),
    [
      ['Ana', 1, true],
      ['Bruno', 2, false],
      ['Carla', 2, false],
    ],
  );
});

test('jogador sem vitória na temporada aparece com 0 vitórias e seus pontos', () => {
  const campeonato = [C(2026, 1, 'André', 1)];
  const jogadores = [J(1, 'André', 10), J(2, 'Bruno', 0), J(3, 'Carla', -2)];
  const r = montar(campeonato, jogadores, 2026);

  assert.deepEqual(
    r.linhas.map((l) => [l.nome, l.pontos, l.vitorias, l.posicao]),
    [
      ['André', 10, 1, 1],
      ['Bruno', 0, 0, 2],
      ['Carla', -2, 0, 3],
    ],
  );
});

test('temporadas diferentes não misturam pontos nem vitórias', () => {
  const campeonato = [
    C(2026, 1, 'A', 2),
    C(2026, 2, 'B', 1),
    C(2025, 3, 'C', 3),
    C(2025, 4, 'D', 1),
  ];
  const jogadores = [J(1, 'A', 30), J(2, 'B', 20), J(3, 'C', 15), J(4, 'D', 5)];

  const r2026 = montar(campeonato, jogadores, 2026);
  assert.equal(r2026.pontosDisponiveis, false);
  assert.deepEqual(r2026.temporadas, [2026, 2025]);
  assert.deepEqual(
    r2026.linhas.map((l) => [l.playerId, l.pontos, l.vitorias]),
    [
      ['1', null, 2],
      ['2', null, 1],
    ],
  );

  const r2025 = montar(campeonato, jogadores, 2025);
  assert.deepEqual(
    r2025.linhas.map((l) => [l.playerId, l.pontos, l.vitorias]),
    [
      ['3', null, 3],
      ['4', null, 1],
    ],
  );
});

test('"todas as temporadas" soma vitórias e usa pontos acumulados', () => {
  const campeonato = [
    C(2026, 1, 'A', 2),
    C(2025, 1, 'A', 0),
    C(2026, 2, 'B', 1),
    C(2025, 3, 'C', 3),
  ];
  const jogadores = [J(1, 'A', 30), J(2, 'B', 20), J(3, 'C', 15)];

  const r = montar(campeonato, jogadores, null);
  assert.equal(r.pontosDisponiveis, true);
  assert.deepEqual(
    r.linhas.map((l) => [l.playerId, l.pontos, l.vitorias, l.posicao, l.lider]),
    [
      ['1', 30, 2, 1, true],
      ['2', 20, 1, 2, false],
      ['3', 15, 3, 3, false],
    ],
  );
});

test('dados incompletos: nome ausente, vitórias inválidas e vencedor sem pontos', () => {
  const campeonato = [C(2026, 7, null, Number.NaN), C(2026, 8, '  ', 2)];
  const jogadores = [J(8, 'Beatriz', 12)]; // o jogador 7 não tem pontos

  const r = montar(campeonato, jogadores, 2026);
  assert.equal(r.pontosDisponiveis, true);
  assert.deepEqual(
    r.linhas.map((l) => [l.playerId, l.nome, l.pontos, l.vitorias]),
    [
      ['8', 'Beatriz', 12, 2],
      ['7', '#7', null, 0],
    ],
  );
});

test('sem dados: lista vazia e sem exceção', () => {
  const r = montar([], [], null);
  assert.deepEqual(r.linhas, []);
  assert.deepEqual(r.temporadas, []);
  assert.equal(r.pontosDisponiveis, true);
});

test('temporada desconhecida (null) conta como grupo e desativa pontos por temporada', () => {
  const campeonato = [C(2026, 1, 'A', 1), C(null, 9, 'SemTemporada', 1)];
  const jogadores = [J(1, 'A', 10), J(9, 'SemTemporada', 4)];

  const rTodas = montar(campeonato, jogadores, null);
  assert.equal(rTodas.pontosDisponiveis, true);
  assert.deepEqual(
    rTodas.linhas.map((l) => l.playerId),
    ['1', '9'],
  );

  const r2026 = montar(campeonato, jogadores, 2026);
  assert.equal(r2026.pontosDisponiveis, false);
  assert.deepEqual(
    r2026.linhas.map((l) => l.playerId),
    ['1'],
  );
});

test('ordena nomes com acento respeitando o idioma', () => {
  const campeonato = [C(2026, 1, 'Ávila', 5), C(2026, 2, 'Anderson', 5)];
  const jogadores = [J(1, 'Ávila', 1), J(2, 'Anderson', 1)];
  const r = montar(campeonato, jogadores, 2026);
  assert.deepEqual(
    r.linhas.map((l) => l.nome),
    ['Anderson', 'Ávila'],
  );
});
