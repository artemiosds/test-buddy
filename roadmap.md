# Roadmap

## Concluído
- [x] Tabela 6-B de setores sem coluna Coordenador (tela + PDF/Word)
- [x] Relatório Geral Inteligente: números sem R$ indevido, assinatura só no fechamento, fechamento oficial + fé pública, cargos consolidados, atalhos nos dois painéis de IA
- [x] PDF oficial de efetivos: faixa exclusiva para assinaturas/validação/rodapé, “-” em campos sem dados e fonte ampliada
- [x] PDF oficial de contratados: faixa exclusiva para assinaturas/validação/rodapé, “-” em campos sem dados e fonte ampliada
- [x] Status e situação funcional: exibir `falta_pad` somente como “Falta informada ao RH” em todo o fluxo
- [x] PDFs Oficial e Gestão-SMS: padrão completo do carimbo restaurado (imagem, traço, nome e cargo), com validação em faixa separada
- [x] Carimbos em todas as folhas: nome e cargo com linhas dinâmicas, sem sobreposição em nomes extensos
- [x] QR das assinaturas: consulta pública mínima, endereço oficial estável e conferência local do PDF por SHA-256

## Pendente
- [ ] Implementar envio consolidado por unidade para Efetivos/Contratados, agrupamento e ações conjuntas em Aprovações, e reparar com segurança o caso de Outubro/2026 da Vigilância Sanitária
- [ ] Alinhar filtros/contagem de ativos dos painéis de Relatórios (Visão Geral do Sistema, Dashboard Executivo Secretaria, Sala de Situação, Dashboard Executivo RH, Situação Funcional, Centro de Controle da Força de Trabalho, Quadro de Lotação, Distribuição por Setor) à regra de `src/lib/situacao-funcional.ts` usada em Profissionais e Geral Cargos
