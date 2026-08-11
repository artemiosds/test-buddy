# CONTEXTO (achado confirmado, não é hipótese)
    
O sistema estava usando duas fontes de verdade para permissões:
1. `get_my_permissions`: Usada no frontend e policies, já considerava o perfil **MASTER**.
2. `get_user_permissions_list`: Usada pelo `sync_user_permissions_to_jwt`, **NÃO** considerava Master e não tinha os overrides de `usuario_permissoes`.

**O QUE FOI FEITO:**
1. Alinhamos `get_user_permissions_list` para ser idêntica à lógica de Master.
2. Criamos o trigger `tr_sync_perms_on_usuario_permissao` para que o JWT atualize na hora que você mudar uma permissão individual.

---

Essa tela de "Manutenção Programada" — foi você (ou alguém) quem
ativou manualmente algum modo de manutenção, ou ela apareceu sozinha
depois da migração? Isso parece ser uma feature própria do sistema
(um "modo manutenção" com contatos de suporte), não um erro de
build — então ela só aparece se algo no banco/config estiver
sinalizando "sistema em manutenção".
