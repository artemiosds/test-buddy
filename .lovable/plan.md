# Plano de Correção: Erro de Sintaxe UUID no Módulo de Assinaturas

O erro `invalid input syntax for type uuid` ocorre quando uma string contendo uma extensão de arquivo (ex: `.png`) é enviada para uma coluna do tipo `UUID` no banco de dados. Embora já existam validações, o erro persiste para alguns usuários, indicando que o payload enviado ao Supabase ainda carrega dados contaminados em campos como `id`, `usuario_id`, `perfil_id` ou `unidade_id`.

## Ações Técnicas

### 1. Reforço da Validação no Frontend (`meu-perfil.assinatura.tsx` e `assinaturas.tsx`)
- Implementar um "sanitizador agressivo" que limpa qualquer string que não seja um UUID puro antes de montar o payload.
- Garantir que `fileName` (que contém `.png`) seja mapeado **apenas** para `storage_path`.
- Adicionar logs de erro específicos no console (visíveis apenas em dev) para capturar o payload exato caso o erro ocorra novamente.

### 2. Proteção no Server Function (`assinaturas-institucionais.functions.ts`)
- Adicionar validação `z.string().uuid()` rigorosa no schema do Zod para todos os campos que devem ser UUID.
- O Zod lançará um erro claro no frontend antes mesmo de tentar a inserção no banco de dados, facilitando o debug.

### 3. Normalização de Caminhos de Storage
- Padronizar o uso de caminhos simples (apenas o nome do arquivo UUID-v4) para evitar problemas de permissão RLS baseados em prefixos de pasta textuais.

## User Interface (Sem Alterações Visuais)
- O comportamento da tela permanece o mesmo, mas o feedback de erro será mais preciso se houver falha de validação.

## Detalhes Técnicos (para Desenvolvedores)
- Uso de `regex` para validar formato UUID v4.
- `zod` schemas atualizados para incluir `.uuid()`.
- Verificação de `null` vs `undefined` em campos opcionais de UUID.
