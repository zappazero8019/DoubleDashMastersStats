#!/usr/bin/env node
// ===========================================================================
// tools/comparar-api.mjs
// ===========================================================================
//
// Compara o `dados.json` gerado (arquitetura JSON estática) com o BASELINE
// capturado da API pública atual (`GET /stats?recurso=...`), recurso a
// recurso, e emite um relatório objetivo de diferenças.
//
// NÃO acessa rede: lê o baseline gravado em disco. NÃO publica nada.
//
// Uso:
//   node tools/comparar-api.mjs \
//        --dados <dados.json> --baseline <pasta-baseline> \
//        [--saida comparacao.json] [--md comparacao.md]
// ===========================================================================

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const RECURSOS_LISTA = ['lives', 'campeonato', 'jogadores', 'itens', 'relampagos', 'cascos_azuis'];

function lerJson(caminho) {
  if (!existsSync(caminho)) return null;
  try {
    return JSON.parse(readFileSync(caminho, 'utf-8'));
  } catch {
    return null;
  }
}

/** Lista de dados de um arquivo baseline (envelope { ok, recurso, dados }). */
function dadosBaseline(dir, recurso) {
  const env = lerJson(join(dir, `${recurso}.json`));
  if (env && Array.isArray(env.dados)) return env.dados;
  return null;
}

function igual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function compararGeral(api, json) {
  const apiRow = (api ?? [])[0];
  if (!apiRow) return { recurso: 'geral', disponivel: false };
  const camposComparaveis = ['lives_finalizadas', 'lives_em_andamento', 'jogadores'];
  const divergencias = [];
  const iguais = [];
  for (const campo of camposComparaveis) {
    if (json[campo] === null || json[campo] === undefined) {
      divergencias.push({ campo, api: apiRow[campo], json: json[campo], tipo: 'indisponivel' });
    } else if (igual(apiRow[campo], json[campo])) {
      iguais.push(campo);
    } else {
      divergencias.push({ campo, api: apiRow[campo], json: json[campo], tipo: 'valor' });
    }
  }
  const indisponiveis = ['itens_totais', 'relampagos', 'cascos_azuis'].map((campo) => ({
    campo,
    api: apiRow[campo],
    json: json[campo],
    tipo: 'indisponivel',
  }));
  return {
    recurso: 'geral',
    disponivel: true,
    api_linhas: 1,
    json_linhas: 1,
    iguais,
    divergencias,
    indisponiveis,
  };
}

/** Compara listas por uma chave composta estável. */
function compararLista(recurso, api, json, chaveFn, campos) {
  if (api === null) return { recurso, disponivel: false };
  if (json === null || json === undefined) {
    return {
      recurso,
      disponivel: true,
      api_linhas: api.length,
      json_linhas: 0,
      indisponivel_total: true,
      divergencias: [{ tipo: 'indisponivel', motivo: 'recurso indisponível no JSON (null)' }],
    };
  }
  const mapaApi = new Map(api.map((row) => [chaveFn(row), row]));
  const mapaJson = new Map(json.map((row) => [chaveFn(row), row]));
  const divergencias = [];
  const faltandoNoJson = [];
  const faltandoNaApi = [];

  for (const [chave, rowApi] of mapaApi) {
    const rowJson = mapaJson.get(chave);
    if (!rowJson) {
      faltandoNoJson.push(chave);
      continue;
    }
    for (const campo of campos) {
      const va = rowApi[campo];
      const vj = rowJson[campo];
      if (vj === null || vj === undefined) {
        divergencias.push({ chave, campo, api: va, json: vj, tipo: 'indisponivel' });
      } else if (!igual(va, vj)) {
        divergencias.push({ chave, campo, api: va, json: vj, tipo: 'valor' });
      }
    }
  }
  for (const chave of mapaJson.keys()) if (!mapaApi.has(chave)) faltandoNaApi.push(chave);

  return {
    recurso,
    disponivel: true,
    api_linhas: api.length,
    json_linhas: json.length,
    faltando_no_json: faltandoNoJson,
    faltando_na_api: faltandoNaApi,
    divergencias,
  };
}

