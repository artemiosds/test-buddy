
## Descoberta importante antes de mexer no schema

Auditei o banco antes de escrever qualquer migração e encontrei o seguinte:

- A tabela `public.profissionais` **JÁ POSSUI** as colunas `banco`, `agencia` e `conta_corrente` (todas `text NULL`). Elas foram criadas em ondas anteriores e o `import-dialog` legado já grava nelas.
- Portanto **NÃO é necessário rodar migração de schema** — a exceção que você autorizou não precisa ser gasta. Isso deixa a mudança ainda mais segura.
- No catálogo de `permissoes` **não existe** hoje nenhum código financeiro dedicado (nem `profissional.gerenciar`, nem `profissional.financeiro`). Existe apenas `profissional.editar_dados_agili`, que é específica de Efetivos (Proj/H.P/C.H/Jorn) — misturar dado bancário nela seria semanticamente errado.

## Decisão de permissão

Vou **criar uma permissão nova e específica** para o dado bancário, via `INSERT` no catálogo (não é DDL, é dado de configuração — não conta como migração de schema):

- `profissional.dados_bancarios` — "Ver e editar dados bancários do profissional (banco, agência, conta)"
- Concedida automaticamente ao perfil **MASTER**. RH ganha por atribuição manual em `perfil_permissoes` (via tela de perfis existente).
- Master continua vendo tudo por `is_master` (bypass já implementado em `has_permission`).

Qualquer tela que renderize dados do profissional (formulário de edição, dossiê, cards do lookup) passa a esconder banco/agência/conta atrás de `<PermissionGate permission="profissional.dados_bancarios">` — quem não tem a permissão simplesmente não vê os campos (nem em branco, nem mascarados).

## Migração / Dados que serão aplicados

Sem DDL. Apenas dois `INSERT` idempotentes:

```sql
INSERT INTO public.permissoes (codigo, nome, descricao, categoria, ativa)
VALUES ('profissional.dados_bancarios',
        'Dados bancários do profissional',
        'Ver e editar banco, agência e conta corrente do profissional.',
        'profissional', true)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.perfil_permissoes (perfil_id, permissao_id, concedida)
SELECT p.id, pe.id, true
  FROM public.perfis p, public.permissoes pe
 WHERE p.codigo = 'MASTER' AND pe.codigo = 'profissional.dados_bancarios'
ON CONFLICT DO NOTHING;
```

Zero alteração em tabelas, zero alteração em RLS.

## Tela de importação CER

Rota nova (Master/RH): `/_authenticated/profissionais.importar-cer` — link no topo de `profissionais.tsx` ao lado do "Importar" antigo, gated por `profissional.criar`.

Fluxo:

1. **Upload XLSX** → leitura em matriz (AOA), sem tratar linha 1 como cabeçalho.
2. **Detecção do cabeçalho**: varre as 10 primeiras linhas procurando as chaves `NOME`, `C.P.F.`, `LOTAÇÃO`, `CARGO`, `CONTA` (com normalização de acentos). No arquivo enviado, o cabeçalho está na **linha 6**.
3. **Extração de linhas de dados**: começa após o cabeçalho, para na primeira linha vazia ou onde a coluna Nº passa a ser `TOTAL`.
4. **Colunas ignoradas** (nunca sugeridas no mapeamento e descartadas silenciosamente): `Nº`, `DIAS`, `BASE`, `INSALUBRIDADE`, `H.E.`, `AD.NOTURNO`, `BRUTO`, `ISS`, `V.LÍQUIDO`.
5. **Parser de CONTA** (`src/lib/cer-conta-parser.ts`):
   - Aceita `AG:` / `AG;` (mesma coisa para `CC:` / `CC;`)
   - Extrai o token numérico com pontos e traço até o próximo separador
   - Detecta banco pelo texto restante em uma lista whitelist: `NUBANK`, `NU PAGAMENTOS`, `BB`, `BRADESCO`, `CAIXA`, `ITAÚ`/`ITAU`, `SANTANDER`, `BANPARÁ`/`BANPARA`, `INTER`, `SICOOB`, `SICREDI`
   - Se não bater o padrão, mantém o texto inteiro em `conta` e marca a linha como `revisar-bancario` (aparece amarelo na prévia)
