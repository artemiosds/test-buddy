# Correção: erro de chave duplicada na Folha de Efetivos por setor

## O que está acontecendo

O banco tem um índice único em `frequencias` sobre
`(competencia_unidade_id, tipo, COALESCE(setor_id, '0000...0'))`, ou seja: uma
folha por unidade+tipo+setor, e uma folha "da unidade inteira" quando o setor é
nulo (hoje existem 41 registros nessa condição).

Na função `ensureFolhaEfetivos` (`src/lib/frequencias-efetivos.functions.ts`), o
`setor_id` pode chegar como **lista de setores** (o filtro da tela é
multi-seleção). Nesse caso:

1. A busca prévia procura `setor_id IN (...)` — se nenhuma folha setorial existe
   ainda, não encontra nada (e, se existir mais de uma, o `maybeSingle()` falha).
2. O código então insere um registro com `setor_id = null`, que colide com a
   folha da unidade já existente → `duplicate key value violates unique
   constraint "frequencias_comp_uni_tipo_setor_idx"`.

Nenhum registro está apagado logicamente, então a causa é essa incoerência entre
o que é buscado e o que é inserido.

## Alterações propostas

### 1. Normalizar o `setor_id` (`src/lib/frequencias-efetivos.functions.ts`)

- No início de `ensureFolhaEfetivos`, reduzir a entrada a um único valor:
  array com exatamente um item → esse UUID; array vazio, `undefined` ou array com
  vários setores → `null` (folha da unidade).
- Usar esse mesmo valor normalizado tanto na busca quanto na criação, eliminando
  a divergência atual.

### 2. Busca e criação à prova de conflito

- Substituir o `.filter("setor_id", ...)` dinâmico por `eq`/`is` conforme o valor
  normalizado, com `limit(1)` + `maybeSingle()` (sem risco de múltiplas linhas).
- Trocar o `.insert()` por `.upsert()` com
  `onConflict: "competencia_unidade_id,tipo,setor_id"` e `ignoreDuplicates`,
  retornando o registro existente quando houver.
- Envolver a criação em `try/catch`: se o Postgres devolver `23505`
  (unique violation) por concorrência, refazer a busca e devolver o registro já
  criado, sem propagar erro para a tela.
- Se nem o upsert nem a rebusca devolverem linha, lançar mensagem clara em
  português em vez do erro cru do banco.

### 3. Mesma correção na Folha de Contratados

`src/lib/frequencias-contratados.functions.ts` repete o mesmo padrão de
busca/criação por setor (linhas ~360-375). Aplicar a mesma normalização e o mesmo
tratamento de conflito para evitar o erro equivalente naquela tela.

## Observação técnica

O índice único usa `COALESCE(setor_id, ...)` e não considera `deleted_at`. Por
isso o upsert precisa apontar para a combinação
`competencia_unidade_id, tipo, setor_id`; nenhuma mudança de banco é necessária.

## Verificação

1. Abrir a Folha de Efetivos da unidade "PROGRAMA DE AGENTE COMUNITARIO DE
   SAUDE" e alternar o filtro de setor (nenhum, um, vários) sem erro.
2. Repetir na Folha de Contratados.
3. Confirmar que salvar/enviar continua operando sobre a folha correta.
