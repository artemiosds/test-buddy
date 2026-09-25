# Corrigir e validar o QR das assinaturas eletrônicas

## Diagnóstico confirmado

- Os três PDFs de folha usam o mesmo QR: **Efetivos Oficial**, **Contratados Oficial** e **Modelo Gestão-SMS**.
- No ambiente local, um código real abriu corretamente **Documento autêntico** e um código falso abriu **Documento não encontrado**.
- Existem 17 documentos registrados, todos com código único; 14 possuem o PDF original armazenado e 3 não.
- O QR grava o endereço do navegador que gerou o PDF. Se a folha for emitida pela prévia, o papel fica apontando para a prévia; atualmente o projeto ainda não possui endereço publicado. No teste externo, tanto a entrada do QR quanto a página final responderam 401, portanto um cidadão sem login não consegue validar pela internet hoje.
- A consulta pública atual libera a tabela inteira, inclusive campos técnicos e metadados que a página não precisa mostrar.
- O selo informa um hash, mas a tela apenas confirma que o código existe e está ativo; ela ainda não compara o arquivo escaneado/baixado com esse hash.

## Implementação

1. **Criar uma validação pública mínima e segura**
   - Expor somente código, tipo, descrição, assinante, data, hash e situação de revogação.
   - Remover leitura anônima direta da tabela completa e preservar o acesso autenticado necessário ao sistema.
   - Manter os três resultados claros: autêntico, revogado e não encontrado.

2. **Tornar o endereço do QR estável**
   - Centralizar a criação da URL em um único helper.
   - Usar o endereço público canônico quando configurado; impedir emissão oficial com QR de `localhost` ou de prévia temporária.
   - Manter compatibilidade com os códigos já emitidos.
   - Corrigir também o fluxo antigo de “Fé Pública”, que hoje cria `/validar/hash-...` sem registro correspondente.

3. **Corrigir o acesso ao escanear fora do sistema**
   - Garantir que a entrada do QR e a página `/validar/{código}` sejam realmente públicas, sem exigir login.
   - Manter o PDF original protegido por autenticação e autorização; o visitante vê a validade, não os dados pessoais da folha.

4. **Fortalecer a comprovação do arquivo**
   - Calcular e armazenar o hash do PDF final exatamente como ele é baixado, depois de QR e carimbos.
   - Na validação, oferecer conferência opcional por upload local: calcular o SHA-256 no navegador e comparar com o hash oficial, sem enviar o arquivo.
   - Não mudar posição, tamanho, aparência dos carimbos, tabela, fontes ou paginação das folhas.

5. **Validar ponta a ponta**
   - Gerar os três modelos e decodificar seus QRs.
   - Abrir cada link como visitante sem sessão e conferir documento autêntico.
   - Testar código inexistente e documento revogado.
   - Confirmar que PDF alterado falha na comparação e PDF original passa.
   - Verificar que informações internas não ficam acessíveis anonimamente e que o projeto permanece sem erros.

## Observação necessária

O QR só poderá apontar definitivamente para a internet após existir um endereço publicado ou domínio oficial. Até lá, a implementação bloqueará a criação de um QR oficial preso à prévia, evitando imprimir folhas com link temporário.

## Detalhes técnicos

- Fluxo atual: `finalizarPdf` → `documentos_assinados` → QR com `codigo_validacao` → entrada pública → `/validar/$id`.
- A mudança de banco será feita por migração, com permissões públicas limitadas à função/view sanitizada e RLS preservada.
- Códigos existentes no formato `HSM-2026-XXXXXXXX` continuarão válidos.