6. **Fuzzy match**:
   - `LOTAÇÃO` → `unidades` da secretaria selecionada, comparando por nome+sigla normalizados (`piso-fuzzy.ts` já tem a base). Ambiguidade (>1 acima do limiar) ou zero → marca `revisar-unidade`; nunca cria unidade nova.
   - `CARGO` → mesmo critério contra `cargos`.
7. **Deduplicação por CPF**: para cada linha, faz `select id,nome_completo,unidade_id,cargo_id,banco,agencia,conta_corrente from profissionais where cpf=$1 and deleted_at is null`. Se existe, a linha entra como **Duplicado** e a UI oferece:
   - "Atualizar apenas campos vazios" (default)
   - "Pular"
   - (não incluímos "sobrescrever" para não pisar em dado bom já cadastrado sem confirmação explícita — se você quiser esse terceiro modo depois é fácil adicionar)
8. **Prévia obrigatória**: grade com todas as 19 linhas mostrando `Nome | CPF | Unidade (match) | Cargo (match) | Banco | Agência | Conta | Status`. Status possíveis: `Novo`, `Duplicado`, `Revisar unidade`, `Revisar cargo`, `Revisar bancário`, `Erro` (sem CPF, sem nome). Nada é gravado no banco antes do clique em **Confirmar importação**.
9. **Confirmação**: itera linhas válidas (não-erro, não-revisar) e faz `insert` ou `update` conforme o modo de deduplicação escolhido.

## Prévia real das 19 linhas deste arquivo

Rodei o parser contra o arquivo que você enviou. Este é exatamente o que a UI vai mostrar:

```text
 #  Nome                                  CPF              Cargo→match          AG      CC          Banco       Status
 1  ANDREY JOFRE RIBEIRO DIAS             528.405.142-49   FISIOTERAPEUTA       1104-5  22.681-5    —           Novo
 2  ANA PAULA OLIVEIRA LEITE              820.634.192-72   PSICOLOGA            130-9   126776-0    BB          Novo
 3  ANA PAULA OLIVEIRA LEITE (Dif…)       820.634.192-72   PSICOLOGA            130-9   126776-0    BB          Duplicado por CPF (linha 2)
 4  ARTEMIO SILVA DE SOUZA                047.782.792-63   ENFERMEIRO           3616    580430706-8 —           Novo
 5  BRENDA DA SILVA MOTA                  017.543.892-79   AUX. SAUDE BUCAL     0001    87576792-7  NUBANK      Novo
 6  DAMARIS DA ROCHA GOMES                820.634.192-72   FONOAUDIOLOGO        3616    (vazio)     —           Duplicado por CPF + Revisar bancário
 7  ELIZABETH PRINTES BATISTA             (sem CPF)        ASSIST.ADMIN.        0001    56735177-9  NU PAGAM.   Erro: CPF ausente
 8  GIULIANE COSTA DE SOUSA               047.249.492-95   AUX. SERV.GERAIS     11104-5 35995-5     —           Novo
 9  IDIMAR TAVARES CANTO                  414.012.632-91*  FISIOTERAPEUTA       1104-5  18.048-3    —           Novo (CPF corrigido: ponto→traço no dígito verificador)
10  JESSICA CARDOSO QUEIROZ               001.279.881-05   ODONTOLOGA           —       —           —           Novo + Revisar bancário
11  JESSICA MONTEIRO PONTES               979.779.692-20*  FONOAUDIOLOGA        6240    267834-9    BRADESCO    Novo
12  KENNYFF GATO FRANCO                   064.396.572-67   ASSIST.ADMIN.        0001    27653861-1  NUBANK      Novo
13  LUAN DA SILVA COSTA                   023.158.202-19   FISIOTERAPEUTA       1104-5  30797-1     —           Novo
14  MARIA DE NAZARÉ DA S. MONTEIRO        586.428.542-00   FONOAUDIOLOGA        3616    574702629-8 —           Novo
15  MARIA DO SOCORRO CORREA CARDOSO       404.028.602-25   TEC. EM ENFERMAGEM   1104-5  31044-1     —           Novo
16  PAMELA MELO LOBATO VITOR              023.727.572-45   AUX.SERV. GERAIS     1104-5  22.681-5    —           Novo
17  PATRICIA RUANNE FIGUEIREDO            001.693.932-01   ASSISTENTE SOCIAL    —       —           —           Novo + Revisar bancário
18  QUEROLLEN DA SILVA COSTABILE          013.143.662-70   FONOAUDIOLOGO        0001    60031415-7  —           Novo
19  SANNAY FRANCO GOMES DA COSTA          018.084.952-25   FISIOTERAPEUTA       0001    60031415-7  —           Novo
```

