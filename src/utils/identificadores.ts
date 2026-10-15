// ---------------------------------------------------------------------------
// Validação de identificadores de rota antes de consultar a API pública.
//
// A API espera `player_id` como inteiro e `sessao_id` no formato UUID. Valores
// fora desse formato provocam erro de leitura (HTTP 503). Validamos aqui para
// apresentar o estado "não encontrado" sem disparar uma chamada desnecessária —
// sem, contudo, mascarar indisponibilidade real (que continua sendo erro).
// ---------------------------------------------------------------------------

const APENAS_DIGITOS = /^\d+$/;

// Formato canônico 8-4-4-4-12 em hexadecimal (aceita o UUID nulo e qualquer
// versão, como o próprio banco aceita).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Aceita apenas inteiros não negativos seguros para conversão numérica. */
export function ehIdJogadorValido(valor: string | undefined): boolean {
  if (!valor || !APENAS_DIGITOS.test(valor)) return false;
  return Number.isSafeInteger(Number(valor));
}

/** Aceita apenas identificadores de sessão no formato UUID. */
export function ehIdSessaoValido(valor: string | undefined): boolean {
  return typeof valor === 'string' && UUID.test(valor);
}
