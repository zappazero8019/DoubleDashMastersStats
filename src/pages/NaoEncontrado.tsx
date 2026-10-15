import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { useI18n } from '../i18n';
import { CabecalhoPagina } from '../components/CabecalhoPagina';
import { EstadoVazio } from '../components/EstadoVazio';

export function NaoEncontrado() {
  const { t } = useI18n();

  return (
    <>
      <CabecalhoPagina
        kicker={t('app.marca.subtitulo')}
        titulo={t('naoEncontrado.titulo')}
      />
      <EstadoVazio
        titulo={t('naoEncontrado.titulo')}
        texto={t('naoEncontrado.texto')}
        icone={<Compass size={24} />}
      />
      <p style={{ marginTop: 18 }}>
        <Link className="botao botao--neon" to="/">
          {t('naoEncontrado.acao')}
        </Link>
      </p>
    </>
  );
}