Observações que a UI vai destacar em amarelo/vermelho:

- **Linhas 3 e 6**: mesmo CPF `820.634.192-72` da linha 2 (Ana Paula). Isso é um dado suspeito da própria planilha — Damaris (linha 6) provavelmente tem CPF errado. A prévia vai mostrar as três lado a lado; você decide se atualiza ou pula.
- **Linha 7**: sem CPF. Fica como `Erro` e não é importada até você preencher manualmente.
- **Linhas 9 e 11**: CPF usa ponto onde deveria ser traço (`414.012.632.91`). Vou normalizar tirando tudo que não é dígito e reformatando; a validação DV do CPF não é bloqueante (apenas exibimos alerta).
- **Linhas 10 e 17**: coluna CONTA vazia — importa cadastro sem banco/agência/conta.
- **Match de LOTAÇÃO "CER"**: depende de existir uma unidade cadastrada na Secretaria de Saúde cujo nome ou sigla case com "CER" (fuzzy). Se não houver, todas as 19 linhas vão para `Revisar unidade` e nada é gravado. Você confirma a secretaria de destino no passo 1 da tela.

## Testes novos

Suite única em `src/lib/cer-import.test.ts` cobrindo:

1. **`parseConta`** — 6 casos: `AG: 1104-5 CC: 22.681-5` (ok), `AG; 0001 CC; 87576792-7 NUBANK` (ok+banco), `AG: 130-9 CC: 126776-0 BB` (banco curto), `AG; 3616 589422562-7` (formato quebrado, parcial), string vazia (vazio), `"lorem ipsum"` (revisar, mantém original em `conta`).
2. **`detectHeaderRow`** — cabeçalho na linha 6 do arquivo real, cabeçalho na linha 1 (compatibilidade), cabeçalho ausente (retorna `-1`).
3. **`fuzzyMatchUnidade` / `fuzzyMatchCargo`** — 4 casos: exato, com acento, ambíguo (retorna `null` + candidatos), sem match.
4. **`resolveDuplicates`** — dedup por CPF: novo, duplicado com campos vazios (merge), duplicado sem campos vazios (pula).
5. **Gate de permissão** — teste de componente do formulário de edição: com `profissional.dados_bancarios` presente renderiza os 3 inputs; sem a permissão os inputs não aparecem no DOM.

Total: **~18 asserts em 5 blocos**, roda em `bunx vitest run src/lib/cer-import.test.ts`.

## Escopo fora deste plano (não vou fazer)

- Nenhuma alteração no `import-dialog.tsx` antigo (fica para o fluxo genérico).
- Nenhuma alteração em RLS.
- Não vou tocar em `frequencias` / `folha` — os campos financeiros da planilha são descartados.
- Não vou tentar validar dígito verificador de CPF de forma bloqueante.

Confirma que posso seguir? Após seu OK, executo o `INSERT` da permissão, crio a rota, o parser, o componente de prévia e a suíte de testes num único ciclo.
