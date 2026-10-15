# Double Dash Masters — Painel de Estatísticas

Painel público de estatísticas do canal **Double Dash Masters** (Mario Kart:
Double Dash!!). Aplicação **React + Vite + TypeScript**, bilíngue (pt-BR / en),
tema escuro de e-sports, que consome **somente leitura** a API pública
`mkddtracker-api`.

## Princípios

- **Somente leitura.** O painel nunca envia dados: apenas consulta `GET /stats`.
- **Sem credenciais no frontend.** A API é pública e libera CORS. Não há token,
  chave ou segredo em nenhum lugar do código.
- **Sem dados inventados.** Quando um recurso está vazio ou não é exposto pela
  API, a interface mostra o estado vazio real e explica a limitação — nunca
  preenche com valores fictícios.

## API consumida

Fonte única da URL base: `src/api/config.ts` (`API_BASE_URL`, trocável via
`VITE_API_BASE_URL` em tempo de build).

`GET {API_BASE_URL}/stats?recurso=...` → `{ ok, recurso, dados: [...] }`.

| Recurso        | Uso no painel                                  |
| -------------- | ---------------------------------------------- |
| `geral`        | KPIs da visão geral                            |
| `lives`        | lista de lives finalizadas                     |
| `live`         | detalhe de uma live (`sessao_id`)              |
| `campeonato`   | classificação por vitórias (`ano` opcional)    |
| `jogadores`    | agregados por jogador                          |
| `jogador`      | perfil de um jogador (`player_id`)             |
| `itens`        | contagem de todos os itens                     |
| `relampagos`   | itens da classe relâmpago                      |
| `cascos_azuis` | itens da classe casco azul                     |

### Limitações conhecidas da API

- Não há recurso público de **tempos** (`vw_tempos`).
- A lista de **participantes** de uma live e a **pontuação individual** por
  live não são expostas — apenas o vencedor e seus pontos.
- Não há **pontos por temporada**: `jogadores.pontos_totais_live` soma todas as
  lives finalizadas. Na página de campeonato os pontos só são exibidos quando
  a seleção cobre uma única temporada (ou «todas as temporadas»); com mais de
  uma temporada, a coluna fica «—» e a limitação é mostrada ao usuário.
- Essas limitações aparecem de forma explícita ao usuário nas telas
  correspondentes.

## Rotas

| Rota                    | Tela                      |
| ----------------------- | ------------------------- |
| `/`                     | Visão geral               |
| `/jogadores`            | Lista de jogadores        |
| `/jogadores/:playerId`  | Perfil do jogador         |
| `/campeonato`           | Campeonato anual          |
| `/lives`                | Histórico de lives        |
| `/lives/:liveId`        | Detalhe da live           |
| `/itens`                | Estatísticas de itens     |
| `/estatisticas`         | Relâmpagos e cascos azuis |
| `*`                     | Página não encontrada     |

## Scripts

```bash
npm install       # instala as dependências
npm run dev       # servidor de desenvolvimento (http://localhost:5173)
npm run build     # tsc --noEmit + vite build  (saída em dist/)
npm run preview   # pré-visualiza o build
npm run typecheck  # tsc --noEmit
npm run lint      # ESLint
npm run dados:testes    # testes das ferramentas de dados (node --test)
npm run site:preparar   # prepara o artefato estático para publicação (local)
```

## Estrutura

```
src/
  api/         cliente HTTP, URL base e adaptadores tipados por recurso
  components/  layout (Sidebar, Topbar, Layout) e blocos de UI reutilizáveis
  hooks/       useRecurso: carregamento, erro, vazio e "atualizado em"
  i18n/        dicionários pt-BR / en e o provedor de idioma
  pages/       uma página por rota
  styles/      tokens de tema e estilos globais
  types/       DTOs da API
  utils/       formatação, ordenação e agregações
```

## Idioma

- Padrão **pt-BR**; a escolha fica salva em `localStorage` (`ddm.idioma`).
- `src/i18n/pt-BR.ts` é a fonte da verdade das chaves; `en.ts` é obrigado em
  tempo de compilação a cobrir todas elas.

## Publicação

Alvo preparado: **GitHub Pages**, servido num **subdiretório**
(`https://<usuário>.github.io/DoubleDashMastersStats/`). Por isso o build usa
`base: '/DoubleDashMastersStats/'` (`vite.config.ts`) e o roteador usa esse
`basename`.

O artefato local é preparado por `npm run site:preparar` (ver
`tools/PUBLICAR-ESTATICO.md`). O pipeline gera em `dist/`, além do site:

- `dist/404.html` — fallback de rotas SPA do React Router (cópia de
  `index.html`), necessário porque o GitHub Pages não faz fallback sozinho;
- `dist/.nojekyll` — impede o processamento Jekyll.

A **publicação é uma ação manual** (o repositório não contém deploy). O
`netlify.toml` (redirect SPA `/*` → `/index.html`) pertence a um site Netlify
**separado** e não é usado/alterado por este fluxo.

## Acessibilidade

- Navegação por teclado, `:focus-visible` visível e menu mobile fechável com Esc.
- Gráficos possuem alternativa tabular acessível.
- Respeita `prefers-reduced-motion`.
