# Correção: remover fallback hardcoded "CAPS II" da coluna Lotação no PDF de Contratados

## Problema
No arquivo `src/lib/pdf-folha-contratados-oficial.ts`, a coluna **LOTAÇÃO** do `body` do `autoTable` usa a expressão:

```ts
(it as any).lotacao_sigla || (it as any).setor_nome || "CAPS II",
```

Como as propriedades `lotacao_sigla` e `setor_nome` não estão mapeadas no objeto `it`, o fallback `"CAPS II"` acaba sendo impresso para todos os profissionais de todas as unidades.

## Solução
Substituir a linha problemática por:

```ts
p.setor || input.unidadeNome || "-",
```

Onde `p` já é o profissional do item (`const p = it.profissional;`).

Isso alinha a lotação do PDF com o campo `setor` do profissional (o mesmo campo usado em `drawRow`, linha 178) e ainda permite fallback para o nome da unidade da folha ou `"-"`, eliminando o hardcoded `"CAPS II"`.

## Arquivo a editar
- `src/lib/pdf-folha-contratados-oficial.ts` (linha 367)

## Validação
- Executar `bunx tsgo --noEmit` para garantir que não haja regressão de tipos.
- Verificar visualmente um PDF de Contratados de outra unidade para confirmar que a lotação agora reflete o setor/unidade real do profissional e não mais "CAPS II".
