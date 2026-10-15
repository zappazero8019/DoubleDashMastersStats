import type { ReactNode } from 'react';

interface Props {
  titulo?: ReactNode;
  descricao?: ReactNode;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Cartao({ titulo, descricao, acoes, children, className = '' }: Props) {
  return (
    <section className={`card ${className}`.trim()}>
      {(titulo || acoes) && (
        <header className="card__topo">
          <div>
            {titulo && <h2 className="card__titulo">{titulo}</h2>}
            {descricao && <p className="card__descricao">{descricao}</p>}
          </div>
          {acoes && <div className="linha">{acoes}</div>}
        </header>
      )}
      <div className="card__corpo">{children}</div>
    </section>
  );
}
