# Publicação estática — preparar (local) × publicar (manual)

Este documento descreve **duas coisas separadas**:

1. **Preparação local do artefato** — feita por este repositório, com
   `npm run site:preparar` (`tools/preparar-publicacao.mjs`). Gera e valida o
   artefato `dist/` em modo `VITE_FONTE_DADOS=json`. **Não publica nada.**
2. **Publicação real** — ação **manual** do operador, descrita no fim deste
   documento. Este repositório **não** contém comando de deploy.

> Decisão de arquitetura (provisória): o snapshot `public/dados.json` continua
> **ignorado pelo Git** (`.gitignore:54`). O snapshot real só existe no disco
> local e no artefato `dist/` — nunca em commits.

Alvo de publicação preparado: **GitHub Pages**, servido num **subdiretório**
(`https://<usuário>.github.io/DoubleDashMastersStats/`). Por isso o build usa
`base: '/DoubleDashMastersStats/'` (`vite.config.ts`) e o artefato inclui
`404.html` e `.nojekyll`. O site do **Netlify é separado** e **não é tocado**
por este repositório.

## Pré-requisitos

- Node.js 20+ (a máquina usa Node 24).
- Acesso à API pública de leitura: `https://mkddtracker-api.netlify.app`.
- No Windows, use `npm.cmd` se a ExecutionPolicy bloquear `npm`.

## Pipeline (`npm run site:preparar`)

1. **Gera** o snapshot com `npm run dados:atualizar` (somente **GET** na API).
2. **Valida** o snapshot (`verificarMetadados` + `completude.completo`).
3. **Gate de aprovação**: sem `--aprovar`, para e mostra o resumo (código 4).
4. **Constrói** com `VITE_FONTE_DADOS=json npm run build`.
5. **Verifica** que `dist/dados.json` existe e é **idêntico byte a byte** ao
   snapshot validado (SHA-256).
6. **Verifica** que o bundle referencia o `dados.json` **no caminho-base**
   efetivo (ex.: `/DoubleDashMastersStats/dados.json`) e **não** referencia
   `/stats`. O base é **derivado do próprio `dist/index.html`**, não presumido.
7. **Gera e verifica** os arquivos exigidos pelo GitHub Pages:
   - `dist/.nojekyll` (vazio) — impede o processamento Jekyll;
   - `dist/404.html` — fallback de rotas SPA do React Router, **cópia idêntica
     de `dist/index.html`**.
8. **Preserva** o artefato (`dist/`) e grava o relatório de preparação.

Qualquer falha interrompe o processo; **nada é publicado**.

## Comandos exatos

Na raiz do projeto:

```powershell
# 1) Gera + valida e PARA para revisão (não constrói)
npm.cmd run site:preparar

# 2) Revisado o relatório, gera + valida + constrói + verifica
npm.cmd run site:preparar -- --aprovar

# 3) Alternativa: reutilizar o snapshot já validado (sem nova chamada à API)
npm.cmd run site:preparar -- --sem-gerar --aprovar

# 4) Se o subdiretório de publicação mudar, informe o base explicitamente
npm.cmd run site:preparar -- --sem-gerar --aprovar --base /OutroBase/
```

Flags: `--aprovar`, `--sem-gerar`, `--destino <arquivo>`, `--dist <pasta>`,
`--relatorio <arquivo>`, `--base <caminho>` (padrão `/DoubleDashMastersStats/`,
mas o valor efetivo é sempre derivado do `index.html` gerado).

## Artefato gerado (`dist/`)

| Item | Papel |
| --- | --- |
| `index.html` | Entrada da SPA; assets com prefixo do base. |
| `assets/*.js`, `assets/*.css` | Bundle compilado (modo JSON). |
| `dados.json` | Snapshot validado, cópia byte a byte de `public/dados.json`. |
| `.nojekyll` | Impede o Jekyll do GitHub Pages de processar o site. |
| `404.html` | Cópia de `index.html`: fallback para qualquer rota desconhecida. |

Todos esses arquivos são **ignorados pelo Git** (`dist/` no `.gitignore`).

## Caminho-base e rotas

- O painel usa `BrowserRouter` com `basename = import.meta.env.BASE_URL`, então
  funciona sob `/DoubleDashMastersStats/`.
- O GitHub Pages **não** faz fallback de SPA para o `index.html`. Por isso o
  artefato inclui `404.html`: qualquer deep-link (ex.: `/lives/<id>`) é servido
  pelo `404.html`, que carrega o app e o router resolve a rota pela URL.
