import type { ReactNode } from 'react';
import { Info } from 'lucide-react';

interface Props {
  titulo?: ReactNode;
  children: ReactNode;
  tom?: 'info' | 'regra';
}

export function Aviso({ titulo, children, tom = 'info' }: Props) {
  return (
    <div className={`aviso${tom === 'regra' ? ' aviso--regra' : ''}`}>
      <span className="aviso__icone" aria-hidden="true">
        <Info size={18} />
      </span>
      <div>
        {titulo && <strong className="aviso__titulo">{titulo}</strong>}
        {children}
      </div>
    </div>
  );
}
