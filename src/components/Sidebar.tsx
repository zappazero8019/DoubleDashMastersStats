import { NavLink } from 'react-router-dom';
import { BarChart3, Gauge, Package, Trophy, Tv, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useI18n } from '../i18n';
import type { ChaveTraducao } from '../i18n';

interface ItemNav {
  para: string;
  chave: ChaveTraducao;
  icone: LucideIcon;
}

const ITENS: ItemNav[] = [
  { para: '/', chave: 'nav.inicio', icone: Gauge },
  { para: '/jogadores', chave: 'nav.jogadores', icone: Users },
  { para: '/campeonato', chave: 'nav.campeonato', icone: Trophy },
  { para: '/lives', chave: 'nav.lives', icone: Tv },
  { para: '/itens', chave: 'nav.itens', icone: Package },
  { para: '/estatisticas', chave: 'nav.estatisticas', icone: BarChart3 },
];

interface Props {
  aoNavegar?: () => void;
}

export function Sidebar({ aoNavegar }: Props) {
  const { t } = useI18n();

  return (
    <aside className="sidebar" aria-label={t('nav.principal')}>
      <div className="marca">
        <span className="marca__logo" aria-hidden="true">
          <Gauge size={22} />
        </span>
        <span>
          <span className="marca__titulo">{t('app.marca.titulo')}</span>
          <br />
          <span className="marca__subtitulo">{t('app.marca.subtitulo')}</span>
        </span>
      </div>

      <nav className="nav">
        {ITENS.map(({ para, chave, icone: Icone }) => (
          <NavLink
            key={para}
            to={para}
            end={para === '/'}
            onClick={aoNavegar}
            className={({ isActive }) => `nav-item${isActive ? ' nav-item--ativo' : ''}`}
          >
            <Icone size={18} aria-hidden="true" />
            {t(chave)}
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__rodape">{t('app.descricao')}</div>
    </aside>
  );
}
