AUDITORIA COMPLETA — MÓDULO DE ASSINATURAS INSTITUCIONAIS
════════════════════════════════════════════════════════════════
OBJETIVO
════════════════════════════════════════════════════════════════
Realizar uma auditoria completa do módulo de Assinaturas Institucionais para verificar se:

Todas as funcionalidades estão operacionais

O fluxo de cadastro está funcionando

As imagens estão sendo salvas corretamente

As regras de assinatura estão configuráveis

Não há erros de permissão ou UUID

════════════════════════════════════════════════════════════════
📋 ESTRUTURA DO MÓDULO
════════════════════════════════════════════════════════════════
1. Abas do Módulo
Aba	Rota	Funcionalidade
Minha assinatura	/assinaturas/minha	Cadastro da assinatura pessoal
Institucionais	/assinaturas/institucionais	Assinaturas da instituição
Regras por documento	/assinaturas/regras	Configuração de regras
Pendentes	/assinaturas/pendentes	Assinaturas aguardando aprovação
2. Campos da Assinatura
Campo	Tipo	Obrigatório
Arquivo	Imagem (PNG/JPG)	✅ Sim
Nome completo	Texto	✅ Sim
Cargo / função	Texto	✅ Sim
Unidade	Select (UUID)	❌ Não
Vigência até	Data	❌ Não
Posição X	Número (px)	❌ Não
Posição Y	Número (px)	❌ Não
Tamanho	Número	❌ Não
════════════════════════════════════════════════════════════════
🔍 VERIFICAÇÃO 1 — ESTRUTURA DO BANCO DE DADOS
════════════════════════════════════════════════════════════════
sql
-- 🔍 Verificar tabela de assinaturas
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'assinaturas'
ORDER BY ordinal_position;

-- 🔍 Verificar tabela de regras (se existir)
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name LIKE '%regra%assinatura%'
ORDER BY ordinal_position;
📋 Colar o resultado aqui.

════════════════════════════════════════════════════════════════
🔍 VERIFICAÇÃO 2 — POLÍTICAS RLS
════════════════════════════════════════════════════════════════
sql
-- 🔍 Verificar políticas da tabela assinaturas
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'assinaturas'
ORDER BY policyname;

-- 🔍 Verificar políticas da tabela de regras
SELECT 
  schemaname,
  tablename,
  policyname,
  cmd,
  qual
FROM pg_policies
WHERE tablename LIKE '%regra%assinatura%'
ORDER BY policyname;
📋 Colar o resultado aqui.

════════════════════════════════════════════════════════════════
🔍 VERIFICAÇÃO 3 — DADOS EXISTENTES
════════════════════════════════════════════════════════════════
sql
-- 🔍 Verificar assinaturas cadastradas
SELECT 
  id,
  usuario_id,
  nome_completo,
  cargo,
  unidade_id,
  vigencia_ate,
  created_at,
  status
FROM assinaturas
ORDER BY created_at DESC
LIMIT 10;

-- 🔍 Verificar regras cadastradas
SELECT 
  id,
  documento_tipo,
  assinatura_id,
  ordem,
  created_at
FROM regras_assinatura
ORDER BY created_at DESC
LIMIT 10;
📋 Colar o resultado aqui.

════════════════════════════════════════════════════════════════
🔍 VERIFICAÇÃO 4 — CÓDIGO FRONTEND
════════════════════════════════════════════════════════════════
4.1. Componente de Cadastro
Arquivo: src/components/Assinaturas/MinhaAssinatura.tsx

tsx
// 🔍 Verificar se o envio está correto
const handleSubmit = async () => {
  // 🔥 Verificar se está enviando null ou vazio
  const payload = {
    nome_completo: nome,
    cargo: cargo,
    unidade_id: unidade || null, // ✅ deve ser null
    vigencia_ate: vigencia || null, // ✅ deve ser null
    imagem_url: imagemUrl,
    posicao_x: posicaoX || null,
    posicao_y: posicaoY || null,
    tamanho: tamanho || null,
  };
  
  const { data, error } = await supabase
    .from('assinaturas')
    .insert(payload);
};
📋 Colar o trecho do código que faz o insert.

