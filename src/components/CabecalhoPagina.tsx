import type { ReactNode } from 'react';

interface Props {
  titulo: string;
  kicker?: string;
  subtitulo?: ReactNode;
  acoes?: ReactNode;
}

export function CabecalhoPagina({ titulo, kicker, subtitulo, acoes }: Props) {
  return (
    <header className="cabecalho-pagina linha espaco-entre">
      <div>
        {kicker && <p className="cabecalho-pagina__kicker">{kicker}</p>}
        <h1 className="cabecalho-pagina__titulo">{titulo}</h1>
        {subtitulo && <p className="cabecalho-pagina__subtitulo">{subtitulo}</p>}
      </div>
      {acoes && <div className="linha">{acoes}</div>}
    </header>
  );
}
