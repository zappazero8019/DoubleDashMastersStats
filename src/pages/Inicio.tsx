import { Link } from 'react-router-dom';
import { ArrowRight, Flag, Package, Radio, Shell, Trophy, Users, Zap } from 'lucide-react';
import { useI18n } from '../i18n';
import { useRecurso } from '../hooks/useRecurso';
import {
  obterCampeonato,
  obterCascosAzuis,
  obterGeral,
  obterJogadores,
  obterRelampagos,
} from '../api/recursos';
import type { CampeonatoDto, GeralDto, ItemContagemDto, JogadorEstatisticaDto } from '../types/api';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { CarimboAtualizacao } from '../components/CarimboAtualizacao';
import { Kpi } from '../components/Kpi';
import { Cartao } from '../components/Cartao';
import { Esqueleto } from '../components/Esqueleto';
import { EstadoVazio } from '../components/EstadoVazio';
import { ResultadoConsulta } from '../components/ResultadoConsulta';
import { GraficoBarras } from '../components/GraficoBarras';
import { agregarItensPorJogador, agregarVitoriasPorJogador } from '../utils/agregacoes';
import type { LinhaItens } from '../utils/agregacoes';
import { formatarNumero } from '../utils/formatar';
import { compararNome, ordenarPorNumeroDesc } from '../utils/ordenar';

interface DadosInicio {
  geral: GeralDto | null;
  campeonato: CampeonatoDto[];
  relampagos: ItemContagemDto[];
  cascosAzuis: ItemContagemDto[];
  jogadores: JogadorEstatisticaDto[];
}

export function Inicio() {
  const { t } = useI18n();

  const consulta = useRecurso<DadosInicio>('inicio', async (sinal) => {
    const [geral, campeonato, relampagos, cascosAzuis, jogadores] = await Promise.all([
      obterGeral({ sinal }),
      obterCampeonato({ sinal }),
      obterRelampagos({ sinal }),
      obterCascosAzuis({ sinal }),
      obterJogadores({ sinal }),
    ]);
    return { geral, campeonato, relampagos, cascosAzuis, jogadores };
  });

  return (
    <>
      <CabecalhoPagina
        kicker={t('app.marca.subtitulo')}
        titulo={t('inicio.titulo')}
        subtitulo={t('inicio.subtitulo')}
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
        vazio={false}
        vazioNode={null}
        esqueleto={
          <div className="kpi-grid">
            {Array.from({ length: 6 }, (_, i) => (
              <Esqueleto key={i} altura={76} />
            ))}
          </div>
        }
      >
        {consulta.dados && <Conteudo dados={consulta.dados} />}
      </ResultadoConsulta>
    </>
  );
}

