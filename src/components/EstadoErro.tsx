import { AlertTriangle, RotateCw } from 'lucide-react';
import { useI18n } from '../i18n';
import type { ChaveTraducao } from '../i18n';
import type { ErroApi } from '../api/client';

const CHAVE_POR_CODIGO: Record<string, ChaveTraducao> = {
  rede: 'erro.rede',
  timeout: 'erro.timeout',
  http: 'erro.http',
  resposta: 'erro.resposta',
};

interface Props {
  erro: ErroApi | null;
  aoTentarNovamente: () => void;
}

export function EstadoErro({ erro, aoTentarNovamente }: Props) {
  const { t } = useI18n();
  const chave = (erro && CHAVE_POR_CODIGO[erro.codigo]) || 'comum.erro';

  return (
    <div className="estado estado--erro" role="alert">
      <div className="estado__icone" aria-hidden="true">
        <AlertTriangle size={24} />
      </div>
      <p className="estado__titulo">{t('comum.erro')}</p>
      <p className="estado__texto">
        {t(chave)}
        {erro?.status ? ` (HTTP ${erro.status})` : ''}
      </p>
      <button type="button" className="botao botao--neon" onClick={aoTentarNovamente}>
        <RotateCw size={16} />
        {t('comum.tentarNovamente')}
      </button>
    </div>
  );
}
