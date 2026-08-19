# Plano de Atualização de Visibilidade e Permissões (Diretores de Unidade)

Este plano visa restaurar e consolidar as regras de visibilidade para o perfil **Diretor de Unidade**, garantindo que visualizem apenas os profissionais e unidades sob sua responsabilidade, conforme as regras de negócio do HSM Gestão.

## Ações Realizadas

### 1. Auditoria de RLS (Row Level Security)
- Verificação das políticas de segurança nas tabelas `profissionais`, `unidades`, `frequencias` e `frequencia_profissional`.
- Correção de lógica em JOINs que causavam a mensagem "Nenhuma unidade vinculada".

### 2. Sincronização de Visibilidade
- Garantia de que a função `public.has_permission` e o contexto `public.get_my_user_context` suportam a hierarquia de acesso (Master > Gestor > Diretor).
- Diretores de Unidade agora possuem acesso via `usuario_unidades` e `competencia_unidades`.

### 3. Edição em Aprovações
- Habilitação da edição inline na tela de Aprovações para perfis **Master** e **Gestor**, refletindo alterações em tempo real nas folhas correspondentes.

## Detalhes Técnicos
- As políticas de RLS foram ajustadas para usar `OR` entre as permissões de Secretaria e Unidade, permitindo que Diretores acessem dados específicos sem necessidade de acesso global.
- Atualização das Server Functions para ignorar travas de status "Aprovado" quando o usuário é Master.

## Próximos Passos
- Monitoramento de logs de sincronização para validar a concorrência otimista.
- Verificação final da extração de dados bancários via IA no cadastro de profissionais.
