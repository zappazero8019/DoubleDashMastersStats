import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, Radio, Tv } from 'lucide-react';
import { useI18n } from '../i18n';
import type { ChaveTraducao } from '../i18n';
import { useRecurso } from '../hooks/useRecurso';
import { obterGeral, obterLives } from '../api/recursos';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { CarimboAtualizacao } from '../components/CarimboAtualizacao';
import { Cartao } from '../components/Cartao';
import { Aviso } from '../components/Aviso';
import { EstadoVazio } from '../components/EstadoVazio';
import { ResultadoConsulta } from '../components/ResultadoConsulta';
import { ListaEsqueleto } from '../components/Esqueleto';
import { comoTexto, formatarData, formatarNumero, formatarTemporada } from '../utils/formatar';
import { compararNome, ordenarPorData, unicos } from '../utils/ordenar';
import type { GeralDto, LiveDto } from '../types/api';

const TODAS = 'todas';

/** Monta a mensagem do estado vazio quando há lives em andamento. */
function textoEmAndamento(t: (chave: ChaveTraducao) => string, quantidade: number): string {
  return quantidade === 1
    ? t('lives.vazio.emAndamento.uma')
    : t('lives.vazio.emAndamento.varias').replace('{n}', String(quantidade));
}

function dataDa(live: LiveDto): string | null {
  return live.finalizada_em ?? live.iniciada_em;
}

function urlValida(url: string | null): string | null {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? url : null;
}

export function Lives() {
  const { t } = useI18n();
  const consulta = useRecurso<LiveDto[]>('lives', (sinal) => obterLives({ sinal, limite: 500 }));
  // A lista acima traz apenas lives finalizadas. O recurso `geral` informa
  // quantas lives estão em andamento, para esclarecer o estado vazio.
  const geral = useRecurso<GeralDto | null>('lives:geral', (sinal) => obterGeral({ sinal }));

  // Sem dados de `geral` (falha ou ausência), não inventamos quantidade.
  const emAndamento = geral.erro ? null : (geral.dados?.lives_em_andamento ?? null);

  return (
    <>
      <CabecalhoPagina
        kicker={t('app.marca.subtitulo')}
        titulo={t('lives.titulo')}
        subtitulo={t('lives.subtitulo')}
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
          emAndamento !== null && emAndamento > 0 ? (
            <EstadoVazio
              titulo={t('lives.vazio.emAndamento.titulo')}
              texto={textoEmAndamento(t, emAndamento)}
              icone={<Radio size={24} />}
            />
          ) : (
            <EstadoVazio
              titulo={t('lives.vazio.titulo')}
              texto={t('lives.vazio.texto')}
              icone={<Tv size={24} />}
            />
          )
        }
        esqueleto={<ListaEsqueleto linhas={6} />}
      >
        {consulta.dados && <ListaLives lives={consulta.dados} />}
      </ResultadoConsulta>
    </>
  );
}

function ListaLives({ lives }: { lives: LiveDto[] }) {
  const { t, idioma } = useI18n();
  const [temporada, setTemporada] = useState<string>(TODAS);
  const [vencedor, setVencedor] = useState<string>(TODAS);
  const [recentesPrimeiro, setRecentesPrimeiro] = useState(true);

  const temporadas = useMemo(
    () =>
      unicos(lives.map((l) => l.temporada).filter((v): v is number => v !== null && v !== undefined)).sort(
        (a, b) => b - a,
      ),
    [lives],
  );

  const vencedores = useMemo(
    () =>
      unicos(lives.map((l) => l.vencedor_nome?.trim()).filter((v): v is string => !!v)).sort((a, b) =>
        compararNome(a, b, idioma),
      ),
    [lives, idioma],
  );

  const filtradas = useMemo(() => {
    const base = lives.filter((live) => {
      const okTemporada = temporada === TODAS || String(live.temporada) === temporada;
      const okVencedor = vencedor === TODAS || (live.vencedor_nome?.trim() ?? '') === vencedor;
      return okTemporada && okVencedor;
    });
    return ordenarPorData(base, dataDa, recentesPrimeiro);
  }, [lives, temporada, vencedor, recentesPrimeiro]);

  return (
    <div className="pilha">
      <div className="barra-filtros">
        <div className="campo">
          <label className="campo__rotulo" htmlFor="filtro-temporada">
            {t('lives.filtro.temporada')}
          </label>
          <select
            id="filtro-temporada"
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
        <div className="campo">
          <label className="campo__rotulo" htmlFor="filtro-vencedor">
            {t('lives.filtro.vencedor')}
          </label>
          <select
            id="filtro-vencedor"
            className="select"
            value={vencedor}
            onChange={(evento) => setVencedor(evento.target.value)}
          >
            <option value={TODAS}>{t('comum.todos')}</option>
            {vencedores.map((nome) => (
              <option key={nome} value={nome}>
                {nome}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label className="campo__rotulo" htmlFor="ordenar-lives">
            {t('lives.ordem.rotulo')}
          </label>
          <select
            id="ordenar-lives"
            className="select"
            value={recentesPrimeiro ? 'recentes' : 'antigas'}
            onChange={(evento) => setRecentesPrimeiro(evento.target.value === 'recentes')}
          >
            <option value="recentes">{t('lives.ordem.recentes')}</option>
            <option value="antigas">{t('lives.ordem.antigas')}</option>
          </select>
        </div>
      </div>

      <Aviso>{t('lives.limitacao')}</Aviso>

      <Cartao>
        {filtradas.length === 0 ? (
          <EstadoVazio titulo={t('lives.vazio.titulo')} texto={t('lives.vazio.texto')} />
        ) : (
          <div className="tabela-scroll">
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">{t('lives.col.data')}</th>
                  <th scope="col">{t('lives.col.temporada')}</th>
                  <th scope="col">{t('lives.col.vencedor')}</th>
                  <th scope="col" className="num">
                    {t('lives.col.pontosVencedor')}
                  </th>
                  <th scope="col">{t('lives.col.transmissao')}</th>
                  <th scope="col">{t('comum.detalhes')}</th>
                </tr>
              </thead>
              <tbody>
                {filtradas.map((live) => {
                  const url = urlValida(live.url_live);
                  const id = comoTexto(live.sessao_id);
                  return (
                    <tr key={id}>
                      <td>{formatarData(dataDa(live), idioma, true)}</td>
                      <td>{formatarTemporada(live.temporada)}</td>
                      <td>{live.vencedor_nome?.trim() || t('comum.naoInformado')}</td>
                      <td className="num destaque">{formatarNumero(live.vencedor_pontos, idioma)}</td>
                      <td>
                        {url ? (
                          <a className="link linha" href={url} target="_blank" rel="noopener noreferrer" style={{ gap: 5 }}>
                            <ExternalLink size={14} aria-hidden="true" />
                            {t('lives.assistir')}
                          </a>
                        ) : (
                          <span className="card__descricao">{t('lives.semLink')}</span>
                        )}
                      </td>
                      <td>
                        <Link className="link" to={`/lives/${encodeURIComponent(id)}`}>
                          {t('comum.verDetalhes')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
    </div>
  );
}
