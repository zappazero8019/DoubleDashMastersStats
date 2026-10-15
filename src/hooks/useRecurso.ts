import { useCallback, useEffect, useRef, useState } from 'react';
import { ErroApi, normalizarErro } from '../api/client';

export interface EstadoConsulta<T> {
  dados: T | null;
  carregando: boolean;
  erro: ErroApi | null;
  atualizadoEm: Date | null;
  recarregar: () => void;
}

/**
 * Executa uma consulta à API com estados de carregamento, erro e
 * "atualizado em". Cancela a requisição ao desmontar ou quando a chave muda.
 *
 * @param chave  string que representa a consulta; mudar a chave refaz a busca.
 * @param carregador função que devolve os dados; recebe o AbortSignal.
 */
export function useRecurso<T>(
  chave: string,
  carregador: (sinal: AbortSignal) => Promise<T>,
): EstadoConsulta<T> {
  const [dados, setDados] = useState<T | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<ErroApi | null>(null);
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null);
  const [gatilho, setGatilho] = useState(0);

  const carregadorRef = useRef(carregador);
  carregadorRef.current = carregador;

  useEffect(() => {
    const controlador = new AbortController();
    let ativo = true;

    setCarregando(true);
    setErro(null);

    carregadorRef
      .current(controlador.signal)
      .then((resultado) => {
        if (!ativo) return;
        setDados(resultado);
        setCarregando(false);
        setAtualizadoEm(new Date());
      })
      .catch((falha: unknown) => {
        if (!ativo) return;
        if (controlador.signal.aborted) return;
        if (falha instanceof DOMException && falha.name === 'AbortError') return;
        setErro(normalizarErro(falha));
        setCarregando(false);
      });

    return () => {
      ativo = false;
      controlador.abort();
    };
  }, [chave, gatilho]);

  const recarregar = useCallback(() => setGatilho((g) => g + 1), []);

  return { dados, carregando, erro, atualizadoEm, recarregar };
}
