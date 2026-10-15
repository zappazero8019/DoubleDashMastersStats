import { lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';

// Carregamento sob demanda: cada rota vira um chunk próprio, o que mantém o
// pacote inicial leve (as páginas com gráficos só baixam o Recharts quando
// abertas).
const Inicio = lazy(() => import('./pages/Inicio').then((m) => ({ default: m.Inicio })));
const Jogadores = lazy(() => import('./pages/Jogadores').then((m) => ({ default: m.Jogadores })));
const JogadorDetalhe = lazy(() =>
  import('./pages/JogadorDetalhe').then((m) => ({ default: m.JogadorDetalhe })),
);
const Campeonato = lazy(() =>
  import('./pages/Campeonato').then((m) => ({ default: m.Campeonato })),
);
const Lives = lazy(() => import('./pages/Lives').then((m) => ({ default: m.Lives })));
const LiveDetalhe = lazy(() =>
  import('./pages/LiveDetalhe').then((m) => ({ default: m.LiveDetalhe })),
);
const Itens = lazy(() => import('./pages/Itens').then((m) => ({ default: m.Itens })));
const Estatisticas = lazy(() =>
  import('./pages/Estatisticas').then((m) => ({ default: m.Estatisticas })),
);
const NaoEncontrado = lazy(() =>
  import('./pages/NaoEncontrado').then((m) => ({ default: m.NaoEncontrado })),
);

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Inicio />} />
        <Route path="jogadores" element={<Jogadores />} />
        <Route path="jogadores/:playerId" element={<JogadorDetalhe />} />
        <Route path="campeonato" element={<Campeonato />} />
        <Route path="lives" element={<Lives />} />
        <Route path="lives/:liveId" element={<LiveDetalhe />} />
        <Route path="itens" element={<Itens />} />
        <Route path="estatisticas" element={<Estatisticas />} />
        <Route path="*" element={<NaoEncontrado />} />
      </Route>
    </Routes>
  );
}
