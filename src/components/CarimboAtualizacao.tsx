import { Clock } from 'lucide-react';
import { useI18n } from '../i18n';
import { formatarHora } from '../utils/formatar';

interface Props {
  atualizadoEm: Date | null;
  carregando: boolean;
}

export function CarimboAtualizacao({ atualizadoEm, carregando }: Props) {
  const { t, idioma } = useI18n();

  return (
    <span className="carimbo-atualizacao" aria-live="polite">
      <Clock size={13} aria-hidden="true" />
      {carregando ? t('comum.atualizando') : `${t('comum.atualizadoEm')} ${formatarHora(atualizadoEm, idioma)}`}
    </span>
  );
}
