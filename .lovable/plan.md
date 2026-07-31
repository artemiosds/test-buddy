## Diagnóstico

Analisei os dois arquivos que você anexou (`SAUDE - UBS'S (3)` e `(4)`): são estruturalmente idênticos — cabeçalho na linha 6, colunas `Nº, NOME, DATA ADMISSÃO, C.P.F., LOTAÇÃO, CARGO, DIAS, BASE, INSALUBRIDADE, H.E., AD. NOTURNO, BRUTO, ISS, TOTAL, GRAT.INCENTIVO, AUX. TRANSP., INCENTIVO...` com fórmulas reais (`=H7*20%`, `=H7+I7+J7+K7`, `=L7*5%`, `=L7-M7`) misturadas com valores fixos (insalubridade 974,26; grat. incentivo 2.147). O arquivo está perfeito — o problema é do sistema.

Encontrei três causas:

**1. O modelo não é salvo em lugar nenhum.**
No assistente, o arquivo modelo vive só na memória da tela (`modeloBuf`, um estado React). Ao fechar o assistente ou recarregar a página, ele desaparece. Não existe hoje nenhum cadastro de "Modelo de Planilha da UBS".

**2. Nada sai depois de anexar só o modelo.**
O botão "Gerar planilha clonada do modelo" exige **dois** arquivos: a planilha do mês *e* o modelo. Se você anexa apenas o modelo, o botão fica desabilitado e nada acontece — sem nenhuma mensagem explicando o motivo.

**3. O download em "Importações" não usa o modelo — usa um gerador antigo e fixo.**
Os botões "Baixar Planilha (3)", "Baixar FOPAG" e "Baixar por unidade" chamam um gerador hardcoded (`gerarPlanilhaContratados`), com colunas, ordem e matemática próprias, escritas em código. Ele não conhece o seu modelo UBS, por isso o arquivo baixado sai com estrutura diferente da sua — é exatamente o "sai tudo errado".

## Solução proposta

### A. Cadastro de Modelos de Planilha (persistente)
- Nova tabela `planilha_modelos`: nome, módulo/vínculo, unidade opcional, nome do arquivo, aba, linha de cabeçalho, colunas detectadas e o binário do `.xlsx` guardado no bucket `documentos` (`tipo_entidade = 'planilha_modelo'`, sem novos buckets).
- Ao anexar o modelo no assistente, o sistema mostra "Salvar como modelo" com nome sugerido (ex.: **UBS**), grava e passa a listar em um seletor "Modelo: UBS / Efetivos / ...".
- Marcar um modelo como **padrão** por vínculo/unidade.

### B. Download das Importações passando pelo clone
- Os botões de download passam a resolver, nesta ordem: modelo salvo escolhido → modelo padrão do vínculo → gerador legado (fallback).
- Existindo modelo, o arquivo é produzido pelo motor de clone: mesma estrutura, mesmas colunas (inclusive `GRAT.INCENTIVO`, `AUX. TRANSP.`, `INCENTIVO`), mesmas fórmulas deslocadas, valores fixos preservados (insalubridade 517,20 não vira 20% da base).
- O nome do arquivo continua padronizado (`PLANILHA-CONTRATADOS-{competência}.xlsx`).

### C. UX e diagnóstico
- Anexar somente o modelo passa a ser válido: o sistema lê, mostra o resumo ("18 colunas, cabeçalho na linha 6, 4 colunas estruturais") e oferece salvar, sem exigir o arquivo do mês.
- Mensagem clara no botão quando falta a planilha do mês, em vez de botão morto.
- Painel de divergência ao gerar: colunas do modelo sem dado, pessoas sem correspondência, colunas do mês ignoradas.

## Detalhes técnicos

- Migração: `planilha_modelos` com GRANTs para `authenticated`/`service_role`, RLS por unidade/permissão `configuracao.editar` para escrita e leitura para usuários autenticados com acesso à unidade.
- Server functions novas em `src/lib/planilha-modelos.functions.ts` (salvar, listar, obter binário assinado) com `requireSupabaseAuth` + `ensurePermission`.
- Reuso integral de `src/lib/planilha-clone.ts` (`lerMapaModelo`, `lerRegistrosNovos`, `aplicarClone`, `clonarPlanilhaModelo`) — nenhuma mudança na regra de cópia célula a célula.
- Em `piso-planilha-cliente.ts`, novo caminho: quando há modelo, montar as linhas consolidadas em uma pasta de trabalho temporária no formato do modelo e rodar o clone no navegador (evita o "Failed to fetch" do runtime serverless).
- `piso-enfermagem.index.tsx`: seletor de modelo ao lado dos botões de download.
