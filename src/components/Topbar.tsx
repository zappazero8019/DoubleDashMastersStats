import { Menu } from 'lucide-react';
import { useI18n } from '../i18n';
import { SeletorIdioma } from './SeletorIdioma';

interface Props {
  aoAbrirMenu: () => void;
}

export function Topbar({ aoAbrirMenu }: Props) {
  const { t } = useI18n();

  return (
    <header className="topbar">
      <button
        type="button"
        className="botao-menu"
        onClick={aoAbrirMenu}
        aria-label={t('nav.abrirMenu')}
      >
        <Menu size={20} />
      </button>
      <span className="topbar__titulo">{t('app.nome')}</span>
      <div className="topbar__acoes">
        <SeletorIdioma />
      </div>
    </header>
  );
}
