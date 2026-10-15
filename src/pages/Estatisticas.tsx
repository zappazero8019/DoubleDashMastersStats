import { Shell, Zap } from 'lucide-react';
import { useI18n } from '../i18n';
import { useRecurso } from '../hooks/useRecurso';
import { obterCascosAzuis, obterRelampagos } from '../api/recursos';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { CarimboAtualizacao } from '../components/CarimboAtualizacao';
import { Cartao } from '../components/Cartao';
import { Aviso } from '../components/Aviso';
import { EstadoVazio } from '../components/EstadoVazio';
import { ResultadoConsulta } from '../components/ResultadoConsulta';
import { ListaEsqueleto } from '../components/Esqueleto';
import { GraficoBarras } from '../components/GraficoBarras';
import { agregarItensPorJogador } from '../utils/agregacoes';
import type { LinhaItens } from '../utils/agregacoes';
import { formatarNumero } from '../utils/formatar';
import { ordenarPorNumeroDesc } from '../utils/ordenar';
import type { ItemContagemDto } from '../types/api';

interface DadosEstatisticas {
  relampagos: ItemContagemDto[];
  cascosAzuis: ItemContagemDto[];
}

export function Estatisticas() {
  const { t } = useI18n();
  const consulta = useRecurso<DadosEstatisticas>('estatisticas', async (sinal) => {
    const [relampagos, cascosAzuis] = await Promise.all([
      obterRelampagos({ sinal, limite: 500 }),
      obterCascosAzuis({ sinal, limite: 500 }),
    ]);
    return { relampagos, cascosAzuis };
  });

  return (
    <>
      <CabecalhoPagina
        kicker={t('app.marca.subtitulo')}
        titulo={t('estatisticas.titulo')}
        subtitulo={t('estatisticas.subtitulo')}
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
        esqueleto={<ListaEsqueleto linhas={6} />}
      >
        {consulta.dados && <Conteudo dados={consulta.dados} />}
      </ResultadoConsulta>
    </>
  );
}

function Conteudo({ dados }: { dados: DadosEstatisticas }) {
  const { t } = useI18n();
  const semDados = dados.relampagos.length === 0 && dados.cascosAzuis.length === 0;

  return (
    <div className="pilha">
      {semDados ? (
        <EstadoVazio titulo={t('estatisticas.vazio.titulo')} texto={t('estatisticas.vazio.texto')} />
      ) : (
        <div className="grade grade--2">
          <SecaoEspecial
            titulo={t('estatisticas.relampagos.titulo')}
            descricao={t('estatisticas.relampagos.descricao')}
            itens={dados.relampagos}
            cor="var(--grafico-1)"
            icone="relampago"
          />
          <SecaoEspecial
            titulo={t('estatisticas.cascos.titulo')}
            descricao={t('estatisticas.cascos.descricao')}
            itens={dados.cascosAzuis}
            cor="var(--grafico-2)"
            icone="casco"
          />
        </div>
      )}

      <Aviso titulo={t('estatisticas.limitacao.titulo')}>{t('estatisticas.limitacao.texto')}</Aviso>
    </div>
  );
}

function SecaoEspecial({
  titulo,
  descricao,
  itens,
  cor,
  icone,
}: {
  titulo: string;
  descricao: string;
  itens: ItemContagemDto[];
  cor: string;
  icone: 'relampago' | 'casco';
}) {
  const { t, idioma } = useI18n();
  const total = itens.reduce((soma, item) => soma + (item.total ?? 0), 0);
  const porJogador: LinhaItens[] = ordenarPorNumeroDesc(
    agregarItensPorJogador(itens),
    (l) => l.total,
    (l) => l.nome,
    idioma,
  );
  const Icone = icone === 'relampago' ? Zap : Shell;

  return (
    <div className="pilha">
      <Cartao
        titulo={
          <span className="linha" style={{ gap: 8 }}>
            <Icone size={16} aria-hidden="true" /> {titulo}
          </span>
        }
        descricao={descricao}
      >
        <p className="kpi__rotulo">{t('estatisticas.total.rotulo')}</p>
        <p className="kpi__valor" style={{ marginBottom: 14 }}>
          {formatarNumero(total, idioma)}
        </p>
        {porJogador.length > 0 ? (
          <GraficoBarras
            itens={porJogador.map((l) => ({ nome: l.nome, valor: l.total }))}
            ariaLabel={titulo}
            cor={cor}
            formatarValor={(v) => formatarNumero(v, idioma)}
          />
        ) : (
          <EstadoVazio titulo={t('comum.semDados')} />
        )}
      </Cartao>

      <Cartao>
        {porJogador.length === 0 ? (
          <p className="card__descricao">{t('comum.semDados')}</p>
        ) : (
          <div className="tabela-scroll">
            <table className="tabela">
              <thead>
                <tr>
                  <th scope="col">{t('estatisticas.col.jogador')}</th>
                  <th scope="col" className="num">
                    {t('estatisticas.col.total')}
                  </th>
                  <th scope="col" className="num">
                    {t('estatisticas.col.aquisicoes')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {porJogador.map((linha) => (
                  <tr key={linha.nome}>
                    <td>{linha.nome}</td>
                    <td className="num destaque">{formatarNumero(linha.total, idioma)}</td>
                    <td className="num">{formatarNumero(linha.aquisicoes, idioma)}</td>
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