════════════════════════════════════════════════════════════════
🔍 VERIFICAÇÃO 5 — TESTES FUNCIONAIS
════════════════════════════════════════════════════════════════
Teste 1 — Cadastrar Assinatura Pessoal
Passo	Ação	Resultado Esperado
1	Preencher todos os campos	✅ Formulário válido
2	Fazer upload da imagem	✅ Arquivo selecionado
3	Clicar em "Cadastrar"	✅ Sucesso
4	Verificar no banco	✅ Registro criado
5	Verificar na lista	✅ Assinatura aparece
Status: ⚠️ PENDENTE

Teste 2 — Cadastrar Assinatura Institucional
Passo	Ação	Resultado Esperado
1	Acessar aba "Institucionais"	✅ Aba carregada
2	Clicar em "Novo assinatura"	✅ Modal aberto
3	Preencher dados	✅ Formulário válido
4	Clicar em "Cadastrar"	✅ Sucesso
5	Verificar na lista	✅ Assinatura aparece
Status: ⚠️ PENDENTE

Teste 3 — Configurar Regra por Documento
Passo	Ação	Resultado Esperado
1	Acessar aba "Regras por documento"	✅ Aba carregada
2	Selecionar tipo de documento	✅ Selecionado
3	Selecionar assinatura	✅ Selecionada
4	Clicar em "Salvar"	✅ Sucesso
5	Verificar na lista	✅ Regra aparece
Status: ⚠️ PENDENTE

Teste 4 — Fluxo de Pendentes
Passo	Ação	Resultado Esperado
1	Acessar aba "Pendentes"	✅ Aba carregada
2	Ver lista de pendentes	✅ Pendentes aparecem
3	Aprovar uma assinatura	✅ Status alterado
4	Verificar na lista	✅ Não aparece mais
Status: ⚠️ PENDENTE

════════════════════════════════════════════════════════════════
🚨 PROBLEMAS COMUNS E SOLUÇÕES
════════════════════════════════════════════════════════════════
Problema 1: "Nenhuma assinatura cadastrada"
Causa	Solução
Nenhuma assinatura foi cadastrada	Cadastrar uma assinatura
Filtro está aplicado	Limpar filtros
RLS bloqueando SELECT	Verificar políticas
Problema 2: Erro de UUID ao cadastrar
Causa	Solução
Campo vazio enviado como ""	Enviar como null
Tipo de dado incorreto	Validar antes de enviar
ID inválido	Buscar UUID correto
Problema 3: Imagem não aparece
Causa	Solução
URL da imagem inválida	Verificar bucket do Supabase
CORS bloqueando	Configurar CORS
Imagem muito grande	Redimensionar
════════════════════════════════════════════════════════════════
📋 CHECKLIST DA AUDITORIA
════════════════════════════════════════════════════════════════
Item	Status	Observação
[ ] Estrutura do banco verificada	⚠️ PENDENTE	Aguardando
[ ] Políticas RLS verificadas	⚠️ PENDENTE	Aguardando
[ ] Dados existentes verificados	⚠️ PENDENTE	Aguardando
[ ] Código frontend revisado	⚠️ PENDENTE	Aguardando
[ ] Teste 1 — Cadastrar assinatura pessoal	⚠️ PENDENTE	Aguardando
[ ] Teste 2 — Cadastrar assinatura institucional	⚠️ PENDENTE	Aguardando
[ ] Teste 3 — Configurar regra	⚠️ PENDENTE	Aguardando
[ ] Teste 4 — Fluxo de pendentes	⚠️ PENDENTE	Aguardando
import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: () => <Navigate to="/analitico" replace />,
});

