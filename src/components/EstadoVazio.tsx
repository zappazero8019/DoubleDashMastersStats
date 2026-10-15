import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

interface Props {
  titulo: ReactNode;
  texto?: ReactNode;
  icone?: ReactNode;
}

export function EstadoVazio({ titulo, texto, icone }: Props) {
  return (
    <div className="estado" role="status">
      <div className="estado__icone" aria-hidden="true">
        {icone ?? <Inbox size={24} />}
      </div>
      <p className="estado__titulo">{titulo}</p>
      {texto && <p className="estado__texto">{texto}</p>}
    </div>
  );
}
