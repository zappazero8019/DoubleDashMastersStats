import { urlRecurso, FONTE_DADOS, CAMINHO_DADOS } from './config';
import type { RespostaApi } from '../types/api';

/** Códigos de erro normalizados, traduzíveis na interface. */
export type CodigoErro = 'rede' | 'timeout' | 'http' | 'resposta';

export class ErroApi extends Error {
  readonly codigo: CodigoErro;
  readonly status?: number;

  constructor(codigo: CodigoErro, mensagem: string, status?: number) {
    super(mensagem);
    this.name = 'ErroApi';
    this.codigo = codigo;
    this.status = status;
  }
}

/** Converte qualquer erro desconhecido num ErroApi consistente. */
export function normalizarErro(erro: unknown): ErroApi {
  if (erro instanceof ErroApi) return erro;
  if (erro instanceof DOMException && erro.name === 'AbortError') {
    return new ErroApi('timeout', 'A requisição excedeu o tempo limite.');
  }
  return new ErroApi('rede', 'Falha de comunicação com a API.');
}

// ---------------------------------------------------------------------------
// Fonte alternativa: dados.json estático (VITE_FONTE_DADOS=json).
// Mantém os MESMOS recursos/DTOs; só troca a origem. Não afeta o padrão (API).
// ---------------------------------------------------------------------------

interface DadosJsonEstatico {
  schema: number;
  recursos: Record<string, unknown>;
}

let cacheDadosJson: DadosJsonEstatico | null = null;
let dadosJsonEmAndamento: Promise<DadosJsonEstatico> | null = null;

async function carregarDadosJson(sinal?: AbortSignal): Promise<DadosJsonEstatico> {
  if (cacheDadosJson) return cacheDadosJson;
  if (!dadosJsonEmAndamento) {
    dadosJsonEmAndamento = fetch(CAMINHO_DADOS, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: sinal,
    })
      .then(async (resposta) => {
        if (!resposta.ok) {
          throw new ErroApi('http', `Resposta HTTP ${resposta.status}.`, resposta.status);
        }
        const corpo = await resposta.json();
        if (
          typeof corpo !== 'object' ||
          corpo === null ||
          typeof (corpo as DadosJsonEstatico).recursos !== 'object'
        ) {
          throw new ErroApi('resposta', 'dados.json inesperado.');
        }
        cacheDadosJson = corpo as DadosJsonEstatico;
        return cacheDadosJson;
      })
      .catch((erro) => {
        dadosJsonEmAndamento = null; // permite nova tentativa
        throw erro;
      });
  }
  return dadosJsonEmAndamento;
}

/** Compara um campo de um item com o valor informado (string). */
function casar(item: unknown, campo: string, valor: string | undefined): boolean {
  if (valor === undefined) return true;
  if (typeof item !== 'object' || item === null) return false;
  return String((item as Record<string, unknown>)[campo]) === String(valor);
}

/** Aplica o mesmo teto de 500 da API. */
function recortar<T>(lista: T[], limite: string | undefined): T[] {
  if (limite === undefined) return lista;
  const n = Number.parseInt(limite, 10);
  if (!Number.isFinite(n)) return lista;
  return lista.slice(0, Math.min(500, Math.max(1, n)));
}

async function buscarDeDadosJson<T>(
  recurso: string,
  params: Record<string, string | undefined> | undefined,
  sinal?: AbortSignal,
): Promise<T[]> {
  const dados = await carregarDadosJson(sinal);
  const recursos = dados.recursos;
  const lista = (nome: string): T[] => {
    const valor = recursos[nome];
    return Array.isArray(valor) ? (valor as T[]) : [];
  };
  switch (recurso) {
    case 'geral': {
      const valor = recursos.geral;
      return valor && typeof valor === 'object' ? [valor as T] : [];
    }
    case 'lives':
      return recortar(lista('lives'), params?.limite);
    case 'live':
      return lista('lives').filter((x) => casar(x, 'sessao_id', params?.sessao_id));
    case 'campeonato':
      return recortar(
        lista('campeonato').filter((x) => casar(x, 'temporada', params?.ano)),
        params?.limite,
      );
    case 'jogadores':
      return recortar(lista('jogadores'), params?.limite);
    case 'jogador':
      return lista('jogadores').filter((x) => casar(x, 'player_id', params?.player_id));
    case 'itens':
    case 'relampagos':
    case 'cascos_azuis':
      return recortar(lista(recurso), params?.limite);
    default:
      return [];
  }
}

const TIMEOUT_PADRAO_MS = 15000;

interface OpcoesBusca {
  /** Sinal externo (ex.: cancelamento ao desmontar um componente). */
  signal?: AbortSignal;
  /** Tempo máximo, em milissegundos. */
  timeoutMs?: number;
}

/**
 * Executa um GET no recurso informado e devolve a lista `dados`.
 *
 * - Aplica timeout próprio (combinado com o sinal externo).
 * - Valida o envelope `{ ok, recurso, dados }` antes de entregar os dados.
 * - Lança ErroApi tipado para a UI tratar carregamento/erro/vazio.
 */
export async function buscarRecurso<T>(
  recurso: string,
  params?: Record<string, string | undefined>,
  opcoes: OpcoesBusca = {},
): Promise<T[]> {
  const { signal: sinalExterno, timeoutMs = TIMEOUT_PADRAO_MS } = opcoes;

  if (FONTE_DADOS === 'json') {
    if (sinalExterno?.aborted) throw new DOMException('Aborted', 'AbortError');
    return buscarDeDadosJson<T>(recurso, params, sinalExterno);
  }

  const controlador = new AbortController();
  let porTimeout = false;

  const temporizador = setTimeout(() => {
    porTimeout = true;
    controlador.abort();
  }, timeoutMs);

  const aoAbortar = () => controlador.abort();
  if (sinalExterno) {
    if (sinalExterno.aborted) controlador.abort();
    else sinalExterno.addEventListener('abort', aoAbortar);
  }

  try {
    const resposta = await fetch(urlRecurso(recurso, params), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controlador.signal,
    });

    if (!resposta.ok) {
      throw new ErroApi('http', `Resposta HTTP ${resposta.status}.`, resposta.status);
    }

    let corpo: unknown;
    try {
      corpo = await resposta.json();
    } catch {
      throw new ErroApi('resposta', 'Resposta não é um JSON válido.');
    }

    if (
      typeof corpo !== 'object' ||
      corpo === null ||
      (corpo as RespostaApi<T>).ok !== true ||
      !Array.isArray((corpo as RespostaApi<T>).dados)
    ) {
      throw new ErroApi('resposta', 'Envelope de resposta inesperado.');
    }

    return (corpo as RespostaApi<T>).dados;
  } catch (erro) {
    if (erro instanceof ErroApi) throw erro;
    if (porTimeout) {
      throw new ErroApi('timeout', 'A requisição excedeu o tempo limite.');
    }
    if (erro instanceof DOMException && erro.name === 'AbortError') {
      // Cancelamento externo: repassa como está para o hook ignorar.
      throw erro;
    }
    throw new ErroApi('rede', 'Não foi possível contatar a API.');
  } finally {
    clearTimeout(temporizador);
    if (sinalExterno) sinalExterno.removeEventListener('abort', aoAbortar);
  }
}
