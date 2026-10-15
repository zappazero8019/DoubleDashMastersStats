import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Flag, Star, Trophy, UserX } from 'lucide-react';
import { useI18n } from '../i18n';
import { useRecurso } from '../hooks/useRecurso';
import { obterJogador } from '../api/recursos';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { CarimboAtualizacao } from '../components/CarimboAtualizacao';
import { Kpi } from '../components/Kpi';
import { Aviso } from '../components/Aviso';
import { EstadoVazio } from '../components/EstadoVazio';
import { ResultadoConsulta } from '../components/ResultadoConsulta';
import { Esqueleto } from '../components/Esqueleto';
import { formatarNumero } from '../utils/formatar';
import { ehIdJogadorValido } from '../utils/identificadores';
import type { JogadorEstatisticaDto } from '../types/api';

export function JogadorDetalhe() {
  const { t } = useI18n();
  const { playerId = '' } = useParams();

  // Um id fora do formato esperado (apenas dígitos) já é, por si só, um jogador
  // inexistente: mostramos o estado vazio sem consultar a API.
  const consulta = useRecurso<JogadorEstatisticaDto | null>(`jogador:${playerId}`, (sinal) =>
    ehIdJogadorValido(playerId) ? obterJogador(playerId, { sinal }) : Promise.resolve(null),
  );

  return (
    <>
      <CabecalhoPagina
        kicker={t('jogador.titulo')}
        titulo={consulta.dados?.nome || t('jogador.titulo')}
        acoes={
          <CarimboAtualizacao
            atualizadoEm={consulta.atualizadoEm}
            carregando={consulta.carregando}
          />
        }
      />

      <p style={{ marginBottom: 18 }}>
        <Link className="link linha" to="/jogadores" style={{ gap: 6 }}>
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
            titulo={t('jogador.naoEncontrado.titulo')}
            texto={t('jogador.naoEncontrado.texto')}
            icone={<UserX size={24} />}
          />
        }
        esqueleto={
          <div className="kpi-grid">
            {Array.from({ length: 3 }, (_, i) => (
              <Esqueleto key={i} altura={76} />
            ))}
          </div>
        }
      >
        {consulta.dados && <Perfil jogador={consulta.dados} />}
      </ResultadoConsulta>
    </>
  );
}

function Perfil({ jogador }: { jogador: JogadorEstatisticaDto }) {
  const { t, idioma } = useI18n();

  return (
    <div className="pilha">
      <div className="kpi-grid">
        <Kpi
          rotulo={t('jogador.kpi.pontos')}
          valor={formatarNumero(jogador.pontos_totais_live, idioma)}
          icone={Trophy}
          tom="neon"
        />
        <Kpi
          rotulo={t('jogador.kpi.lives')}
          valor={formatarNumero(jogador.lives_participadas, idioma)}
          icone={Flag}
          tom="eletrico"
        />
        <Kpi
          rotulo={t('jogador.kpi.melhorLive')}
          valor={formatarNumero(jogador.melhor_live, idioma)}
          icone={Star}
        />
      </div>
      <Aviso>{t('jogador.limitacao')}</Aviso>
    </div>
  );
}
