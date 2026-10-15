import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useI18n } from '../i18n';

export interface DadoBarra {
  nome: string;
  valor: number;
}

interface Props {
  itens: DadoBarra[];
  ariaLabel: string;
  cor?: string;
  formatarValor?: (valor: number) => string;
}

const CORES = [
  'var(--grafico-1)',
  'var(--grafico-2)',
  'var(--grafico-3)',
  'var(--grafico-4)',
  'var(--grafico-5)',
  'var(--grafico-6)',
  'var(--grafico-7)',
  'var(--grafico-8)',
];

/**
 * Gráfico de barras horizontais com alternativa tabular acessível.
 * A tabela alternativa garante leitura por leitores de tela e em telas
 * estreitas, sem depender do SVG.
 */
export function GraficoBarras({ itens, ariaLabel, cor, formatarValor }: Props) {
  const { t } = useI18n();
  const formatar = formatarValor ?? ((v: number) => String(v));

  if (itens.length === 0) return null;

  return (
    <div>
      <div className="grafico" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={itens} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
            <XAxis
              type="number"
              allowDecimals={false}
              stroke="var(--texto-fraco)"
              tick={{ fill: 'var(--texto-fraco)', fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="nome"
              width={132}
              stroke="var(--texto-fraco)"
              tick={{ fill: 'var(--texto-dim)', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: 'rgba(56, 169, 255, 0.08)' }}
              contentStyle={{
                background: 'var(--surface-2)',
                border: '1px solid var(--border-forte)',
                borderRadius: 10,
                color: 'var(--texto)',
              }}
              labelStyle={{ color: 'var(--texto-dim)' }}
              formatter={(valor: number) => [formatar(valor), t('comum.total')]}
            />
            <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
              {itens.map((item, indice) => (
                <Cell key={item.nome} fill={cor ?? CORES[indice % CORES.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <details className="grafico-alternativa">
        <summary className="link">{t('comum.detalhes')}</summary>
        <div className="tabela-scroll">
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">{t('comum.nome')}</th>
                <th scope="col" className="num">
                  {t('comum.total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {itens.map((item) => (
                <tr key={item.nome}>
                  <td>{item.nome}</td>
                  <td className="num">{formatar(item.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