function Conteudo({ dados }: { dados: DadosInicio }) {
  const { t, idioma } = useI18n();
  const { geral, campeonato, relampagos, cascosAzuis } = dados;

  const totalVitorias = campeonato.reduce((soma, linha) => soma + (linha.vitorias ?? 0), 0);
  const semDados =
    geral !== null &&
    geral.lives_finalizadas === 0 &&
    campeonato.length === 0 &&
    dados.jogadores.length === 0 &&
    relampagos.length === 0 &&
    cascosAzuis.length === 0;

  const vitoriasPorJogador = ordenarPorNumeroDesc(
    agregarVitoriasPorJogador(campeonato),
    (l) => l.vitorias,
    (l) => l.nome,
    idioma,
  );
  const ranking = [...vitoriasPorJogador].sort(
    (a, b) => b.vitorias - a.vitorias || compararNome(a.nome, b.nome, idioma),
  );
  const relampagosPorJogador = ordenarPorNumeroDesc(
    agregarItensPorJogador(relampagos),
    (l) => l.total,
    (l) => l.nome,
    idioma,
  );
  const cascosPorJogador = ordenarPorNumeroDesc(
    agregarItensPorJogador(cascosAzuis),
    (l) => l.total,
    (l) => l.nome,
    idioma,
  );

  return (
    <div className="pilha">
      <div className="kpi-grid">
        <Kpi
          rotulo={t('inicio.kpi.jogadores')}
          valor={formatarNumero(geral?.jogadores, idioma)}
          icone={Users}
          tom="neon"
          dica={t('inicio.kpi.jogadores.dica')}
        />
        <Kpi
          rotulo={t('inicio.kpi.livesFinalizadas')}
          valor={formatarNumero(geral?.lives_finalizadas, idioma)}
          icone={Flag}
          tom="eletrico"
          dica={t('inicio.kpi.livesFinalizadas.dica')}
        />
        <Kpi
          rotulo={t('inicio.kpi.vitorias')}
          valor={formatarNumero(totalVitorias, idioma)}
          icone={Trophy}
          tom="neon"
          dica={t('inicio.kpi.vitorias.dica')}
        />
        <Kpi
          rotulo={t('inicio.kpi.emAndamento')}
          valor={formatarNumero(geral?.lives_em_andamento, idioma)}
          icone={Radio}
          dica={t('inicio.kpi.emAndamento.dica')}
        />
        <Kpi
          rotulo={t('inicio.kpi.itens')}
          valor={formatarNumero(geral?.itens_totais, idioma)}
          icone={Package}
          dica={t('inicio.kpi.itens.dica')}
        />
        <Kpi
          rotulo={t('inicio.kpi.relampagos')}
          valor={formatarNumero(geral?.relampagos, idioma)}
          icone={Zap}
          tom="eletrico"
          dica={t('inicio.kpi.relampagos.dica')}
        />
        <Kpi
          rotulo={t('inicio.kpi.cascosAzuis')}
          valor={formatarNumero(geral?.cascos_azuis, idioma)}
          icone={Shell}
          tom="eletrico"
          dica={t('inicio.kpi.cascosAzuis.dica')}
        />
      </div>

      {semDados ? (
        <>
          <EstadoVazio titulo={t('vazio.titulo')} texto={t('vazio.texto')} />
          <Atalhos />
        </>
      ) : (
        <>
          <div className="grade grade--2">
            <Cartao
              titulo={t('inicio.grafico.vitorias.titulo')}
              descricao={t('inicio.grafico.vitorias.descricao')}
            >
              {vitoriasPorJogador.length > 0 ? (
                <GraficoBarras
                  itens={vitoriasPorJogador.map((l) => ({ nome: l.nome, valor: l.vitorias }))}
                  ariaLabel={t('inicio.grafico.vitorias.titulo')}
                  cor="var(--grafico-1)"
                  formatarValor={(v) => formatarNumero(v, idioma)}
                />
              ) : (
                <EstadoVazio titulo={t('comum.semDados')} />
              )}
            </Cartao>

            <Cartao titulo={t('inicio.ranking.titulo')} descricao={t('inicio.ranking.descricao')}>
              {ranking.length > 0 ? (
                <div className="tabela-scroll">
                  <table className="tabela">
                    <thead>
                      <tr>
                        <th scope="col">{t('campeonato.col.posicao')}</th>
                        <th scope="col">{t('comum.jogador')}</th>
                        <th scope="col" className="num">
                          {t('comum.vitorias')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {ranking.slice(0, 8).map((linha, indice) => (
                        <tr key={linha.nome}>
                          <td>
                            <span className={`posicao${indice < 3 ? ` posicao--${indice + 1}` : ''}`}>
                              {indice + 1}
                            </span>
                          </td>
                          <td>{linha.nome}</td>
                          <td className="num destaque">{formatarNumero(linha.vitorias, idioma)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EstadoVazio titulo={t('comum.semDados')} />
              )}
            </Cartao>
          </div>

          <Cartao titulo={t('inicio.itens.titulo')} descricao={t('inicio.itens.descricao')}>
            <div className="grade grade--2">
              <TabelaItens titulo={t('inicio.kpi.relampagos')} linhas={relampagosPorJogador} />
              <TabelaItens titulo={t('inicio.kpi.cascosAzuis')} linhas={cascosPorJogador} />
            </div>
          </Cartao>

          <Atalhos />
        </>
      )}
    </div>
  );
}

function TabelaItens({ titulo, linhas }: { titulo: string; linhas: LinhaItens[] }) {
  const { t, idioma } = useI18n();
  return (
    <div>
      <p className="card__titulo" style={{ marginBottom: 10 }}>
        {titulo}
      </p>
      {linhas.length > 0 ? (
        <div className="tabela-scroll">
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">{t('comum.jogador')}</th>
                <th scope="col" className="num">
                  {t('estatisticas.col.total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {linhas.slice(0, 6).map((linha) => (
                <tr key={linha.nome}>
                  <td>{linha.nome}</td>
                  <td className="num">{formatarNumero(linha.total, idioma)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="card__descricao">{t('comum.semDados')}</p>
      )}
    </div>
  );
}

function Atalhos() {
  const { t } = useI18n();
  const itens: { para: string; rotulo: string }[] = [
    { para: '/campeonato', rotulo: t('inicio.atalhos.campeonato') },
    { para: '/jogadores', rotulo: t('inicio.atalhos.jogadores') },
    { para: '/lives', rotulo: t('inicio.atalhos.lives') },
    { para: '/estatisticas', rotulo: t('inicio.atalhos.itens') },
  ];
  return (
    <Cartao titulo={t('inicio.atalhos.titulo')}>
      <div className="linha">
        {itens.map((item) => (
          <Link key={item.para} className="botao" to={item.para}>
            {item.rotulo} <ArrowRight size={15} />
          </Link>
        ))}
      </div>
    </Cartao>
  );
}
