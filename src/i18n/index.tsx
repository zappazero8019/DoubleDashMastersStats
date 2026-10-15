import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { ptBR } from './pt-BR';
import type { ChaveTraducao } from './pt-BR';
import { en } from './en';

export type Idioma = 'pt-BR' | 'en';

export const IDIOMAS: { id: Idioma; rotulo: string; curto: string }[] = [
  { id: 'pt-BR', rotulo: 'Português', curto: 'PT' },
  { id: 'en', rotulo: 'English', curto: 'EN' },
];

const DICIONARIOS: Record<Idioma, Record<ChaveTraducao, string>> = {
  'pt-BR': ptBR,
  en,
};

const CHAVE_ARMAZENAMENTO = 'ddm.idioma';
const IDIOMA_PADRAO: Idioma = 'pt-BR';

function idiomaInicial(): Idioma {
  if (typeof window === 'undefined') return IDIOMA_PADRAO;
  try {
    const salvo = window.localStorage.getItem(CHAVE_ARMAZENAMENTO);
    if (salvo === 'pt-BR' || salvo === 'en') return salvo;
  } catch {
    // localStorage indisponível (modo privado): usa o padrão.
  }
  return IDIOMA_PADRAO;
}

interface ContextoI18n {
  idioma: Idioma;
  definirIdioma: (idioma: Idioma) => void;
  /** Traduz uma chave central do dicionário. */
  t: (chave: ChaveTraducao) => string;
}

const Contexto = createContext<ContextoI18n | null>(null);

export function ProvedorI18n({ children }: { children: ReactNode }) {
  const [idioma, setIdioma] = useState<Idioma>(idiomaInicial);

  useEffect(() => {
    document.documentElement.lang = idioma;
    try {
      window.localStorage.setItem(CHAVE_ARMAZENAMENTO, idioma);
    } catch {
      // Ignora falha de persistência; a escolha vale para a sessão.
    }
  }, [idioma]);

  const t = useCallback(
    (chave: ChaveTraducao) => DICIONARIOS[idioma][chave] ?? DICIONARIOS[IDIOMA_PADRAO][chave] ?? chave,
    [idioma],
  );

  const valor = useMemo<ContextoI18n>(
    () => ({ idioma, definirIdioma: setIdioma, t }),
    [idioma, t],
  );

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useI18n(): ContextoI18n {
  const contexto = useContext(Contexto);
  if (!contexto) {
    throw new Error('useI18n deve ser usado dentro de <ProvedorI18n>.');
  }
  return contexto;
}

export type { ChaveTraducao };
