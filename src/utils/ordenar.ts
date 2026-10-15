import type { Idioma } from '../i18n';

/** Comparador alfabético sensível ao idioma (nomes podem ter acentos). */
export function compararNome(a: string, b: string, idioma: Idioma): number {
  return new Intl.Collator(idioma, { sensitivity: 'base' }).compare(a, b);
}

/**
 * Ordena cópias de uma lista por um critério numérico decrescente,
 * deixando o nome em ordem alfabética como desempate.
 */
export function ordenarPorNumeroDesc<T>(
  itens: readonly T[],
  valor: (item: T) => number,
  nome: (item: T) => string,
  idioma: Idioma,
): T[] {
  return [...itens].sort((a, b) => {
    const dif = valor(b) - valor(a);
    if (dif !== 0) return dif;
    return compararNome(nome(a), nome(b), idioma);
  });
}

/** Ordena cópias por data (mais recente primeiro ou mais antiga primeiro). */
export function ordenarPorData<T>(
  itens: readonly T[],
  data: (item: T) => string | null | undefined,
  recentesPrimeiro: boolean,
): T[] {
  return [...itens].sort((a, b) => {
    const ta = a ? new Date(data(a) ?? '').getTime() : 0;
    const tb = b ? new Date(data(b) ?? '').getTime() : 0;
    const va = Number.isNaN(ta) ? 0 : ta;
    const vb = Number.isNaN(tb) ? 0 : tb;
    return recentesPrimeiro ? vb - va : va - vb;
  });
}

/** Remove duplicados preservando a ordem original. */
export function unicos<T>(itens: readonly T[]): T[] {
  return [...new Set(itens)];
}
