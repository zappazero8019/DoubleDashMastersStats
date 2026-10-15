import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useI18n } from '../i18n';
import type { ChaveTraducao } from '../i18n';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { ListaEsqueleto } from './Esqueleto';

// Rota → chave de tradução usada como título da aba. Rotas de detalhe usam
// prefixo com barra no fim; demais exigem correspondência exata.
const TITULO_POR_ROTA: { prefixo: string; chave: ChaveTraducao }[] = [
  { prefixo: '/jogadores/', chave: 'jogador.titulo' },
  { prefixo: '/jogadores', chave: 'jogadores.titulo' },
  { prefixo: '/campeonato', chave: 'campeonato.titulo' },
  { prefixo: '/lives/', chave: 'live.detalhe.titulo' },
  { prefixo: '/lives', chave: 'lives.titulo' },
  { prefixo: '/itens', chave: 'itens.titulo' },
  { prefixo: '/estatisticas', chave: 'estatisticas.titulo' },
];

/** Chave do título da aba para o caminho atual (404 como fallback). */
function chaveTituloDaRota(pathname: string): ChaveTraducao {
  if (pathname === '/' || pathname === '') return 'inicio.titulo';
  const achado = TITULO_POR_ROTA.find(({ prefixo }) =>
    prefixo.endsWith('/') ? pathname.startsWith(prefixo) : pathname === prefixo,
  );
  return achado?.chave ?? 'naoEncontrado.titulo';
}

export function Layout() {
  const { t } = useI18n();
  const [menuAberto, setMenuAberto] = useState(false);
  const local = useLocation();

  // Título da aba reflete a rota atual e o idioma escolhido.
  useEffect(() => {
    document.title = `${t(chaveTituloDaRota(local.pathname))} · ${t('app.nome')}`;
  }, [local.pathname, t]);

  // Fecha o menu ao trocar de rota.
  useEffect(() => {
    setMenuAberto(false);
  }, [local.pathname]);

  // Fecha o menu com Esc.
  useEffect(() => {
    if (!menuAberto) return;
    const aoTeclar = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setMenuAberto(false);
    };
    window.addEventListener('keydown', aoTeclar);
    return () => window.removeEventListener('keydown', aoTeclar);
  }, [menuAberto]);

  return (
    <div className={`app${menuAberto ? ' app--menu-aberto' : ''}`}>
      <Sidebar aoNavegar={() => setMenuAberto(false)} />
      <button
        type="button"
        className="overlay"
        aria-label={t('nav.fecharMenu')}
        onClick={() => setMenuAberto(false)}
      />
      <div className="principal">
        <Topbar aoAbrirMenu={() => setMenuAberto(true)} />
        <main className="conteudo">
          <Suspense fallback={<ListaEsqueleto linhas={4} />}>
            <Outlet />
          </Suspense>
        </main>
        <footer className="rodape">{t('rodape.nota')}</footer>
      </div>
    </div>
  );
}
