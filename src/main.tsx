import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ProvedorI18n } from './i18n';
import './styles/tokens.css';
import './styles/global.css';

const elemento = document.getElementById('root');
if (!elemento) {
  throw new Error('Elemento #root não encontrado no index.html.');
}

createRoot(elemento).render(
  <StrictMode>
    <ProvedorI18n>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <App />
      </BrowserRouter>
    </ProvedorI18n>
  </StrictMode>,
);
