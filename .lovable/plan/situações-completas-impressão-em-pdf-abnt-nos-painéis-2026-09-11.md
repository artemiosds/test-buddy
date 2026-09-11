# Situações completas + impressão em PDF (ABNT) nos painéis

## O problema real (verificado no banco)

O detalhamento de "Situação Funcional" segue sim o cadastro, mas:

1. **"Afastado por Laudo" não existe no banco.** As duas listas de situações do banco (`situacao_funcional` e `status`) não têm o valor `afastado_laudo` — apenas Ativo, Férias, Licença (e variações), Atestado, Afastado, Afastamento por INSS, Falta informada ao RH (PAD), Vacância, Cedido, Desligado e Inativo. Portanto nenhum profissional pode ser salvo com essa situação e ela nunca aparece em tela.
2. **Situações com zero são escondidas.** O detalhamento só lista situações com contagem maior que zero, então quem olha a tela não vê que "Afastado por Laudo", "Atestado" ou "Licença Luto" existem e estão zeradas.
3. Hoje as situações realmente cadastradas são: 837 em exercício, 39 férias, 11 licença prêmio, 11 afastamento INSS, 10 licença sem vencimento, 4 falta PAD (PAD), 3 licença maternidade, 3 vacância, 2 licença saúde, 1 licença estudo, 1 cedido — total 922.

## O que será feito

### 1. Liberar "Afastado por Laudo" no cadastro
- Adicionar o valor `afastado_laudo` às duas listas de situações do banco, para que possa ser escolhido no cadastro do profissional e salvo.
- Confirmar que ele aparece com o rótulo "Afastado por Laudo", cor de atenção, e entra sempre no grupo "Afastados" (nunca em Ativos nem em Disponível para escala).

### 2. Detalhamento completo e fiel ao cadastro
- Na tela Situação Funcional, listar **todas** as situações do cadastro, inclusive as com zero (mostradas em cinza), na mesma ordem oficial.
- Mostrar, ao lado de cada situação, o percentual sobre o total e a qual grupo pertence (Ativos / Fora de escala / Afastados / Desligados).
- Aplicar a mesma lista completa nos demais painéis-alvo que exibem quebra por situação, para não haver situação "invisível" em nenhum lugar.

### 3. Botão "Imprimir PDF (ABNT)" em todos os painéis-alvo
Um botão no topo de cada página, gerando um PDF fiel ao que está na tela (mesmos filtros, unidade e modo de visualização), no mesmo padrão ABNT já usado no Relatório Geral de Cargos: capa/cabeçalho institucional, indicadores, tabelas com cabeçalho repetido, gráficos, notas metodológicas, numeração de páginas e fechamento único com assinatura e fé pública na última página.

Páginas que recebem o botão:
- Visão Geral do Sistema
- Dashboard Executivo (Secretaria)
- Sala de Situação (Secretaria)
- Dashboard Executivo — RH
- Situação Funcional
- Centro de Controle da Força de Trabalho
- Quadro de Lotação
- Distribuição por Setor
- Relatórios Operacionais e Gerenciais (Secretaria)

Cada PDF traz os mesmos números da tela: indicadores no topo (Total, Ativos, Disponível p/ Escala, Férias/Licença Prêmio, Afastados, Desligados, quando aplicável), depois as tabelas e gráficos daquela página, cada tabela como bloco indivisível.

## Detalhes técnicos

- Migração: `ALTER TYPE ... ADD VALUE 'afastado_laudo'` em `situacao_funcional` e `status_profissional` (aditivo, sem perda de dados).
- Reaproveitar `SITUACAO_ORDEM`/`SITUACAO_LABEL` e `grupoSituacao` de `src/lib/situacao-funcional.ts`; KPIs continuam vindo de `src/lib/kpis-forca-trabalho.ts`.
- Novo helper `src/lib/painel-abnt.ts` para montar `AbntRelatorio` a partir dos dados já carregados de cada painel (KPIs + blocos + gráficos), reutilizando `BotaoRelatorioAbnt` e `gerarRelatorioAbnt` (`blocos` com `keepTogether`, `fechamentoUnico`, `graficosApos`).
- Sem novas consultas: o PDF usa exatamente os dados já em memória na tela.
- Validação: `bunx tsgo --noEmit` e testes de `situacao-funcional`. A conferência visual do PDF autenticado é limitada porque o Supabase é externo (sessão de teste indisponível); os números serão conferidos por consulta ao banco.
