interface Props {
  altura?: number | string;
  largura?: number | string;
}

export function Esqueleto({ altura = 16, largura = '100%' }: Props) {
  return (
    <span
      className="esqueleto"
      style={{ display: 'block', height: altura, width: largura }}
      aria-hidden="true"
    />
  );
}

export function ListaEsqueleto({ linhas = 5 }: { linhas?: number }) {
  return (
    <div className="lista-esqueleto" aria-hidden="true">
      {Array.from({ length: linhas }, (_, i) => (
        <Esqueleto key={i} altura={44} />
      ))}
    </div>
  );
}
