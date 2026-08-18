# Plano de Melhoria Visual do Dashboard Clássico

O objetivo é modernizar o design dos gráficos (Pizza e Barras) na `DashboardClassico`, substituindo cores escuras/básicas por uma paleta vibrante e profissional, além de aplicar acabamentos modernos como cantos arredondados, sombras suaves e interatividade refinada.

## Alterações Técnicas

### Frontend

- **Componente `DashboardClassico` (`src/components/dashboard/DashboardClassico.tsx`)**:
    - **Paleta de Cores**: Definir uma nova escala `COLORS` usando tons modernos (Azul Royal, Esmeralda, Âmbar, Índigo e Rose).
    - **Gráfico de Barras**: 
        - Aplicar um degradê (linear gradient) nas barras para profundidade.
        - Aumentar o `borderRadius` das barras.
        - Ajustar a opacidade do `CartesianGrid`.
    - **Gráfico de Pizza**:
        - Transformar em um gráfico de rosca (Donut) mais fino.
        - Adicionar animação de entrada.
        - Melhorar o estilo do `Legend` para maior clareza.
    - **Tooltips**: Customizar o `Tooltip` para usar o tema do sistema com cantos arredondados e sombras.

### CSS e Estilos

- Utilizar as variáveis semânticas do Tailwind v4 (`hsl(var(--primary))`, etc.) para manter a consistência com o tema Dark/Light.

## Detalhes Adicionais para o Usuário

- As barras agora terão um visual "glassmorphism" suave com degradê.
- O gráfico de pizza será convertido em um anel moderno, facilitando a leitura dos percentuais.
- As cores serão ajustadas para evitar o "preto" genérico, usando azul marinho profundo e tons vibrantes para destaque.
