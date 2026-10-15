// ---------------------------------------------------------------------------
// ÚNICA fonte da URL base da API pública de leitura.
// Não espalhe endereços da API por outros módulos: importe daqui.
// ---------------------------------------------------------------------------
//
// A API é pública, somente-leitura e libera CORS (*). Não há token, chave ou
// qualquer credencial no frontend — este valor pode ser trocado via
// VITE_API_BASE_URL em tempo de build, mas o padrão já aponta para produção.

const BASE_PADRAO = 'https://mkddtracker-api.netlify.app';

const doAmbiente = import.meta.env.VITE_API_BASE_URL;

export const API_BASE_URL: string = (doAmbiente && doAmbiente.trim()) || BASE_PADRAO;

/** Caminho do endpoint de estatísticas. */
export const CAMINHO_STATS = '/stats';

// ---------------------------------------------------------------------------
// Fonte de dados: 'api' (padrão, produção) ou 'json' (dados.json estático).
// Só muda de onde os dados vêm — os DTOs e recursos são idênticos. O padrão
// NÃO usa json: a produção continua consultando a API.
// ---------------------------------------------------------------------------
export const FONTE_DADOS: 'api' | 'json' =
  import.meta.env.VITE_FONTE_DADOS === 'json' ? 'json' : 'api';

/** Caminho do dados.json estático (relativo à base do site, ex.: /dados.json). */
export const CAMINHO_DADOS = `${import.meta.env.BASE_URL}dados.json`;

/** Monta a URL completa de um recurso com os parâmetros informados. */
export function urlRecurso(
  recurso: string,
  params?: Record<string, string | undefined>,
): string {
  const url = new URL(CAMINHO_STATS, API_BASE_URL);
  url.searchParams.set('recurso', recurso);
  if (params) {
    for (const [chave, valor] of Object.entries(params)) {
      if (valor !== undefined && valor !== null && valor !== '') {
        url.searchParams.set(chave, valor);
      }
    }
  }
  return url.toString();
}
