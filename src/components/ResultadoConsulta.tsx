import type { ReactNode } from 'react';
import { EstadoErro } from './EstadoErro';
import { ListaEsqueleto } from './Esqueleto';
import type { ErroApi } from '../api/client';

interface Props {
  carregando: boolean;
  erro: ErroApi | null;
  recarregar: () => void;
  vazio: boolean;
  vazioNode: ReactNode;
  esqueleto?: ReactNode;
  children: ReactNode;
}

/**
 * Encapsula a lógica de carregamento → erro → vazio → conteúdo,
 * para que as páginas fiquem declarativas e consistentes.
 */
export function ResultadoConsulta({
  carregando,
  erro,
  recarregar,
  vazio,
  vazioNode,
  esqueleto,
  children,
}: Props) {
  if (carregando) return <>{esqueleto ?? <ListaEsqueleto />}</>;
  if (erro) return <EstadoErro erro={erro} aoTentarNovamente={recarregar} />;
  if (vazio) return <>{vazioNode}</>;
  return <>{children}</>;
}
