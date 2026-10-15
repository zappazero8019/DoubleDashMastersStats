import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Crown, Trophy } from 'lucide-react';
import { useI18n } from '../i18n';
import { useRecurso } from '../hooks/useRecurso';
import { obterCampeonato, obterJogadores } from '../api/recursos';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { CarimboAtualizacao } from '../components/CarimboAtualizacao';
import { Cartao } from '../components/Cartao';
import { Aviso } from '../components/Aviso';
import { Badge } from '../components/Badge';
import { EstadoVazio } from '../components/EstadoVazio';
import { ResultadoConsulta } from '../components/ResultadoConsulta';
import { ListaEsqueleto } from '../components/Esqueleto';
import { formatarNumero, formatarTemporada } from '../utils/formatar';
import { montarClassificacao, type ClassificacaoCampeonato } from '../utils/campeonato';
import type { CampeonatoDto, JogadorEstatisticaDto } from '../types/api';

const TODAS = 'todas';

interface DadosCampeonato {
  campeonato: CampeonatoDto[];
  jogadores: JogadorEstatisticaDto[];
}

export function Campeonato() {
  const { t } = useI18n();
  const consulta = useRecurso<DadosCampeonato>('campeonato', async (sinal) => {
    const [campeonato, jogadores] = await Promise.all([
      obterCampeonato({ sinal, limite: 500 }),
      obterJogadores({ sinal, limite: 500 }),
    ]);
    return { campeonato, jogadores };
  });

  return (
    <>
      <CabecalhoPagina
        kicker={t('app.marca.subtitulo')}
        titulo={t('campeonato.titulo')}
        subtitulo={t('campeonato.subtitulo')}
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
        vazio={consulta.dados?.campeonato.length === 0}
        vazioNode={
          <EstadoVazio
            titulo={t('campeonato.vazio.titulo')}
            texto={t('campeonato.vazio.texto')}
            icone={<Trophy size={24} />}
          />
        }
        esqueleto={<ListaEsqueleto linhas={6} />}
      >
        {consulta.dados && (
          <Classificacao
            campeonato={consulta.dados.campeonato}
            jogadores={consulta.dados.jogadores}
          />
        )}
      </ResultadoConsulta>
    </>
  );
}

function Classificacao({
  campeonato,
  jogadores,
}: {
  campeonato: CampeonatoDto[];
  jogadores: JogadorEstatisticaDto[];
}) {
  const { t, idioma } = useI18n();
  const [temporada, setTemporada] = useState<string>(TODAS);

  const classificacao = useMemo(
    () =>
      montarClassificacao({
        campeonato,
        jogadores,
        temporada: temporada === TODAS ? null : Number(temporada),
        idioma,
      }),
    [campeonato, jogadores, temporada, idioma],
  );

  const { temporadas } = classificacao;

  return (
    <div className="pilha">
      <div className="barra-filtros">
        <div className="campo">
          <label className="campo__rotulo" htmlFor="temporada">
            {t('campeonato.seletor.rotulo')}
          </label>
          <select
            id="temporada"
            className="select"
            value={temporada}
            onChange={(evento) => setTemporada(evento.target.value)}
          >
            <option value={TODAS}>{t('campeonato.seletor.todas')}</option>
            {temporadas.map((ano) => (
              <option key={ano} value={String(ano)}>
                {formatarTemporada(ano)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Aviso tom="regra" titulo={t('campeonato.regra.titulo')}>
        {t('campeonato.regra.texto')}
      </Aviso>

      {!classificacao.pontosDisponiveis && (
        <Aviso tom="info" titulo={t('campeonato.limitacao.pontos.titulo')}>
          {t('campeonato.limitacao.pontos.texto')}
        </Aviso>
      )}

      <Cartao>
        {classificacao.linhas.length === 0 ? (
          <EstadoVazio titulo={t('campeonato.vazio.titulo')} texto={t('campeonato.vazio.texto')} />
        ) : (
          <ClassificacaoTabela classificacao={classificacao} />
        )}
      </Cartao>
    </div>
  );
}

function ClassificacaoTabela({ classificacao }: { classificacao: ClassificacaoCampeonato }) {
  const { t, idioma } = useI18n();
  const { linhas, pontosDisponiveis } = classificacao;

  return (
    <div className="tabela-scroll">
      <table className="tabela">
        <thead>
          <tr>
            <th scope="col">{t('campeonato.col.posicao')}</th>
            <th scope="col">{t('campeonato.col.jogador')}</th>
            <th scope="col" className="num">
              {t('campeonato.col.pontos')}
            </th>
            <th scope="col" className="num">
              {t('campeonato.col.vitorias')}
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => (
            <tr key={linha.playerId} className={linha.lider ? 'campeonato-lider' : undefined}>
              <td>
                <span
                  className={
                    linha.posicao <= 3 ? `posicao posicao--${linha.posicao}` : 'posicao'
                  }
                >
                  {linha.posicao}
                </span>
              </td>
              <td>
                <span className="celula-jogador">
                  <Link className="link" to={`/jogadores/${encodeURIComponent(linha.playerId)}`}>
                    {linha.nome}
                  </Link>
                  {linha.lider && (
                    <Badge variante="neon">
                      <Crown size={14} aria-hidden="true" />
                      {t('campeonato.lider')}
                    </Badge>
                  )}
                </span>
              </td>
              <td className="num">
                {pontosDisponiveis ? formatarNumero(linha.pontos, idioma) : '—'}
              </td>
              <td className="num destaque">{formatarNumero(linha.vitorias, idioma)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
