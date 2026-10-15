import { useMemo, useState } from 'react';
import { Package, Search } from 'lucide-react';
import { useI18n } from '../i18n';
import type { ChaveTraducao } from '../i18n';
import { useRecurso } from '../hooks/useRecurso';
import { obterItens } from '../api/recursos';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { CarimboAtualizacao } from '../components/CarimboAtualizacao';
import { Cartao } from '../components/Cartao';
import { Aviso } from '../components/Aviso';
import { Badge } from '../components/Badge';
import { EstadoVazio } from '../components/EstadoVazio';
import { ResultadoConsulta } from '../components/ResultadoConsulta';
import { ListaEsqueleto } from '../components/Esqueleto';
import { GraficoBarras } from '../components/GraficoBarras';
import { formatarNumero, formatarTemporada } from '../utils/formatar';
import { compararNome } from '../utils/ordenar';
import type { ItemContagemDto } from '../types/api';

const TODAS = 'todas';

function rotuloClasse(classe: string | null, t: (c: ChaveTraducao) => string): string {
  if (classe === 'relampago') return t('itens.classe.relampago');
  if (classe === 'casco_azul') return t('itens.classe.cascoAzul');
  if (!classe) return t('itens.classe.semClasse');
  return classe;
}

export function Itens() {
  const { t } = useI18n();
  const consulta = useRecurso<ItemContagemDto[]>('itens', (sinal) => obterItens({ sinal, limite: 500 }));

  return (
    <>
      <CabecalhoPagina
        kicker={t('app.marca.subtitulo')}
        titulo={t('itens.titulo')}
        subtitulo={t('itens.subtitulo')}
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
            titulo={t('itens.vazio.titulo')}
            texto={t('itens.vazio.texto')}
            icone={<Package size={24} />}
          />
        }
        esqueleto={<ListaEsqueleto linhas={6} />}
      >
        {consulta.dados && <ListaItens itens={consulta.dados} />}
      </ResultadoConsulta>
    </>
  );
}

function ListaItens({ itens }: { itens: ItemContagemDto[] }) {
  const { t, idioma } = useI18n();
  const [classe, setClasse] = useState<string>(TODAS);
  const [busca, setBusca] = useState('');

  const classes = useMemo(() => {
    const conjunto = new Set(itens.map((i) => i.classe ?? ''));
    return [...conjunto].sort();
  }, [itens]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return itens.filter((item) => {
      const okClasse = classe === TODAS || (item.classe ?? '') === classe;
      const okBusca = !termo || item.nome_item.toLowerCase().includes(termo);
      return okClasse && okBusca;
    });
  }, [itens, classe, busca]);

  const porItem = useMemo(() => {
    const mapa = new Map<string, number>();
    for (const item of filtrados) {
      mapa.set(item.nome_item, (mapa.get(item.nome_item) ?? 0) + (item.total ?? 0));
    }
    const lista = [...mapa.entries()]
      .map(([nome, valor]) => ({ nome, valor }))
      .sort((a, b) => b.valor - a.valor || compararNome(a.nome, b.nome, idioma));
    return lista;
  }, [filtrados, idioma]);

  const paraGrafico = useMemo(() => {
    if (porItem.length <= 8) return porItem;
    const top = porItem.slice(0, 8);
    const outros = porItem.slice(8).reduce((soma, item) => soma + item.valor, 0);
    return [...top, { nome: t('itens.grafico.outros'), valor: outros }];
  }, [porItem, t]);

  return (
    <div className="pilha">
      <div className="barra-filtros">
        <div className="campo" style={{ flex: 1, minWidth: 220 }}>
          <label className="campo__rotulo" htmlFor="busca-item">
            {t('itens.busca.rotulo')}
          </label>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              aria-hidden="true"
              style={{ position: 'absolute', left: 10, top: 11, color: 'var(--texto-fraco)' }}
            />
            <input
              id="busca-item"
              className="entrada"
              style={{ paddingLeft: 32, width: '100%' }}
              type="search"
              placeholder={t('itens.busca.placeholder')}
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
            />
          </div>
        </div>
        <div className="campo">
          <label className="campo__rotulo" htmlFor="filtro-classe">
            {t('itens.filtro.classe')}
          </label>
          <select
            id="filtro-classe"
            className="select"
            value={classe}
            onChange={(evento) => setClasse(evento.target.value)}
          >
            <option value={TODAS}>{t('itens.classe.todas')}</option>
            {classes.map((c) => (
              <option key={c || 'sem'} value={c}>
                {rotuloClasse(c || null, t)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <Aviso>
        {t('itens.explicacao.total')} {t('itens.explicacao.aquisicoes')}
      </Aviso>

      <Cartao titulo={t('itens.grafico.titulo')} descricao={t('itens.grafico.descricao')}>
        {paraGrafico.length > 0 ? (
          <GraficoBarras
            itens={paraGrafico}
            ariaLabel={t('itens.grafico.titulo')}
            formatarValor={(v) => formatarNumero(v, idioma)}
          />
        ) : (
          <EstadoVazio titulo={t('comum.semDados')} />
        )}
      </Cartao>

      <Cartao>
        {filtrados.length === 0 ? (
          <p className="card__descricao">{t('comum.semDados')}</p>
        ) : (
          <div className="tabela-scroll">
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">{t('itens.col.item')}</th>
                  <th scope="col">{t('itens.col.classe')}</th>
                  <th scope="col">{t('itens.col.jogador')}</th>
                  <th scope="col">{t('itens.col.temporada')}</th>
                  <th scope="col" className="num">
                    {t('itens.col.total')}
                  </th>
                  <th scope="col" className="num">
                    {t('itens.col.aquisicoes')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((item, indice) => (
                  <tr key={`${item.sessao_id}-${item.player_id}-${item.nome_item}-${indice}`}>
                    <td>{item.nome_item}</td>
                    <td>
                      {item.classe ? (
                        <Badge variante={item.classe === 'relampago' || item.classe === 'casco_azul' ? 'eletrico' : 'mudo'}>
                          {rotuloClasse(item.classe, t)}
                        </Badge>
                      ) : (
                        <span className="card__descricao">{t('itens.classe.semClasse')}</span>
                      )}
                    </td>
                    <td>{item.nome?.trim() || t('comum.naoInformado')}</td>
                    <td>{formatarTemporada(item.temporada)}</td>
                    <td className="num">{formatarNumero(item.total, idioma)}</td>
                    <td className="num">{formatarNumero(item.aquisicoes, idioma)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>
    </div>
  );
}
