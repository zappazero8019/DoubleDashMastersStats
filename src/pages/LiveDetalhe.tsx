import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, ExternalLink, Trophy, Tv, User } from 'lucide-react';
import { useI18n } from '../i18n';
import { useRecurso } from '../hooks/useRecurso';
import { obterLive } from '../api/recursos';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { CarimboAtualizacao } from '../components/CarimboAtualizacao';
import { Kpi } from '../components/Kpi';
import { Aviso } from '../components/Aviso';
import { EstadoVazio } from '../components/EstadoVazio';
import { ResultadoConsulta } from '../components/ResultadoConsulta';
import { Esqueleto } from '../components/Esqueleto';
import { formatarData, formatarNumero, formatarTemporada } from '../utils/formatar';
import { ehIdSessaoValido } from '../utils/identificadores';
import type { LiveDto } from '../types/api';

function urlValida(url: string | null): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : null;
}

export function LiveDetalhe() {
  const { t, idioma } = useI18n();
  const { liveId = '' } = useParams();

  // Um id que não é um UUID já é, por si só, uma live inexistente: mostramos o
  // estado vazio sem consultar a API.
  const consulta = useRecurso<LiveDto | null>(`live:${liveId}`, (sinal) =>
    ehIdSessaoValido(liveId) ? obterLive(liveId, { sinal }) : Promise.resolve(null),
  );

  const titulo = consulta.dados
    ? formatarData(consulta.dados.finalizada_em ?? consulta.dados.iniciada_em, idioma, false)
    : t('live.detalhe.titulo');

  return (
    <>
      <CabecalhoPagina
        kicker={t('live.detalhe.titulo')}
        titulo={titulo}
        acoes={
          <CarimboAtualizacao
            atualizadoEm={consulta.atualizadoEm}
            carregando={consulta.carregando}
          />
        }
      />

      <p style={{ marginBottom: 18 }}>
        <Link className="link linha" to="/lives" style={{ gap: 6 }}>
          <ArrowLeft size={15} aria-hidden="true" />
          {t('comum.voltar')}
        </Link>
      </p>

      <ResultadoConsulta
        carregando={consulta.carregando}
        erro={consulta.erro}
        recarregar={consulta.recarregar}
        vazio={consulta.dados === null}
        vazioNode={
          <EstadoVazio
            titulo={t('live.naoEncontrada.titulo')}
            texto={t('live.naoEncontrada.texto')}
            icone={<Tv size={24} />}
          />
        }
        esqueleto={
          <div className="kpi-grid">
            {Array.from({ length: 4 }, (_, i) => (
              <Esqueleto key={i} altura={76} />
            ))}
          </div>
        }
      >
        {consulta.dados && <Detalhe live={consulta.dados} />}
      </ResultadoConsulta>
    </>
  );
}

function Detalhe({ live }: { live: LiveDto }) {
  const { t, idioma } = useI18n();
  const url = urlValida(live.url_live);

  return (
    <div className="pilha">
      <div className="kpi-grid">
        <Kpi
          rotulo={t('live.col.temporada')}
          valor={formatarTemporada(live.temporada)}
          icone={CalendarDays}
          tom="eletrico"
        />
        <Kpi
          rotulo={t('live.col.vencedor')}
          valor={live.vencedor_nome?.trim() || t('comum.naoInformado')}
          icone={User}
          tom="neon"
        />
        <Kpi
          rotulo={t('live.col.pontosVencedor')}
          valor={formatarNumero(live.vencedor_pontos, idioma)}
          icone={Trophy}
        />
        <Kpi
          rotulo={t('live.col.iniciadaEm')}
          valor={formatarData(live.iniciada_em, idioma, true)}
          icone={CalendarDays}
        />
        <Kpi
          rotulo={t('live.col.finalizadaEm')}
          valor={formatarData(live.finalizada_em, idioma, true)}
          icone={CalendarDays}
        />
      </div>

      {url && (
        <a className="botao botao--neon" href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink size={16} aria-hidden="true" />
          {t('comum.abrirTransmissao')}
        </a>
      )}

      <Aviso titulo={t('live.limitacao.titulo')}>{t('live.limitacao.texto')}</Aviso>
    </div>
  );
}
