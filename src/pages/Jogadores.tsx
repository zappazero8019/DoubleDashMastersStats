import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Users } from 'lucide-react';
import { useI18n } from '../i18n';
import { useRecurso } from '../hooks/useRecurso';
import { obterJogadores } from '../api/recursos';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { CarimboAtualizacao } from '../components/CarimboAtualizacao';
import { Cartao } from '../components/Cartao';
import { EstadoVazio } from '../components/EstadoVazio';
import { ResultadoConsulta } from '../components/ResultadoConsulta';
import { ListaEsqueleto } from '../components/Esqueleto';
import { formatarNumero, comoTexto } from '../utils/formatar';
import { compararNome } from '../utils/ordenar';
import type { JogadorEstatisticaDto } from '../types/api';

type Ordenacao = 'pontos' | 'lives' | 'nome';

export function Jogadores() {
  const { t } = useI18n();
  const consulta = useRecurso<JogadorEstatisticaDto[]>('jogadores', (sinal) =>
    obterJogadores({ sinal }),
  );

  return (
    <>
      <CabecalhoPagina
        kicker={t('app.marca.subtitulo')}
        titulo={t('jogadores.titulo')}
        subtitulo={t('jogadores.subtitulo')}
        acoes={
          <CarimboAtualizacao
            atualizadoEm={consulta.atualizadoEm}
            carregando={consulta.carregando}
          />
        }
      />

      <ResultadoConsulta
        carregando={consulta.carregando}
        erro={consulta.erro}
        recarregar={consulta.recarregar}
        vazio={consulta.dados?.length === 0}
        vazioNode={
          <EstadoVazio
            titulo={t('jogadores.vazio.titulo')}
            texto={t('jogadores.vazio.texto')}
            icone={<Users size={24} />}
          />
        }
        esqueleto={<ListaEsqueleto linhas={5} />}
      >
        {consulta.dados && <ListaJogadores jogadores={consulta.dados} />}
      </ResultadoConsulta>
    </>
  );
}

function ListaJogadores({ jogadores }: { jogadores: JogadorEstatisticaDto[] }) {
  const { t, idioma } = useI18n();
  const [busca, setBusca] = useState('');
  const [ordenacao, setOrdenacao] = useState<Ordenacao>('pontos');

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = jogadores.filter((j) => (j.nome ?? '').toLowerCase().includes(termo));
    const copia = [...lista];
    copia.sort((a, b) => {
      if (ordenacao === 'lives') {
        return (b.lives_participadas ?? 0) - (a.lives_participadas ?? 0) ||
          compararNome(a.nome ?? '', b.nome ?? '', idioma);
      }
      if (ordenacao === 'nome') {
        return compararNome(a.nome ?? '', b.nome ?? '', idioma);
      }
      return (b.pontos_totais_live ?? 0) - (a.pontos_totais_live ?? 0) ||
        compararNome(a.nome ?? '', b.nome ?? '', idioma);
    });
    return copia;
  }, [jogadores, busca, ordenacao, idioma]);

  return (
    <Cartao>
      <div className="barra-filtros">
        <div className="campo" style={{ flex: 1, minWidth: 220 }}>
          <label className="campo__rotulo" htmlFor="busca-jogador">
            {t('jogadores.busca.rotulo')}
          </label>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              aria-hidden="true"
              style={{ position: 'absolute', left: 10, top: 11, color: 'var(--texto-fraco)' }}
            />
            <input
              id="busca-jogador"
              className="entrada"
              style={{ paddingLeft: 32, width: '100%' }}
              type="search"
              placeholder={t('jogadores.busca.placeholder')}
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </div>
        </div>
        <div className="campo">
          <label className="campo__rotulo" htmlFor="ordenar-jogador">
            {t('comum.ordenarPor')}
          </label>
          <select
            id="ordenar-jogador"
            className="select"
            value={ordenacao}
            onChange={(evento) => setOrdenacao(evento.target.value as Ordenacao)}
          >
            <option value="pontos">{t('jogadores.ordenar.pontos')}</option>
            <option value="lives">{t('jogadores.ordenar.lives')}</option>
            <option value="nome">{t('jogadores.ordenar.vitorias')}</option>
          </select>
        </div>
      </div>

      {filtrados.length === 0 ? (
        <p className="card__descricao">{t('jogadores.busca.semResultado')}</p>
      ) : (
        <div className="tabela-scroll">
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">{t('jogadores.col.nome')}</th>
                <th scope="col" className="num">
                  {t('jogadores.col.pontos')}
                </th>
                <th scope="col" className="num">
                  {t('jogadores.col.lives')}
                </th>
                <th scope="col" className="num">
                  {t('jogadores.col.melhorLive')}
                </th>
                <th scope="col">{t('comum.detalhes')}</th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((jogador) => (
                <tr key={comoTexto(jogador.player_id)}>
                  <td>
                    <span className="linha" style={{ gap: 10 }}>
                      <span className="avatar" aria-hidden="true">
                        {(jogador.nome ?? '?').slice(0, 1).toUpperCase()}
                      </span>
                      {jogador.nome || '—'}
                    </span>
                  </td>
                  <td className="num destaque">{formatarNumero(jogador.pontos_totais_live, idioma)}</td>
                  <td className="num">{formatarNumero(jogador.lives_participadas, idioma)}</td>
                  <td className="num">{formatarNumero(jogador.melhor_live, idioma)}</td>
                  <td>
                    <Link className="link" to={`/jogadores/${encodeURIComponent(comoTexto(jogador.player_id))}`}>
                      {t('comum.verDetalhes')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Cartao>
  );
}
