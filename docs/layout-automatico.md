# Gerar Layout Automático (Aprendizado por Modelo de Referência)

Guia do usuário — módulo **Piso Nacional da Enfermagem → Importar folha
(Contratados / Efetivos)**.

## O que é

Antes, cada planilha nova exigia mapear coluna por coluna ("de/para") na mão.
Agora basta enviar **uma planilha modelo** (o Excel que a unidade já usa, com as
fórmulas dentro das células). A IA lê os cabeçalhos, uma amostra de linhas e as
fórmulas do Excel e cria sozinha o **layout de importação** — inclusive a
matemática (BRUTO, ISS, LÍQUIDO, gratificações, auxílios).

Nos meses seguintes o sistema **reconhece a planilha automaticamente** e aplica
o mesmo layout e as mesmas contas, sem nenhuma configuração.

## Passo a passo

1. Acesse **Piso Nacional da Enfermagem → Importar Contratados** (ou
   **Importar Efetivos**).
2. **Passo 1 — Arquivo:** envie o Excel modelo (`.xlsx`). Use de preferência o
   arquivo original do RH, com as fórmulas preservadas (não use um PDF nem uma
   cópia "colada como valores" — sem fórmulas a IA aprende apenas as colunas).
3. **Passo 2 — Mapeamento:** no topo aparece o painel
   **"Aprender este arquivo como modelo"**, com um selo indicando quantas
   fórmulas foram detectadas na planilha.
4. Digite um **nome do modelo** (ex.: `UBS Saúde — Contratados`, `H.M.O.`,
   `CAPS`). Se deixar em branco, o sistema nomeia sozinho a partir do arquivo.
5. Clique em **"Gerar layout automático a partir deste arquivo"**.
6. Em alguns segundos o sistema mostra:
   - a mensagem *"Layout criado automaticamente — N campos e M fórmulas
     aprendidas"*;
   - o layout já **selecionado** e o mapeamento **preenchido**;
   - o bloco **"Matemática aprendida"**, listando as regras em português
     (ex.: `valor_bruto = salario_base + insalubridade + hora_extra_50`,
     `iss = valor_bruto × 5%`).
7. Confira o mapeamento e a lista de fórmulas, ajuste o que quiser e siga o
   fluxo normal: **Cruzar com o Cadastro → Conferir → Importar**.

## Nos próximos meses

Basta enviar a planilha do mês. O sistema:

- identifica o layout pelo nome do arquivo e pelos cabeçalhos;
- aplica o mapeamento salvo;
- **recalcula apenas as colunas que a própria planilha calcula**, garantindo que
  os totais importados batam com o Excel.

Se nada mudou na planilha, não é preciso gerar o layout de novo. Só gere um novo
modelo quando a unidade **mudar o formato** (colunas novas, contas diferentes).

## Regra de ouro: valores digitados são respeitados

A IA usa a matemática geral, mas **nunca sobrescreve um valor digitado pelo RH**.

- Se a coluna no arquivo do mês é **fórmula** (ex.: `BRUTO`, `ISS`, `LÍQUIDO`),
  o sistema recalcula com a regra aprendida.
- Se a coluna traz um **valor digitado** (ex.: `INSALUBRIDADE` informada caso a
  caso), o valor do arquivo é mantido exatamente como está.
- Se o campo **não existe** no arquivo do mês, o sistema o calcula pela regra.

## Perguntas frequentes

**Preciso de permissão especial?**
Sim: a mesma permissão de importar do Piso (`piso.importar`).

**E se a IA errar uma coluna?**
O mapeamento continua editável no Passo 2. Você pode trocar o campo de qualquer
coluna, marcar **"Ignorar coluna"** e salvar sinônimos permanentes — o motor
antigo de layouts segue funcionando normalmente.

**E se o arquivo não tiver fórmulas?**
O layout é criado do mesmo jeito (colunas e campos), apenas sem a matemática
aprendida. Os valores importados serão os que estiverem na planilha.

**O layout gerado aparece em outro lugar?**
Sim: em **Layouts de Importação**, onde é possível renomear, versionar,
classificar, exportar/importar em JSON e ver estatísticas de uso.

**Serve para H.M.O., CAPS e outras unidades?**
Sim. O fluxo é idêntico: envie o modelo daquela unidade, clique em gerar, e cada
unidade passa a ter o seu próprio layout aprendido.
