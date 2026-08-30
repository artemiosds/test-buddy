# Passo 1 — Análise (nenhum código alterado)

## a) Pontos que fazem upload para o Supabase Storage (dentro do escopo)

| Onde | Arquivo : linha | O que envia |
|---|---|---|
| Anexos de folha (linha e submissão) — usado por Efetivos, Contratados e Aprovações | `src/components/frequencias/anexos-entidade.tsx:169-172` | `supabase.storage.from("documentos").upload(path, file)` |
| Tela de detalhe da folha (`/frequencias/$id`) | `src/routes/_authenticated/frequencias_.$id.tsx:1660` | `supabase.storage.from("documentos").upload(...)` |
| Foto do profissional | `src/routes/_authenticated/profissionais.tsx:1482-1484` (caminho montado por `src/lib/foto-profissional.ts:40`) | upload no bucket `avatars` |

Observações importantes:
- O **modal de envio para análise** e o **modal de anexos do painel de Aprovações**
  (`src/components/aprovacoes/UploadAnexoModal.tsx`) **não têm upload próprio** — ambos
  renderizam `AnexosEntidade`. Ou seja, os 4 itens do escopo passam por apenas
  **3 pontos reais de upload**.
- Não existe upload separado para "atestado/licença/afastamento": eles são anexos de
  linha (`tipo_entidade = "frequencia"`), mesmo componente.

## b) Pontos que geram leitura / URL de download

| Onde | Arquivo : linha | O que faz |
|---|---|---|
| Listagem de anexos ativos | `src/lib/listar-anexos.functions.ts:69-71` | `createSignedUrl(storage_path, 300)` |
| Listagem de anexos (linha/submissão) | `src/lib/frequencias.functions.ts:738-740` | signed URL 5 min |
| Listagem da lixeira (removidos) | `src/lib/frequencias.functions.ts:832-834` | signed URL 5 min |
| Exclusão definitiva de anexos | `src/lib/frequencias.functions.ts:906` | `storage.remove(paths)` |
| Detalhe da folha: botão "Ver" e excluir | `src/routes/_authenticated/frequencias_.$id.tsx:1691` e `1705-1707` | `remove` + `createSignedUrl(60)` |
| Foto do profissional | `src/lib/foto-profissional.ts:62` | `createSignedUrl(3600)` no bucket `avatars` |
| Purga automática (cron) | `src/routes/api/public/hooks/purgar-documentos.ts:49-51` | `storage.remove([...])` |
| Botão "Ver" na UI | `src/components/frequencias/anexos-entidade.tsx:246-250` e `340-344` | apenas consome a URL já assinada |

Fora do escopo (permanecem no Supabase): `src/lib/assinatura-storage.ts` e
`src/lib/pdf-pipeline.ts:514` (assinaturas institucionais).

## c) Compatibilidade do SDK e risco de build

- O projeto roda TanStack Start 1.168 + Vite 7, com deploy na Vercel. `@aws-sdk/client-s3`
  e `@aws-sdk/s3-request-presigner` funcionam em runtime Node, mas o preset de servidor
  deste template é orientado a Worker/edge, e o `client-s3` é pesado (~2 MB no bundle
  de servidor) e traz resolvedores de credencial que tocam filesystem.
- **Decisão (ajuste aprovado):** usar **`aws4fetch`** para assinar tudo — presigned PUT,
  presigned GET, e as chamadas HEAD/DELETE. É uma dependência única, sem sub-dependências,
  baseada em Web Crypto e compatível com edge/Node, sem o peso do `@aws-sdk/client-s3` e
  sem o risco de uma implementação SigV4 manual.
- Sobre o erro `Unexpected splitNode type: TSNonNullExpression`: ele **não vem do
  aws-sdk nem do aws4fetch**. É o transform de split de server functions engasgando com o
  operador `!` (non-null assertion) dentro de módulos `.functions.ts`. Mitigação adotada no
  Passo 2: nenhum `!` nos `.functions.ts` novos/alterados (usar checagem explícita), e os
  `.functions.ts` ficam como wrappers finos, com toda a lógica em `storage-r2.server.ts`.


---

# Passo 2 — Arquitetura (só depois da sua confirmação)

## Fluxo

```text
Anexar  ->  solicitarUploadR2 (server, autenticado) devolve { url presigned PUT, key }
        ->  navegador faz PUT direto na URL (mesma barra de progresso)
        ->  confirmarUploadR2 faz HEAD, valida tamanho real; se exceder, apaga e falha
        ->  registrarAnexoLinha grava metadados com storage_path = "r2:..."
Ver     ->  obterUrlVisualizacao decide: prefixo "r2:" -> presigned GET 5 min
                                         demais       -> Supabase, como hoje
```

## Arquivos

- `src/lib/storage-r2.server.ts` (server-only): cliente `AwsClient` do **`aws4fetch`**
  (instalado com `npm install aws4fetch`), com `criarUrlUpload` e `criarUrlLeitura` (GET 5 min, sempre
  assinada) via `sign(..., { aws: { signQuery: true } })`, e `validarObjeto` (HEAD +
  limite) e `removerArquivo` via `client.fetch`. Endpoint
  `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, região `auto`, service `s3`.
  Nenhuma URL pública referenciada.

- `src/lib/storage-r2.functions.ts` (wrapper fino, `requireSupabaseAuth`):
  `solicitarUploadR2`, `confirmarUploadR2`, `resolverUrlDocumento`.
- `src/lib/storage-universal.ts` (client-safe): `isR2`, `isLegadoSupabase`,
  `obterUrlVisualizacao`, reaproveitando as validações de `anexos-linha.ts`
  (PDF/JPG/PNG/WEBP, 10 MB) e `foto-profissional.ts` (imagens, 5 MB).

Chave: `r2:{secretaria}/{unidade}/{pasta}/{entidade}/{uuid}.{ext}` — mesmo
particionamento de hoje, só com prefixo. Coluna `storage_path` inalterada.

## Feature flag

`STORAGE_PROVIDER` (`r2` | `supabase`, default `r2`), lida no servidor. Se o presign
falhar (credencial inválida, bucket inacessível), o cliente cai automaticamente no
fluxo Supabase atual, registra o erro no log e o usuário não percebe falha.

## Alterações

- `src/components/frequencias/anexos-entidade.tsx` — upload via presigned (cobre folha
  de Efetivos, Contratados, envio para análise e painel de Aprovações)
- `src/routes/_authenticated/frequencias_.$id.tsx` — mesmo fluxo no upload/ver/excluir
- `src/routes/_authenticated/profissionais.tsx` + `src/lib/foto-profissional.ts` — foto
  no R2; `useFotoAssinada` passa a usar `obterUrlVisualizacao`
- `src/lib/listar-anexos.functions.ts` e `src/lib/frequencias.functions.ts` — URLs e
  remoção decididas pelo prefixo
- `src/lib/anexos-linha.ts` — `montarCaminhoAnexo` com prefixo `r2:`
- `src/routes/api/public/hooks/purgar-documentos.ts` — purga no destino correto

Cada arquivo alterado é reescrito por inteiro, sem merge parcial.

## Validação final

Anexo novo em Efetivos e Contratados abre pelo "Ver"; anexo antigo continua abrindo;
anexo pelo painel de Aprovações e foto de profissional funcionam; lixeira, restauração
e purga funcionam nos dois tipos de caminho; nenhuma chave R2 no bundle do navegador.
