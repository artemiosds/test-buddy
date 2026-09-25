# Compactar e padronizar os PDFs das folhas

## Objetivo
Reduzir o número de páginas sem voltar a causar sobreposição, mantendo a leitura confortável e fazendo o **Modelo Gestão-SMS seguir exatamente as correções do PDF Oficial**.

## O que será corrigido

1. **Aproveitar melhor cada página**
   - Retirar a reserva fixa de 82 mm em todas as páginas, que hoje limita o PDF de Contratados a cerca de quatro pessoas por página.
   - Calcular o espaço da tabela conforme o conteúdo real e a faixa necessária para assinatura.
   - Manter linhas completas: nenhum profissional será dividido entre páginas.
   - Repetir cabeçalho e títulos da tabela nas continuações.

2. **Assinaturas em todas as páginas, validação somente na última**
   - Exibir as assinaturas em uma faixa compacta e segura no fim de cada página.
   - Reservar a faixa maior do QR Code, código, hash e conformidade legal somente na última página.
   - Se a última página não tiver espaço suficiente, reorganizar apenas suas últimas linhas; não criar uma página quase vazia só para assinatura ou validação.
   - Preservar rodapé, número da página e identificação do emissor sem sobreposição.

3. **Usar o PDF Oficial como padrão correto**
   - Aplicar a mesma paginação, assinaturas, QR Code, traço para campo sem dado e fonte corrigida ao PDF Oficial de Efetivos e ao PDF Oficial de Contratados.
   - Corrigir o Modelo Gestão-SMS de Contratados para herdar as mesmas regras do Oficial, eliminando a lógica antiga que posiciona a assinatura logo depois da tabela.
   - Em Efetivos, manter o fluxo atual unificado e aplicar nele o mesmo padrão seguro.

4. **Traço e fonte consistentes**
   - Mostrar `-` somente quando o campo estiver vazio ou representar ausência de lançamento; preservar números reais quando houver informação.
   - Padronizar essa regra entre Oficial e Gestão-SMS.
   - Manter a fonte já ampliada, ajustando largura e quebra de linha para ganhar espaço vertical sem reduzir legibilidade.

## Validação
- Gerar novamente os cenários enviados de setembro/2026.
- Comparar quantidade de páginas antes e depois, especialmente os 19 contratados que hoje ocupam 5 páginas.
- Inspecionar visualmente todas as páginas dos PDFs gerados.
- Confirmar: nenhuma assinatura sobre a tabela, nenhum QR Code sobre assinatura ou rodapé, nenhum texto cortado e nenhuma página final desnecessariamente vazia.
- Verificar PDF Oficial e Modelo Gestão-SMS nos fluxos de Efetivos e Contratados disponíveis na tela.

## Detalhes técnicos
- Ajustar os três geradores existentes: Oficial Efetivos, Oficial Contratados e Modelo Gestão-SMS Contratados.
- Estender o fechamento central dos PDFs para permitir assinatura compacta por página e validação eletrônica exclusiva na última.
- Fazer a paginação considerar duas zonas: páginas intermediárias com assinatura e última página com assinatura mais validação.
- Reaproveitar uma única regra de formatação e limites para impedir que Oficial e Gestão-SMS voltem a divergir.
