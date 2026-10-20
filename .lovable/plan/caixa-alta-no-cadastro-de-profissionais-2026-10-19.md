# CAIXA ALTA no cadastro de profissionais

## O que muda para você
- Ao cadastrar ou editar um profissional, os campos de texto passam a ficar em CAIXA ALTA automaticamente enquanto você digita, mantendo os acentos (ex.: "João" vira "JOÃO", "Conceição" vira "CONCEIÇÃO").
- A mesma regra vale para a importação por planilha.
- Os cadastros que já existem e ainda não estão em caixa alta serão corrigidos de uma vez.

## Campos que ficam em CAIXA ALTA
Nome completo, nome social, endereço (logradouro, número, bairro, cidade, endereço completo), UF, órgão do RG, conselho de classe, banco, projeto, jornada e observações.

Ficam como estão (não faz sentido caixa alta): e-mail, foto, e campos só com números (CPF, RG, PIS, CNS, CEP, telefone, agência, conta, matrícula).

## Situação atual encontrada (967 profissionais ativos)
- 16 com nome fora de caixa alta
- 100 com endereço fora de caixa alta
- 344 com observações fora de caixa alta
- Banco, siglas, projeto e nome social já estão corretos

## Segurança
- Nenhum profissional é apagado; só o texto é convertido.
- Acentos são preservados (não removemos nem forçamos acentos).
- Folhas, aprovações, CPF e vínculos não são tocados.

## Detalhes técnicos
- Helper puro `toUpperPtBr` (`toLocaleUpperCase("pt-BR")`) aplicado no `profissionalSchema` (zod transform) dos campos listados, cobrindo o RPC `save_profissional_complete`; inputs do formulário com conversão no onChange e classe `uppercase`.
- `import-dialog.tsx`: normaliza os mesmos campos antes do update.
- Correção dos dados existentes via update único com `upper()` nos campos listados, apenas onde diferente (preserva acentos no Postgres UTF-8).
- Teste vitest do helper/schema (ex.: "joão da conceição" → "JOÃO DA CONCEIÇÃO"; e-mail inalterado).