- Se o deploy **não** for num subdiretório (raiz de domínio ou domínio próprio),
  ajuste `base` em `vite.config.ts` **e** rode o pipeline com o `--base`
  correspondente.

## Códigos de saída

| Código | Significado |
| --- | --- |
| `0` | Artefato verificado em `dist/` — pronto para publicação **manual**. |
| `2` | Falha (geração/validação/build/artefato/bundle/github-pages); nada publicado. |
| `3` | Regressão na geração; snapshot anterior preservado; nada construído. |
| `4` | Aguardando aprovação explícita (`--aprovar`); nada construído. |

## Checklist manual pré-publicação

- [ ] `npm run site:preparar` retornou **4** e o resumo bate com o esperado
      (deltas de `lives_finalizadas`/`itens_totais`/`jogadores`).
- [ ] O snapshot **não** contém segredos (o exportador audita chaves proibidas).
- [ ] `npm run site:preparar -- --aprovar` retornou **0**.
- [ ] `tools/saida/relatorio-publicacao.json` tem `"status": "ok"` e
      `"publicado": false`.
- [ ] `dist/dados.json` (SHA-256 no relatório) confere com `public/dados.json`.
- [ ] O bundle referencia `dados.json` no base e tem `"ocorrenciasStats": 0`.
- [ ] Existem `dist/.nojekyll` e `dist/404.html` (verificado pelo pipeline).
- [ ] `dist/404.html` é idêntico a `dist/index.html`.
- [ ] Inspeção visual opcional: `npm run preview` e conferir as 9 rotas.
- [ ] Publicação feita **manualmente** (ver abaixo), nunca por script deste repo.

## Publicação no GitHub Pages (manual — fora deste repositório)

Escolha **uma** estratégia e execute-a **manualmente** (o repositório não tem
comando de deploy):

- **Branch de publicação (`gh-pages`)** — publique o conteúdo de `dist/` na
  branch que serve o GitHub Pages (raiz do site do projeto). Ex.:
  ```powershell
  # Ação MANUAL do operador (não faz parte dos scripts do repo):
  npx gh-pages -d dist
  ```
- **GitHub Actions** — um workflow que rode `npm ci`,
  `npm run site:preparar -- --sem-gerar --aprovar` (exige o snapshot
  disponível no runner) e publique `dist/`.
- **Upload manual** — arraste/comite o conteúdo de `dist/` na branch de
  publicação.

Requisitos: o repositório **precisa** se chamar `DoubleDashMastersStats` (para
casar com o `base`), e o GitHub Pages deve servir a branch/pasta correta.

## Publicação no Netlify (manual — site separado, NÃO alterado por este repo)

O site Netlify é um projeto **separado** e **não é afetado** por este
repositório nem por este pipeline. Se, ainda assim, for publicado por lá:

- Como `public/dados.json` **não** está no Git, o build automático da Netlify
  (`npm run build`, modo API) **não** terá o snapshot.
- **Preferir** publicar o artefato local `dist/` via `netlify deploy --dir dist`
  ou drag-and-drop, em vez do build por Git.
- O `netlify.toml` deste repositório (redirect SPA `/*` → `/index.html`) **não
  deve ser alterado** enquanto a decisão for publicar no GitHub Pages.

## Limitações de usar um snapshot estático

- **Desatualização**: o site reflete o snapshot até que um novo pipeline seja
  rodado e publicado. Não há atualização ao vivo (o modo API tem).
- **Dados incompletos por origem**: `campos_indisponiveis` lista o que a API
  pública não expõe (`tempos`, `colocacoes_por_live`, `pontuacao_por_live`,
  `participantes_por_live`, `baseline`, `eventos`). O painel mostra "—".
- **Uma live em andamento no snapshot**: `lives_em_andamento` fica congelado.
- **Segurança do snapshot**: são dados públicos, mas continuam sendo dados
  reais — por isso nunca são versionados.
- **`404.html` devolve HTTP 404**: é o comportamento nativo do GitHub Pages para
  rotas desconhecidas; o app carrega normalmente. Isso é esperado para uma SPA
  estática.

## Rollback

- **Artefato local**: o snapshot anterior é substituído atomicamente pelo
  `dados:atualizar`. Para voltar, restaure `public/dados.json` de um backup e
  rode `npm run site:preparar -- --sem-gerar --aprovar`.
- **GitHub Pages**: reenvie o artefato anterior (a publicação é manual e cada
  envio sobrescreve o anterior).
- **Netlify**: use o rollback da Netlify na interface web (não afetado por este
  repositório).
