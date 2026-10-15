import { useI18n } from '../i18n';
import { IDIOMAS } from '../i18n';

export function SeletorIdioma() {
  const { idioma, definirIdioma, t } = useI18n();

  return (
    <div className="seletor-idioma" role="group" aria-label={t('comum.idioma')}>
      {IDIOMAS.map((opcao) => (
        <button
          key={opcao.id}
          type="button"
          aria-pressed={idioma === opcao.id}
          title={opcao.rotulo}
          onClick={() => definirIdioma(opcao.id)}
        >
          {opcao.curto}
        </button>
      ))}
    </div>
  );
}
