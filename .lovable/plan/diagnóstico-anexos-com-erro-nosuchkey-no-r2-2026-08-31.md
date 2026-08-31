# Diagnóstico: anexos com erro "NoSuchKey" no R2

## O que aconteceu (confirmado no banco)

Os 7 anexos são da submissão `1f08da49…` (tipo `frequencia_submissao`, folha efetivos), enviados entre 12:12:54 e 12:13:06 de 31/08.

Exemplo de `storage_path` salvo:

```text
r2:2aaac705-.../a0734c36-.../submissoes/1f08da49-.../26539f57-....jpg
```

Às **12:13:33** o log de eventos registra:

```text
documento.removido — { descarte_definitivo: true, motivo: "envio_cancelado", quantidade: 7 }
```

Ou seja: o modal "Enviar folha para aprovação" foi fechado/cancelado e a função `descartarAnexosPendentes` rodou, **apagando os 7 binários no R2**. Só que os 7 registros continuam na tabela `documentos` com `deleted_at` nulo — por isso eles aparecem na lista, o botão "Ver" gera URL assinada normalmente, e o R2 responde `NoSuchKey`.

## Por que o registro sobreviveu e o arquivo não

Em `src/lib/frequencias.functions.ts` (`descartarAnexosPendentes`):

1. valida apenas a permissão `documento.upload`;
2. faz `delete().in("id", ids)` — **sem `.select()`**, portanto não checa quantas linhas foram apagadas;
3. em seguida apaga os binários no R2.

A policy de DELETE em `documentos` exige outra permissão:

```text
documentos_delete: is_master(uid) OR has_permission(uid, 'documento.excluir', unidade_id, secretaria_id)
```

Quem tem só `documento.upload` sofre um DELETE que remove **0 linhas e não retorna erro** (comportamento normal de RLS no PostgREST). O código segue adiante e apaga o arquivo no R2 → registro órfão apontando para uma key inexistente.

## Respostas diretas às 4 perguntas

1. **storage_path salvo:** `r2:{secretaria}/{unidade}/submissoes/{submissao_id}/{uuid}.{ext}` — formato correto.
2. **Bate com a key do PUT?** Sim. É a mesma string gerada por `montarCaminhoAnexo` e enviada ao `criarUrlUpload`; o prefixo `r2:` é adicionado no retorno e removido na leitura (`chaveR2`). Não há divergência de key.
3. **Diferença entre as telas?** Não. Tanto `frequencias_.$id.tsx` quanto `anexos-entidade.tsx` usam o mesmo `AnexosEntidade` → `montarCaminhoAnexo` → `enviarArquivoUniversal`. A única diferença é a pasta (`frequencias/` vs `submissoes/`), irrelevante. O teste anterior funcionou porque foi um anexo de linha, que **não passa pelo fluxo de descarte** do modal de envio.
4. **O PUT completou?** Sim. `enviarArquivoUniversal` só grava `r2:` depois do PUT com `res.ok` **e** do `confirmarUploadR2` (HEAD no R2 confirmando existência e tamanho). Se qualquer etapa falhasse, cairia no fallback do Supabase e o path ficaria sem prefixo. Não é falha de upload — é exclusão posterior indevida.

## Correção proposta (ainda não aplicada)

1. **Tornar o descarte atômico e verificável** em `descartarAnexosPendentes`: usar `delete(...).in("id", ids).select("id, storage_path")` e apagar no storage **somente** os IDs efetivamente retornados. Se nada foi apagado, não tocar no R2 e devolver erro claro.
2. **Alinhar a autorização:** o autor do anexo pendente deve conseguir descartar o próprio arquivo. Ou ampliar a policy de DELETE com `created_by = auth.uid()` restrito a documentos ainda pendentes, ou executar o descarte via caminho privilegiado no servidor após validar autoria — a decisão fica registrada aqui antes de implementar.
3. **Limpeza dos 7 registros órfãos atuais:** marcar/remover os registros da submissão `1f08da49…` cujo binário já não existe, para a lista parar de exibir anexos quebrados.
4. **Defesa extra na leitura:** quando a assinatura do R2 apontar para objeto inexistente, sinalizar "arquivo indisponível" na lista em vez de entregar link que abre erro S3.

Nada será alterado até aprovação.
