import type { LucideIcon } from 'lucide-react';

interface Props {
  rotulo: string;
  valor: string;
  icone: LucideIcon;
  tom?: 'padrao' | 'neon' | 'eletrico';
  dica?: string;
}

export function Kpi({ rotulo, valor, icone: Icone, tom = 'padrao', dica }: Props) {
  const classe = tom === 'padrao' ? 'kpi' : `kpi kpi--${tom}`;
  return (
    <div className={classe}>
      <div className="kpi__icone" aria-hidden="true">
        <Icone size={22} />
      </div>
      <div>
        <p className="kpi__rotulo">{rotulo}</p>
        <p className="kpi__valor">{valor}</p>
        {dica && <p className="kpi__dica">{dica}</p>}
      </div>
    </div>
  );
}
