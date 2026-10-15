# Atualização do snapshot `public/dados.json`

Procedimento **somente-leitura na API** para gerar e validar o snapshot estático
consumido pelo painel no modo `VITE_FONTE_DADOS=json`. Nada aqui publica,
faz deploy, commit ou escrita na API/Supabase.

## Pré-requisitos

- Node.js 20+ (a máquina usa Node 24).
- Acesso à API pública de leitura: `https://mkddtracker-api.netlify.app`.
- No Windows, use `npm.cmd`/`node` se a ExecutionPolicy bloquear `npm` puro.

## Comandos exatos

Todos os comandos são executados na raiz do projeto.

### 1. Atualizar o snapshot (`public/dados.json`)

```powershell
node tools/atualizar-dados.mjs
# equivalent: npm run dados:atualizar
```

- Lê a API por **GET**, grava o candidato em arquivo **temporário**
  (`tools/saida/tmp/`), valida, compara com o snapshot anterior e só então
  substitui `public/dados.json`.
- Destino alternativo (não toca o arquivo real — útil para conferência):

```powershell
node tools/atualizar-dados.mjs --destino tools/saida/dados-candidato.json --relatorio tools/saida/relatorio-conferencia.json
```

- Flags: `--base <url>`, `--timeout <ms>`, `--destino <arquivo>`,
  `--relatorio <arquivo>`, `--dir-temp <pasta>`, `--forcar`.
- Variáveis: `MKDD_API_URL`, `MKDD_TIMEOUT_MS`.

### 2. Exportar sem substituir (só para inspeção)

```powershell
node tools/exportar-api.mjs --saida tools/saida/dados.json --relatorio tools/saida/relatorio-exportacao.json
# equivalent: npm run dados:exportar
```

### 3. Testes

```powershell
node --test tools/exportar-api.test.mjs tools/atualizar-dados.test.mjs
node --test tools/gerador-dados.test.mjs
# todos: npm run dados:testes
```

Testes usam `fetch` falso — **não tocam a API de produção**.

### 4. Build em modo JSON (dados estáticos)

```powershell
$env:VITE_FONTE_DADOS="json"; npm run build
# cmd.exe:  set VITE_FONTE_DADOS=json && npm run build
```

O build copia `public/dados.json` para `dist/dados.json`; o painel lê o arquivo e
**não** chama `/stats`.

### 5. Build padrão em modo API (produção)

```powershell
Remove-Item Env:VITE_FONTE_DADOS -ErrorAction SilentlyContinue
npm run build
# cmd.exe:  set VITE_FONTE_DADOS= && npm run build
```

Sem a variável, a fonte padrão continua sendo a API (`src/api/config.ts`).

### 6. Verificar diff e estado do Git

```powershell
git status --short
git diff
git check-ignore -v public/dados.json tools/saida dist
```

## O que o script valida (antes de substituir)

1. Envelope `{ok,recurso,dados}` de cada recurso e presença esperada de campos.
2. **Truncamento**: qualquer lista com 500 linhas (= limite sem paginação) reprova.
3. **Duplicidades** (sessão/jogador/item) e **inconsistências** (somas de
   itens/relâmpagos/cascos e campeonato × agregados; órfãos; subconjuntos).
4. **Metadados explícitos**: `campos_indisponiveis`, `completude`,
   `disponibilidade` e `schema`.
5. **Guarda de regressão**: recusa substituir um snapshot completo por um que
   tenha retrocedido (menos lives, `itens_totais`/`jogadores` zerados ou esquema
   trocado). Isso protege contra uma resposta parcial da API que passaria nas
   somas (ex.: tudo zerado e "consistente").
6. **Comparação** com o snapshot anterior (deltas, lives novas/removidas),
   gravada em `tools/saida/relatorio-atualizacao.json`.

Em qualquer falha, o snapshot anterior **permanece intacto**.

## Campos indisponíveis (continuam explícitos)

A API pública não expõe — e o snapshot documenta em `campos_indisponiveis`:
`tempos`, `colocacoes_por_live`, `pontuacao_por_live`, `participantes_por_live`,
`baseline`, `eventos`. Não são inventados nem aproximados.

## Recursos do painel (9)

Armazenados no snapshot: `geral`, `lives`, `campeonato`, `jogadores`, `itens`,
`relampagos`, `cascos_azuis`. Deriva­dos em tempo de leitura pelo painel a partir
destes: `live` (de `lives`) e `jogador` (de `jogadores`).

## Códigos de saída

| Código | Significado                                                        |
| ------ | ------------------------------------------------------------------ |
| `0`    | Snapshot validado e substituído.                                   |
| `2`    | Falha segura (rede/HTTP/envelope/incompletude); destino intacto.   |
| `3`    | Regressão detectada; snapshot anterior preservado (`--forcar` ignora). |

## Depois de uma live

1. Espere a live ser **finalizada** no desktop (só lives finalizadas entram).
2. Rode `npm run dados:atualizar` e confira o relatório
   (`tools/saida/relatorio-atualizacao.json`): a nova `sessao_id` deve aparecer
   em `comparacao.lives_novas`.
3. Rode os testes e o build em modo JSON; confira as 9 rotas localmente
   (`npm run preview`).
4. A publicação é **manual** (ver abaixo).

## Publicação (manual, não automática)

- Nenhum script deste repositório faz deploy. O `netlify.toml` só descreve o
  build para a Netlify rodar **quando você decidir** publicar.
- O fluxo de atualização **não** chama `netlify deploy` nem `git push`.
- Publicar (quando aprovado) exige ação explícita: `git add`/`commit`/`push` e,
  se for o caso, `netlify deploy`. `public/dados.json` está no `.gitignore`,
  então **não** entra em commits por padrão; incluir o snapshot no deploy é uma
  decisão manual e consciente.

## Rollback

O snapshot anterior é substituído atomicamente. Para voltar um nível, restaure o
arquivo a partir do Git/backup local ou rode `git checkout -- <arquivo>` quando
ele estiver versionado. Para reverter uma publicação, use o rollback da Netlify
na interface web.
