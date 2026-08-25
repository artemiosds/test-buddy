# Correção do cabeçalho dos PDFs da Folha de Contratados

Escopo: apenas `src/lib/pdf-folha-contratados-modelo-cer.ts` (PDF Modelo Gestão-SMS) e `src/lib/pdf-folha-contratados-oficial.ts` (PDF Oficial). A folha de efetivos não será alterada.

## Causa confirmada

Nos dois geradores o brasão central é desenhado de y≈6 até y≈20,4 mm no centro da página, exatamente sobre os textos centralizados desenhados em y=12, 16 e 20 mm — daí a sobreposição. As três logos permanecem; só os níveis verticais mudam.

## Layout a aplicar (idêntico nos dois arquivos)

```text
 y=6 .. 22   [logo prefeitura]      [brasão central]      [logo saúde]
 y=25              ESTADO DO PARÁ                      (negrito 9pt)
 y=30      PREFEITURA MUNICIPAL DE ORIXIMINÁ           (negrito 10pt)
 y=35        SECRETARIA MUNICIPAL DE SAÚDE             (negrito 9pt)
 y=40   [UNIDADE] — FREQUÊNCIA DOS PRESTADORES — MÊS MM/AAAA (negrito 9pt)
 y=42   ------------------- linha divisória -------------------
 y=44   início da tabela (autoTable startY / margin.top)
```

- Nível 1: altura máxima de 16 mm para as imagens (y=6 a 22), largura proporcional; prefeitura à esquerda na margem, brasão centralizado horizontalmente, saúde à direita na margem.
- Nível 2: bloco de texto centralizado começando em y=25 mm, espaçamento uniforme de 5 mm entre linhas, todas em negrito nos tamanhos indicados.
- Linha divisória em y=42 mm; `startY` e `margin.top` do autoTable passam de 32 para 44 mm nos dois geradores, para que o cabeçalho redesenhado em cada página (`didDrawPage`) nunca colida com a grade.
- No PDF Oficial, a função `drawInstitutionalBox` (moldura de 22 mm com texto sobre o brasão) deixa de ser usada pelo fluxo da folha de contratados; o cabeçalho passa a ser o mesmo `drawHeader` corrigido.
- Nome do município/UF continuam vindo de `municipio_config` quando disponíveis, com "ORIXIMINÁ"/"PARÁ" como fallback.

## Rodapé e assinaturas

- Rodapé (emissão, emitido por, paginação) permanece na base da página.
- O cálculo do Y do bloco de assinaturas passa a partir de `lastAutoTable.finalY`, com folga mínima; quando não couber acima do rodapé, abre nova página e posiciona a partir de y=44+5 mm (novo topo), preservando a reserva para emissão/paginação e sem duplicar blocos.

## Verificação

Gerar os dois PDFs (incluindo caso com nome de unidade longo e com múltiplas páginas), converter as páginas em imagem e inspecionar visualmente: logos sem sobreposição de texto, quatro linhas do bloco institucional legíveis, tabela iniciando abaixo da divisória e assinaturas sem colisão com o rodapé.
