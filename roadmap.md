# Roadmap

## Valores por hora — solicitação atual
- [x] Trocar os três controles gerais e por nível por R$/hora e aplicar ao motor e simulador, preservando snapshots antigos.
- [x] Testar valores informados, herança, zero explícito e compatibilidade histórica (29 testes de cálculo aprovados).
- [ ] Salvar e reabrir as tarifas com a conta real — bloqueado: Supabase externo sem sessão autenticada disponível para automação; nenhum valor municipal foi inventado ou gravado.

## Estabilidade e desempenho — solicitação atual
- [x] Reduzir atualizações repetidas de tela e Realtime sem mudar persistência, permissões ou tramitação.
- [x] Verificar hipóteses de lentidão em sessão, manutenção e PDFs; corrigir confirmações repetidas de sessão e adiar carregamento do gerador ABNT; manutenção intacta (loop não confirmado).
- [x] Rodar testes de regressão: 33 testes relacionados aprovados; abertura no navegador sem erros e compilação automática OK. Três testes antigos de use-permissions falham por timeout também isoladamente; regras de permissão não foram alteradas.
- [ ] Confirmar edição, salvamento e releitura nas folhas com conta real — bloqueado: Supabase externo sem sessão autenticada disponível para automação.

## Concluído
- [x] Configuração Municipal organizada em abas horizontais temáticas, com campos preservados e botão Salvar no topo
- [x] Tabela 6-B de setores sem coluna Coordenador (tela + PDF/Word)
- [x] Relatório Geral Inteligente: números sem R$ indevido, assinatura só no fechamento, fechamento oficial + fé pública, cargos consolidados, atalhos nos dois painéis de IA
- [x] PDF oficial de efetivos: faixa exclusiva para assinaturas/validação/rodapé, “-” em campos sem dados e fonte ampliada
- [x] PDF oficial de contratados: faixa exclusiva para assinaturas/validação/rodapé, “-” em campos sem dados e fonte ampliada
- [x] Status e situação funcional: exibir `falta_pad` somente como “Falta informada ao RH” em todo o fluxo
- [x] PDFs Oficial e Gestão-SMS: padrão completo do carimbo restaurado (imagem, traço, nome e cargo), com validação em faixa separada
- [x] Carimbos em todas as folhas: nome e cargo com linhas dinâmicas, sem sobreposição em nomes extensos
- [x] QR das assinaturas: consulta pública mínima, endereço oficial estável e conferência local do PDF por SHA-256

## Pendente
- [x] Corrigir regras de gravação do código hierárquico em Unidades e Setores e detectar gravações bloqueadas (6 testes e 3 verificações SQL aprovados)
- [ ] Conferir salvar/reabrir código hierárquico com a conta do usuário — bloqueado: conexão Supabase externa sem sessão de teste disponível
- [ ] Implementar envio consolidado por unidade para Efetivos/Contratados, agrupamento e ações conjuntas em Aprovações, e reparar com segurança o caso de Outubro/2026 da Vigilância Sanitária
- [ ] Alinhar filtros/contagem de ativos dos painéis de Relatórios (Visão Geral do Sistema, Dashboard Executivo Secretaria, Sala de Situação, Dashboard Executivo RH, Situação Funcional, Centro de Controle da Força de Trabalho, Quadro de Lotação, Distribuição por Setor) à regra de `src/lib/situacao-funcional.ts` usada em Profissionais e Geral Cargos
- [x] Folha financeira: regras na Configuração, salário por cargo, projeção nos Dados Salariais e evolução na ficha do profissional
- [x] Folha financeira (etapas 1–3): sub-abas Visão geral/Salários e cargos/Regras/Tributos/Simulador, filtros, valores herdados, aviso de não salvo, nível do cargo salvo junto, validação, sincronização com prévia (12 testes)
- [ ] Folha financeira etapa 4: guardar as regras por competência — aguarda decisão do usuário sobre o momento de registro (ao aprovar ou ao encerrar a competência)
- [ ] Folha financeira etapa 5: histórico de alterações dos parâmetros na auditoria