export function comparar(dados, baselineDir) {
  const r = dados.recursos ?? {};
  const porRecurso = [];

  porRecurso.push(compararGeral(dadosBaseline(baselineDir, 'geral'), r.geral));
  porRecurso.push(
    compararLista(
      'lives',
      dadosBaseline(baselineDir, 'lives'),
      r.lives,
      (x) => String(x.sessao_id),
      ['temporada', 'vencedor_player_id', 'vencedor_nome', 'vencedor_pontos', 'url_live'],
    ),
  );
  porRecurso.push(
    compararLista(
      'campeonato',
      dadosBaseline(baselineDir, 'campeonato'),
      r.campeonato,
      (x) => `${x.temporada}|${x.player_id}`,
      ['vitorias', 'nome'],
    ),
  );
  porRecurso.push(
    compararLista(
      'jogadores',
      dadosBaseline(baselineDir, 'jogadores'),
      r.jogadores,
      (x) => String(x.player_id),
      ['nome', 'lives_participadas', 'pontos_totais_live', 'melhor_live'],
    ),
  );
  for (const recurso of ['itens', 'relampagos', 'cascos_azuis']) {
    const api = dadosBaseline(baselineDir, recurso);
    porRecurso.push({
      recurso,
      disponivel: api !== null,
      api_linhas: api ? api.length : null,
      json_linhas: r[recurso] === null ? 0 : Array.isArray(r[recurso]) ? r[recurso].length : null,
      indisponivel_total: r[recurso] === null,
    });
  }

  // Detalhe (live/jogador) quando o baseline existir.
  const liveApi = dadosBaseline(baselineDir, 'live');
  const jogadorApi = dadosBaseline(baselineDir, 'jogador');
  const detalhe = {};
  if (liveApi && liveApi[0] && Array.isArray(r.lives)) {
    const alvo = r.lives.find((l) => l.sessao_id === liveApi[0].sessao_id);
    detalhe.live = alvo
      ? {
          encontrado: true,
          campos_ausentes: alvo.vencedor_pontos === null ? ['vencedor_pontos'] : [],
        }
      : { encontrado: false };
  }
  if (jogadorApi && jogadorApi[0] && Array.isArray(r.jogadores)) {
    const alvo = r.jogadores.find((j) => String(j.player_id) === String(jogadorApi[0].player_id));
    detalhe.jogador = alvo
      ? {
          encontrado: true,
          campos_ausentes: [
            ...(alvo.pontos_totais_live === null ? ['pontos_totais_live'] : []),
            ...(alvo.melhor_live === null ? ['melhor_live'] : []),
          ],
        }
      : { encontrado: false };
  }

  const limitacoes = [
    'itens/relâmpagos/cascos azuis não são reconstruíveis de sessões arquivadas (só via sincronização).',
    'pontuação por live (vencedor_pontos, pontos_totais_live, melhor_live) não está no arquivo de sessão.',
    'lives_em_andamento só existe no servidor (arquivos arquivados não guardam a sessão ativa).',
    'sem histórico local completo: 1 sessão finalizada não representa o site inteiro.',
    'ordenação de jogadores difere (API ordena por pontos; JSON sem pontos usa nome).',
    'datas: API expõe timestamptz (+00:00); arquivo local usa hora local sem fuso.',
  ];

  return {
    recursos: porRecurso,
    detalhe,
    limitacoes,
    resumo: {
      divergencias_totais: porRecurso.reduce(
        (soma, x) => soma + (x.divergencias ? x.divergencias.length : 0),
        0,
      ),
      recursos_indisponiveis: porRecurso.filter((x) => x.indisponivel_total).map((x) => x.recurso),
    },
  };
}

function paraMarkdown(comparacao) {
  const linhas = [];
  linhas.push('# Comparação `dados.json` × API atual', '');
  linhas.push(`- Divergências totais: **${comparacao.resumo.divergencias_totais}**`);
  linhas.push(
    `- Recursos indisponíveis no JSON: **${comparacao.resumo.recursos_indisponiveis.join(', ') || '—'}**`,
    '',
  );
  for (const r of comparacao.recursos) {
    linhas.push(`## ${r.recurso}`, '');
    if (!r.disponivel) {
      linhas.push('_baseline ausente_', '');
      continue;
    }
    linhas.push(`- API: ${r.api_linhas} linha(s) · JSON: ${r.json_linhas} linha(s)`);
    if (r.indisponivel_total) linhas.push('- JSON indisponível (null)');
    if (r.faltando_no_json && r.faltando_no_json.length) {
      linhas.push(`- Faltando no JSON: ${r.faltando_no_json.join(', ')}`);
    }
    if (r.faltando_na_api && r.faltando_na_api.length) {
      linhas.push(`- Só no JSON: ${r.faltando_na_api.join(', ')}`);
    }
    for (const d of r.divergencias ?? []) {
      linhas.push(
        `  - [${d.tipo}] ${d.campo ?? d.motivo}: API=${JSON.stringify(d.api)} JSON=${JSON.stringify(d.json)}${d.chave ? ` (${d.chave})` : ''}`,
      );
    }
    linhas.push('');
  }
  linhas.push('## Limitações', '');
  for (const l of comparacao.limitacoes) linhas.push(`- ${l}`);
  linhas.push('');
  return linhas.join('\n');
}

function lerArgs(argv) {
  const args = { dados: null, baseline: null, saida: null, md: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dados') args.dados = argv[++i];
    else if (a === '--baseline') args.baseline = argv[++i];
    else if (a === '--saida') args.saida = argv[++i];
    else if (a === '--md') args.md = argv[++i];
  }
  return args;
}

function escrever(caminho, texto) {
  const destino = resolve(caminho);
  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, texto, 'utf-8');
  return destino;
}

function main(argv = process.argv.slice(2)) {
  const args = lerArgs(argv);
  if (!args.dados || !args.baseline) {
    console.error('uso: node tools/comparar-api.mjs --dados <dados.json> --baseline <pasta> [--saida j] [--md m]');
    return 2;
  }
  const dados = lerJson(args.dados);
  if (!dados) {
    console.error(`não foi possível ler ${args.dados}`);
    return 2;
  }
  const comparacao = comparar(dados, args.baseline);
  const saida = args.saida ?? 'comparacao.json';
  escrever(saida, `${JSON.stringify(comparacao, null, 2)}\n`);
  const md = paraMarkdown(comparacao);
  if (args.md) escrever(args.md, md);
  console.log(md);
  console.log(`comparação: ${resolve(saida)}`);
  return 0;
}

const direto = process.argv[1] && process.argv[1].endsWith('comparar-api.mjs');
if (direto) process.exit(main());
