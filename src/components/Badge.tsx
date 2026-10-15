import type { ReactNode } from 'react';

type Variante = 'mudo' | 'neon' | 'eletrico';

interface Props {
  children: ReactNode;
  variante?: Variante;
}

export function Badge({ children, variante = 'mudo' }: Props) {
  const classe = variante === 'mudo' ? 'badge' : `badge badge--${variante}`;
  return <span className={classe}>{children}</span>;
}
