export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      assinatura_documento_regras: {
        Row: {
          ativa: boolean
          created_at: string
          created_by: string | null
          id: string
          obrigatoria: boolean
          observacao: string | null
          ordem: number
          perfil_codigo: string | null
          secretaria_id: string | null
          tipo_assinatura: Database["public"]["Enums"]["tipo_assinatura"]
          tipo_documento: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          obrigatoria?: boolean
          observacao?: string | null
          ordem?: number
          perfil_codigo?: string | null
          secretaria_id?: string | null
          tipo_assinatura?: Database["public"]["Enums"]["tipo_assinatura"]
          tipo_documento: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativa?: boolean
          created_at?: string
          created_by?: string | null
          id?: string
          obrigatoria?: boolean
          observacao?: string | null
          ordem?: number
          perfil_codigo?: string | null
          secretaria_id?: string | null
          tipo_assinatura?: Database["public"]["Enums"]["tipo_assinatura"]
          tipo_documento?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assinatura_documento_regras_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
        ]
      }
      assinatura_perfis_elegiveis: {
        Row: {
          descricao: string | null
          perfil_codigo: string
        }
        Insert: {
          descricao?: string | null
          perfil_codigo: string
        }
        Update: {
          descricao?: string | null
          perfil_codigo?: string
        }
        Relationships: []
      }
      assinaturas_institucionais: {
        Row: {
          ativa: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_pessoal: boolean
          metadata: Json
          mime_type: string | null
          obrigatoria: boolean
          ordem: number
          perfil_id: string | null
          secretaria_id: string | null
          storage_path: string
          tipo: Database["public"]["Enums"]["tipo_assinatura"]
          tipos_documento: string[]
          titular_cargo: string | null
          titular_nome: string
          unidade_id: string | null
          updated_at: string
          updated_by: string | null
          usuario_id: string | null
          vigencia_fim: string | null
          vigencia_inicio: string | null
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_pessoal?: boolean
          metadata?: Json
          mime_type?: string | null
          obrigatoria?: boolean
          ordem?: number
          perfil_id?: string | null
          secretaria_id?: string | null
          storage_path: string
          tipo?: Database["public"]["Enums"]["tipo_assinatura"]
          tipos_documento?: string[]
          titular_cargo?: string | null
          titular_nome: string
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          usuario_id?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Update: {
          ativa?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_pessoal?: boolean
          metadata?: Json
          mime_type?: string | null
          obrigatoria?: boolean
          ordem?: number
          perfil_id?: string | null
          secretaria_id?: string | null
          storage_path?: string
          tipo?: Database["public"]["Enums"]["tipo_assinatura"]
          tipos_documento?: string[]
          titular_cargo?: string | null
          titular_nome?: string
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          usuario_id?: string | null
          vigencia_fim?: string | null
          vigencia_inicio?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_institucionais_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_institucionais_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_institucionais_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assinaturas_institucionais_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          contexto: Json
          id: number
          ip: string | null
          ocorrido_em: string
          operacao: Database["public"]["Enums"]["operacao_auditoria"]
          registro_id: string | null
          tabela: string
          user_agent: string | null
          usuario_email: string | null
          usuario_id: string | null
          valor_anterior: Json | null
          valor_novo: Json | null
        }
        Insert: {
          contexto?: Json
          id?: number
          ip?: string | null
          ocorrido_em?: string
          operacao: Database["public"]["Enums"]["operacao_auditoria"]
          registro_id?: string | null
          tabela: string
          user_agent?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Update: {
          contexto?: Json
          id?: number
          ip?: string | null
          ocorrido_em?: string
          operacao?: Database["public"]["Enums"]["operacao_auditoria"]
          registro_id?: string | null
          tabela?: string
          user_agent?: string | null
          usuario_email?: string | null
          usuario_id?: string | null
          valor_anterior?: Json | null
          valor_novo?: Json | null
        }
        Relationships: []
      }
      calendario_institucional: {
        Row: {
          abrangencia: Database["public"]["Enums"]["abrangencia_calendario"]
          ato_normativo: string | null
          created_at: string
          created_by: string | null
          data: string
          deleted_at: string | null
          deleted_by: string | null
          descricao: string
          eh_recorrente: boolean
          id: string
          observacoes: string | null
          status: Database["public"]["Enums"]["status_entidade"]
          tipo: Database["public"]["Enums"]["tipo_data_calendario"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          abrangencia?: Database["public"]["Enums"]["abrangencia_calendario"]
          ato_normativo?: string | null
          created_at?: string
          created_by?: string | null
          data: string
          deleted_at?: string | null
          deleted_by?: string | null
          descricao: string
          eh_recorrente?: boolean
          id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_entidade"]
          tipo: Database["public"]["Enums"]["tipo_data_calendario"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          abrangencia?: Database["public"]["Enums"]["abrangencia_calendario"]
          ato_normativo?: string | null
          created_at?: string
          created_by?: string | null
          data?: string
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string
          eh_recorrente?: boolean
          id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_entidade"]
          tipo?: Database["public"]["Enums"]["tipo_data_calendario"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      cargos: {
        Row: {
          area_profissional: string | null
          base_legal: string | null
          carga_horaria_semanal: number | null
          cbo: string | null
          codigo: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string | null
          exige_conselho: boolean
          grupo_ocupacional: string | null
          id: string
          nivel: Database["public"]["Enums"]["nivel_cargo"] | null
          nome: string
          regulamentacao: string | null
          status: Database["public"]["Enums"]["status_entidade"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          area_profissional?: string | null
          base_legal?: string | null
          carga_horaria_semanal?: number | null
          cbo?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          exige_conselho?: boolean
          grupo_ocupacional?: string | null
          id?: string
          nivel?: Database["public"]["Enums"]["nivel_cargo"] | null
          nome: string
          regulamentacao?: string | null
          status?: Database["public"]["Enums"]["status_entidade"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          area_profissional?: string | null
          base_legal?: string | null
          carga_horaria_semanal?: number | null
          cbo?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          exige_conselho?: boolean
          grupo_ocupacional?: string | null
          id?: string
          nivel?: Database["public"]["Enums"]["nivel_cargo"] | null
          nome?: string
          regulamentacao?: string | null
          status?: Database["public"]["Enums"]["status_entidade"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      competencia_unidades: {
        Row: {
          competencia_id: string
          created_at: string
          created_by: string | null
          data_analise: string | null
          data_aprovacao: string | null
          data_envio: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          observacoes: string | null
          responsavel_id: string | null
          status: Database["public"]["Enums"]["status_competencia_unidade"]
          unidade_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          competencia_id: string
          created_at?: string
          created_by?: string | null
          data_analise?: string | null
          data_aprovacao?: string | null
          data_envio?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          observacoes?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_competencia_unidade"]
          unidade_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          competencia_id?: string
          created_at?: string
          created_by?: string | null
          data_analise?: string | null
          data_aprovacao?: string | null
          data_envio?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          observacoes?: string | null
          responsavel_id?: string | null
          status?: Database["public"]["Enums"]["status_competencia_unidade"]
          unidade_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competencia_unidades_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "competencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competencia_unidades_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "competencia_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      competencias: {
        Row: {
          ano: number
          created_at: string
          created_by: string | null
          data_fim: string
          data_inicio: string
          deleted_at: string | null
          deleted_by: string | null
          descricao: string | null
          id: string
          mes: number
          motivo_reabertura: string | null
          observacoes: string | null
          prazo_analise: string | null
          prazo_envio: string | null
          secretaria_id: string
          status: Database["public"]["Enums"]["status_competencia"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ano: number
          created_at?: string
          created_by?: string | null
          data_fim: string
          data_inicio: string
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          id?: string
          mes: number
          motivo_reabertura?: string | null
          observacoes?: string | null
          prazo_analise?: string | null
          prazo_envio?: string | null
          secretaria_id: string
          status?: Database["public"]["Enums"]["status_competencia"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ano?: number
          created_at?: string
          created_by?: string | null
          data_fim?: string
          data_inicio?: string
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          id?: string
          mes?: number
          motivo_reabertura?: string | null
          observacoes?: string | null
          prazo_analise?: string | null
          prazo_envio?: string | null
          secretaria_id?: string
          status?: Database["public"]["Enums"]["status_competencia"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "competencias_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
        ]
      }
      documento_categorias: {
        Row: {
          ativa: boolean
          codigo: string
          cor: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string | null
          escopo: string
          icone: string | null
          id: string
          nome: string
          ordem: number
          parent_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativa?: boolean
          codigo: string
          cor?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          escopo?: string
          icone?: string | null
          id?: string
          nome: string
          ordem?: number
          parent_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativa?: boolean
          codigo?: string
          cor?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          escopo?: string
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number
          parent_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documento_categorias_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "documento_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          categoria_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string | null
          entidade_id: string
          hash_sha256: string | null
          id: string
          metadata: Json
          mime_type: string | null
          nome: string
          secretaria_id: string | null
          storage_path: string
          tamanho_bytes: number | null
          tipo_entidade: Database["public"]["Enums"]["tipo_entidade_documento"]
          unidade_id: string | null
          updated_at: string
          updated_by: string | null
          versao: number
        }
        Insert: {
          categoria_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          entidade_id: string
          hash_sha256?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          nome: string
          secretaria_id?: string | null
          storage_path: string
          tamanho_bytes?: number | null
          tipo_entidade: Database["public"]["Enums"]["tipo_entidade_documento"]
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          versao?: number
        }
        Update: {
          categoria_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          entidade_id?: string
          hash_sha256?: string | null
          id?: string
          metadata?: Json
          mime_type?: string | null
          nome?: string
          secretaria_id?: string | null
          storage_path?: string
          tamanho_bytes?: number | null
          tipo_entidade?: Database["public"]["Enums"]["tipo_entidade_documento"]
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "documentos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "documento_categorias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_assinados: {
        Row: {
          assinado_em: string
          assinado_por: string | null
          assinado_por_nome: string | null
          created_at: string
          dados_json: Json
          descricao: string
          hash_conteudo: string
          id: string
          referencia_id: string | null
          tipo: string
        }
        Insert: {
          assinado_em?: string
          assinado_por?: string | null
          assinado_por_nome?: string | null
          created_at?: string
          dados_json?: Json
          descricao: string
          hash_conteudo: string
          id?: string
          referencia_id?: string | null
          tipo: string
        }
        Update: {
          assinado_em?: string
          assinado_por?: string | null
          assinado_por_nome?: string | null
          created_at?: string
          dados_json?: Json
          descricao?: string
          hash_conteudo?: string
          id?: string
          referencia_id?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "documentos_assinados_assinado_por_fkey"
            columns: ["assinado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos_dominio: {
        Row: {
          agregado: string
          agregado_id: string | null
          causation_id: string | null
          correlation_id: string
          created_at: string
          dados: Json
          emitido_por: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          processado_em: string | null
          proxima_tentativa_em: string | null
          status: string
          tentativas: number
          tipo: string
          ultimo_erro: string | null
          updated_at: string
          versao_evento: number
          worker_id: string | null
        }
        Insert: {
          agregado: string
          agregado_id?: string | null
          causation_id?: string | null
          correlation_id: string
          created_at?: string
          dados?: Json
          emitido_por?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          processado_em?: string | null
          proxima_tentativa_em?: string | null
          status?: string
          tentativas?: number
          tipo: string
          ultimo_erro?: string | null
          updated_at?: string
          versao_evento?: number
          worker_id?: string | null
        }
        Update: {
          agregado?: string
          agregado_id?: string | null
          causation_id?: string | null
          correlation_id?: string
          created_at?: string
          dados?: Json
          emitido_por?: string | null
          id?: string
          idempotency_key?: string | null
          metadata?: Json
          processado_em?: string | null
          proxima_tentativa_em?: string | null
          status?: string
          tentativas?: number
          tipo?: string
          ultimo_erro?: string | null
          updated_at?: string
          versao_evento?: number
          worker_id?: string | null
        }
        Relationships: []
      }
      frequencia_aprovacoes: {
        Row: {
          acao: string
          created_at: string
          created_by: string | null
          executado_por: string | null
          frequencia_id: string
          id: string
          observacoes: string | null
          status_anterior:
            | Database["public"]["Enums"]["status_frequencia"]
            | null
          status_novo: Database["public"]["Enums"]["status_frequencia"]
        }
        Insert: {
          acao: string
          created_at?: string
          created_by?: string | null
          executado_por?: string | null
          frequencia_id: string
          id?: string
          observacoes?: string | null
          status_anterior?:
            | Database["public"]["Enums"]["status_frequencia"]
            | null
          status_novo: Database["public"]["Enums"]["status_frequencia"]
        }
        Update: {
          acao?: string
          created_at?: string
          created_by?: string | null
          executado_por?: string | null
          frequencia_id?: string
          id?: string
          observacoes?: string | null
          status_anterior?:
            | Database["public"]["Enums"]["status_frequencia"]
            | null
          status_novo?: Database["public"]["Enums"]["status_frequencia"]
        }
        Relationships: [
          {
            foreignKeyName: "frequencia_aprovacoes_executado_por_fkey"
            columns: ["executado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_aprovacoes_frequencia_id_fkey"
            columns: ["frequencia_id"]
            isOneToOne: false
            referencedRelation: "frequencias"
            referencedColumns: ["id"]
          },
        ]
      }
      frequencia_pendencias: {
        Row: {
          aberta_por: string | null
          created_at: string
          created_by: string | null
          data_resolucao: string | null
          data_resposta: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string
          frequencia_id: string
          frequencia_profissional_id: string | null
          id: string
          resolvida_por: string | null
          respondida_por: string | null
          resposta: string | null
          status: Database["public"]["Enums"]["status_pendencia"]
          titulo: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aberta_por?: string | null
          created_at?: string
          created_by?: string | null
          data_resolucao?: string | null
          data_resposta?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao: string
          frequencia_id: string
          frequencia_profissional_id?: string | null
          id?: string
          resolvida_por?: string | null
          respondida_por?: string | null
          resposta?: string | null
          status?: Database["public"]["Enums"]["status_pendencia"]
          titulo: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aberta_por?: string | null
          created_at?: string
          created_by?: string | null
          data_resolucao?: string | null
          data_resposta?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string
          frequencia_id?: string
          frequencia_profissional_id?: string | null
          id?: string
          resolvida_por?: string | null
          respondida_por?: string | null
          resposta?: string | null
          status?: Database["public"]["Enums"]["status_pendencia"]
          titulo?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frequencia_pendencias_aberta_por_fkey"
            columns: ["aberta_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_pendencias_frequencia_id_fkey"
            columns: ["frequencia_id"]
            isOneToOne: false
            referencedRelation: "frequencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_pendencias_frequencia_profissional_id_fkey"
            columns: ["frequencia_profissional_id"]
            isOneToOne: false
            referencedRelation: "frequencia_profissional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_pendencias_resolvida_por_fkey"
            columns: ["resolvida_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_pendencias_respondida_por_fkey"
            columns: ["respondida_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      frequencia_profissional: {
        Row: {
          adicional_noturno: number
          afastamentos: number
          analisado_em: string | null
          analisado_por: string | null
          atestado: number
          aulas_suplementares: number
          carga_horaria_mensal: number | null
          cargo_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          detalhes: Json
          dias_trabalhados: number
          faltas_injustificadas: number
          faltas_justificadas: number
          ferias: number
          ferias_integral: number
          ferias_terco: number
          frequencia_id: string
          funcao_id: string | null
          he_100: number
          he_50: number
          horas_extras: number
          id: string
          incentivo: number
          licenca_premio: number
          licencas: number
          observacao_analise: string | null
          observacoes: string | null
          plantoes_extras: number
          profissional_id: string
          sal_sub_h: number
          sobreaviso: number
          status_linha: Database["public"]["Enums"]["status_linha_frequencia"]
          updated_at: string
          updated_by: string | null
          vinculo_id: string | null
        }
        Insert: {
          adicional_noturno?: number
          afastamentos?: number
          analisado_em?: string | null
          analisado_por?: string | null
          atestado?: number
          aulas_suplementares?: number
          carga_horaria_mensal?: number | null
          cargo_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          detalhes?: Json
          dias_trabalhados?: number
          faltas_injustificadas?: number
          faltas_justificadas?: number
          ferias?: number
          ferias_integral?: number
          ferias_terco?: number
          frequencia_id: string
          funcao_id?: string | null
          he_100?: number
          he_50?: number
          horas_extras?: number
          id?: string
          incentivo?: number
          licenca_premio?: number
          licencas?: number
          observacao_analise?: string | null
          observacoes?: string | null
          plantoes_extras?: number
          profissional_id: string
          sal_sub_h?: number
          sobreaviso?: number
          status_linha?: Database["public"]["Enums"]["status_linha_frequencia"]
          updated_at?: string
          updated_by?: string | null
          vinculo_id?: string | null
        }
        Update: {
          adicional_noturno?: number
          afastamentos?: number
          analisado_em?: string | null
          analisado_por?: string | null
          atestado?: number
          aulas_suplementares?: number
          carga_horaria_mensal?: number | null
          cargo_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          detalhes?: Json
          dias_trabalhados?: number
          faltas_injustificadas?: number
          faltas_justificadas?: number
          ferias?: number
          ferias_integral?: number
          ferias_terco?: number
          frequencia_id?: string
          funcao_id?: string | null
          he_100?: number
          he_50?: number
          horas_extras?: number
          id?: string
          incentivo?: number
          licenca_premio?: number
          licencas?: number
          observacao_analise?: string | null
          observacoes?: string | null
          plantoes_extras?: number
          profissional_id?: string
          sal_sub_h?: number
          sobreaviso?: number
          status_linha?: Database["public"]["Enums"]["status_linha_frequencia"]
          updated_at?: string
          updated_by?: string | null
          vinculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frequencia_profissional_analisado_por_fkey"
            columns: ["analisado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_profissional_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_profissional_frequencia_id_fkey"
            columns: ["frequencia_id"]
            isOneToOne: false
            referencedRelation: "frequencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_profissional_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_profissional_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_profissional_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vinculos"
            referencedColumns: ["id"]
          },
        ]
      }
      frequencias: {
        Row: {
          aprovada_por: string | null
          competencia_unidade_id: string
          created_at: string
          created_by: string | null
          data_aprovacao: string | null
          data_envio: string | null
          deleted_at: string | null
          deleted_by: string | null
          enviada_por: string | null
          id: string
          observacoes: string | null
          status: Database["public"]["Enums"]["status_frequencia"]
          tipo: Database["public"]["Enums"]["tipo_frequencia"]
          total_dias_trabalhados: number
          total_faltas: number
          total_horas_extras: number
          total_profissionais: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aprovada_por?: string | null
          competencia_unidade_id: string
          created_at?: string
          created_by?: string | null
          data_aprovacao?: string | null
          data_envio?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          enviada_por?: string | null
          id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_frequencia"]
          tipo: Database["public"]["Enums"]["tipo_frequencia"]
          total_dias_trabalhados?: number
          total_faltas?: number
          total_horas_extras?: number
          total_profissionais?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aprovada_por?: string | null
          competencia_unidade_id?: string
          created_at?: string
          created_by?: string | null
          data_aprovacao?: string | null
          data_envio?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          enviada_por?: string | null
          id?: string
          observacoes?: string | null
          status?: Database["public"]["Enums"]["status_frequencia"]
          tipo?: Database["public"]["Enums"]["tipo_frequencia"]
          total_dias_trabalhados?: number
          total_faltas?: number
          total_horas_extras?: number
          total_profissionais?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frequencias_aprovada_por_fkey"
            columns: ["aprovada_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencias_competencia_unidade_id_fkey"
            columns: ["competencia_unidade_id"]
            isOneToOne: false
            referencedRelation: "competencia_unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencias_enviada_por_fkey"
            columns: ["enviada_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      frequencias_contratados: {
        Row: {
          adn: number
          aprovada_em: string | null
          aprovada_por: string | null
          atestado: number
          competencia_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          dias_falta: number
          enviada_em: string | null
          enviada_por: string | null
          he_100: number
          he_50: number
          id: string
          incentivo: number
          observacoes: string | null
          plantoes: number
          profissional_id: string
          sobreaviso: number
          status: Database["public"]["Enums"]["status_frequencia"]
          unidade_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adn?: number
          aprovada_em?: string | null
          aprovada_por?: string | null
          atestado?: number
          competencia_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dias_falta?: number
          enviada_em?: string | null
          enviada_por?: string | null
          he_100?: number
          he_50?: number
          id?: string
          incentivo?: number
          observacoes?: string | null
          plantoes?: number
          profissional_id: string
          sobreaviso?: number
          status?: Database["public"]["Enums"]["status_frequencia"]
          unidade_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adn?: number
          aprovada_em?: string | null
          aprovada_por?: string | null
          atestado?: number
          competencia_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          dias_falta?: number
          enviada_em?: string | null
          enviada_por?: string | null
          he_100?: number
          he_50?: number
          id?: string
          incentivo?: number
          observacoes?: string | null
          plantoes?: number
          profissional_id?: string
          sobreaviso?: number
          status?: Database["public"]["Enums"]["status_frequencia"]
          unidade_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "frequencias_contratados_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "competencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencias_contratados_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencias_contratados_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      funcoes: {
        Row: {
          cargo_id: string | null
          codigo: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string | null
          gratificacao_percentual: number | null
          id: string
          nome: string
          status: Database["public"]["Enums"]["status_entidade"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cargo_id?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          gratificacao_percentual?: number | null
          id?: string
          nome: string
          status?: Database["public"]["Enums"]["status_entidade"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cargo_id?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          gratificacao_percentual?: number | null
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["status_entidade"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "funcoes_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
        ]
      }
      fundos: {
        Row: {
          cnpj: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string | null
          esfera: string | null
          id: string
          nome: string
          sigla: string | null
          status: Database["public"]["Enums"]["status_entidade"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          esfera?: string | null
          id?: string
          nome: string
          sigla?: string | null
          status?: Database["public"]["Enums"]["status_entidade"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          esfera?: string | null
          id?: string
          nome?: string
          sigla?: string | null
          status?: Database["public"]["Enums"]["status_entidade"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      historico_importacoes: {
        Row: {
          competencia: string | null
          created_at: string
          data_importacao: string
          id: string
          importado_por: string | null
          mapeamento: Json
          modelo: string
          nome_arquivo: string
          registros_divergentes: number
          registros_importados: number
          registros_nao_encontrados: number
          status: string
          tipo_arquivo: string
          total_registros: number
          updated_at: string
        }
        Insert: {
          competencia?: string | null
          created_at?: string
          data_importacao?: string
          id?: string
          importado_por?: string | null
          mapeamento?: Json
          modelo: string
          nome_arquivo: string
          registros_divergentes?: number
          registros_importados?: number
          registros_nao_encontrados?: number
          status?: string
          tipo_arquivo: string
          total_registros?: number
          updated_at?: string
        }
        Update: {
          competencia?: string | null
          created_at?: string
          data_importacao?: string
          id?: string
          importado_por?: string | null
          mapeamento?: Json
          modelo?: string
          nome_arquivo?: string
          registros_divergentes?: number
          registros_importados?: number
          registros_nao_encontrados?: number
          status?: string
          tipo_arquivo?: string
          total_registros?: number
          updated_at?: string
        }
        Relationships: []
      }
      municipio_config: {
        Row: {
          brasao_url: string | null
          cnpj_prefeitura: string | null
          codigo_ibge: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email_institucional: string | null
          endereco: Json | null
          gestor_cpf: string | null
          gestor_nome: string | null
          id: string
          logotipo_url: string | null
          nome_municipio: string
          parametros: Json
          razao_social: string | null
          secretaria_id: string | null
          secretario_saude_cpf: string | null
          secretario_saude_nome: string | null
          site_oficial: string | null
          status: Database["public"]["Enums"]["status_entidade"]
          telefone: string | null
          uf: string
          updated_at: string
          updated_by: string | null
          vice_gestor_cpf: string | null
          vice_gestor_nome: string | null
        }
        Insert: {
          brasao_url?: string | null
          cnpj_prefeitura?: string | null
          codigo_ibge?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email_institucional?: string | null
          endereco?: Json | null
          gestor_cpf?: string | null
          gestor_nome?: string | null
          id?: string
          logotipo_url?: string | null
          nome_municipio: string
          parametros?: Json
          razao_social?: string | null
          secretaria_id?: string | null
          secretario_saude_cpf?: string | null
          secretario_saude_nome?: string | null
          site_oficial?: string | null
          status?: Database["public"]["Enums"]["status_entidade"]
          telefone?: string | null
          uf: string
          updated_at?: string
          updated_by?: string | null
          vice_gestor_cpf?: string | null
          vice_gestor_nome?: string | null
        }
        Update: {
          brasao_url?: string | null
          cnpj_prefeitura?: string | null
          codigo_ibge?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email_institucional?: string | null
          endereco?: Json | null
          gestor_cpf?: string | null
          gestor_nome?: string | null
          id?: string
          logotipo_url?: string | null
          nome_municipio?: string
          parametros?: Json
          razao_social?: string | null
          secretaria_id?: string | null
          secretario_saude_cpf?: string | null
          secretario_saude_nome?: string | null
          site_oficial?: string | null
          status?: Database["public"]["Enums"]["status_entidade"]
          telefone?: string | null
          uf?: string
          updated_at?: string
          updated_by?: string | null
          vice_gestor_cpf?: string | null
          vice_gestor_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "municipio_config_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          canal: Database["public"]["Enums"]["canal_notificacao"]
          created_at: string
          created_by: string | null
          entidade_id: string | null
          entidade_tipo: string | null
          enviada: boolean
          enviada_em: string | null
          id: string
          lida: boolean
          lida_em: string | null
          link: string | null
          mensagem: string
          metadata: Json
          prioridade: Database["public"]["Enums"]["prioridade_notificacao"]
          tipo: Database["public"]["Enums"]["tipo_notificacao"]
          titulo: string
          updated_at: string
          usuario_id: string
        }
        Insert: {
          canal?: Database["public"]["Enums"]["canal_notificacao"]
          created_at?: string
          created_by?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          enviada?: boolean
          enviada_em?: string | null
          id?: string
          lida?: boolean
          lida_em?: string | null
          link?: string | null
          mensagem: string
          metadata?: Json
          prioridade?: Database["public"]["Enums"]["prioridade_notificacao"]
          tipo?: Database["public"]["Enums"]["tipo_notificacao"]
          titulo: string
          updated_at?: string
          usuario_id: string
        }
        Update: {
          canal?: Database["public"]["Enums"]["canal_notificacao"]
          created_at?: string
          created_by?: string | null
          entidade_id?: string | null
          entidade_tipo?: string | null
          enviada?: boolean
          enviada_em?: string | null
          id?: string
          lida?: boolean
          lida_em?: string | null
          link?: string | null
          mensagem?: string
          metadata?: Json
          prioridade?: Database["public"]["Enums"]["prioridade_notificacao"]
          tipo?: Database["public"]["Enums"]["tipo_notificacao"]
          titulo?: string
          updated_at?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      pendencia_historico: {
        Row: {
          acao: string
          autor_id: string | null
          comentario: string | null
          created_at: string
          evento_id: string | null
          id: string
          metadata: Json
          pendencia_id: string
          status_anterior:
            | Database["public"]["Enums"]["pendencia_status"]
            | null
          status_novo: Database["public"]["Enums"]["pendencia_status"] | null
        }
        Insert: {
          acao: string
          autor_id?: string | null
          comentario?: string | null
          created_at?: string
          evento_id?: string | null
          id?: string
          metadata?: Json
          pendencia_id: string
          status_anterior?:
            | Database["public"]["Enums"]["pendencia_status"]
            | null
          status_novo?: Database["public"]["Enums"]["pendencia_status"] | null
        }
        Update: {
          acao?: string
          autor_id?: string | null
          comentario?: string | null
          created_at?: string
          evento_id?: string | null
          id?: string
          metadata?: Json
          pendencia_id?: string
          status_anterior?:
            | Database["public"]["Enums"]["pendencia_status"]
            | null
          status_novo?: Database["public"]["Enums"]["pendencia_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "pendencia_historico_autor_id_fkey"
            columns: ["autor_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencia_historico_pendencia_id_fkey"
            columns: ["pendencia_id"]
            isOneToOne: false
            referencedRelation: "pendencias"
            referencedColumns: ["id"]
          },
        ]
      }
      pendencia_numeros: {
        Row: {
          ano: number
          secretaria_id: string
          ultimo: number
        }
        Insert: {
          ano: number
          secretaria_id: string
          ultimo?: number
        }
        Update: {
          ano?: number
          secretaria_id?: string
          ultimo?: number
        }
        Relationships: [
          {
            foreignKeyName: "pendencia_numeros_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
        ]
      }
      pendencias: {
        Row: {
          aberta_em: string
          cancelada_em: string | null
          categoria: Database["public"]["Enums"]["pendencia_categoria"]
          competencia_id: string | null
          competencia_unidade_id: string | null
          correlation_id: string
          created_at: string
          created_by: string | null
          dados: Json
          deleted_at: string | null
          deleted_by: string | null
          descricao: string | null
          frequencia_id: string | null
          frequencia_profissional_id: string | null
          id: string
          metadata: Json
          numero: string
          origem_entidade: string | null
          origem_id: string | null
          origem_tipo: string | null
          prazo: string | null
          prioridade: Database["public"]["Enums"]["pendencia_prioridade"]
          reabertura_em: string | null
          resolvida_em: string | null
          respondida_em: string | null
          responsavel_id: string | null
          secretaria_id: string | null
          sla_horas: number | null
          status: Database["public"]["Enums"]["pendencia_status"]
          titulo: string
          unidade_id: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          aberta_em?: string
          cancelada_em?: string | null
          categoria?: Database["public"]["Enums"]["pendencia_categoria"]
          competencia_id?: string | null
          competencia_unidade_id?: string | null
          correlation_id?: string
          created_at?: string
          created_by?: string | null
          dados?: Json
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          frequencia_id?: string | null
          frequencia_profissional_id?: string | null
          id?: string
          metadata?: Json
          numero: string
          origem_entidade?: string | null
          origem_id?: string | null
          origem_tipo?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["pendencia_prioridade"]
          reabertura_em?: string | null
          resolvida_em?: string | null
          respondida_em?: string | null
          responsavel_id?: string | null
          secretaria_id?: string | null
          sla_horas?: number | null
          status?: Database["public"]["Enums"]["pendencia_status"]
          titulo: string
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          aberta_em?: string
          cancelada_em?: string | null
          categoria?: Database["public"]["Enums"]["pendencia_categoria"]
          competencia_id?: string | null
          competencia_unidade_id?: string | null
          correlation_id?: string
          created_at?: string
          created_by?: string | null
          dados?: Json
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          frequencia_id?: string | null
          frequencia_profissional_id?: string | null
          id?: string
          metadata?: Json
          numero?: string
          origem_entidade?: string | null
          origem_id?: string | null
          origem_tipo?: string | null
          prazo?: string | null
          prioridade?: Database["public"]["Enums"]["pendencia_prioridade"]
          reabertura_em?: string | null
          resolvida_em?: string | null
          respondida_em?: string | null
          responsavel_id?: string | null
          secretaria_id?: string | null
          sla_horas?: number | null
          status?: Database["public"]["Enums"]["pendencia_status"]
          titulo?: string
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pendencias_competencia_id_fkey"
            columns: ["competencia_id"]
            isOneToOne: false
            referencedRelation: "competencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencias_competencia_unidade_id_fkey"
            columns: ["competencia_unidade_id"]
            isOneToOne: false
            referencedRelation: "competencia_unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencias_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencias_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencias_frequencia_id_fkey"
            columns: ["frequencia_id"]
            isOneToOne: false
            referencedRelation: "frequencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencias_frequencia_profissional_id_fkey"
            columns: ["frequencia_profissional_id"]
            isOneToOne: false
            referencedRelation: "frequencia_profissional"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencias_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencias_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencias_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pendencias_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_permissoes: {
        Row: {
          concedida: boolean
          created_at: string
          created_by: string | null
          perfil_id: string
          permissao_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          concedida?: boolean
          created_at?: string
          created_by?: string | null
          perfil_id: string
          permissao_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          concedida?: boolean
          created_at?: string
          created_by?: string | null
          perfil_id?: string
          permissao_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfil_permissoes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_permissoes_permissao_id_fkey"
            columns: ["permissao_id"]
            isOneToOne: false
            referencedRelation: "permissoes"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          admin_2fa_required: boolean
          codigo: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string | null
          id: string
          is_sistema: boolean
          nivel_hierarquico: number
          nome: string
          status: Database["public"]["Enums"]["status_entidade"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          admin_2fa_required?: boolean
          codigo: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          id?: string
          is_sistema?: boolean
          nivel_hierarquico?: number
          nome: string
          status?: Database["public"]["Enums"]["status_entidade"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          admin_2fa_required?: boolean
          codigo?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          id?: string
          is_sistema?: boolean
          nivel_hierarquico?: number
          nome?: string
          status?: Database["public"]["Enums"]["status_entidade"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      permissoes: {
        Row: {
          ativa: boolean
          categoria: Database["public"]["Enums"]["categoria_permissao"]
          codigo: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string | null
          id: string
          is_sistema: boolean
          modulo: Database["public"]["Enums"]["modulo_sistema"]
          nome: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          ativa?: boolean
          categoria: Database["public"]["Enums"]["categoria_permissao"]
          codigo: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          id?: string
          is_sistema?: boolean
          modulo: Database["public"]["Enums"]["modulo_sistema"]
          nome: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          ativa?: boolean
          categoria?: Database["public"]["Enums"]["categoria_permissao"]
          codigo?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          id?: string
          is_sistema?: boolean
          modulo?: Database["public"]["Enums"]["modulo_sistema"]
          nome?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      piso_enfermagem: {
        Row: {
          adicional_noturno: number | null
          auxilio_financeiro: number | null
          cargo: string | null
          competencia: string | null
          cpf: string | null
          created_at: string
          data_importacao: string
          ferias: number | null
          ferias_1_3: number | null
          gratificacao: number | null
          historico_id: string
          hora_extra_100: number | null
          hora_extra_50: number | null
          id: string
          importado_por: string | null
          insalubridade: number | null
          inss: number | null
          irrf: number | null
          matricula: string | null
          nome: string | null
          origem_arquivo: string | null
          piso_complementacao: number | null
          profissional_id: string | null
          salario_base: number | null
          setor: string | null
          status_match: string
          unidade: string | null
          updated_at: string
          valor_final: number | null
          valor_liquido: number | null
          vinculo: string | null
        }
        Insert: {
          adicional_noturno?: number | null
          auxilio_financeiro?: number | null
          cargo?: string | null
          competencia?: string | null
          cpf?: string | null
          created_at?: string
          data_importacao?: string
          ferias?: number | null
          ferias_1_3?: number | null
          gratificacao?: number | null
          historico_id: string
          hora_extra_100?: number | null
          hora_extra_50?: number | null
          id?: string
          importado_por?: string | null
          insalubridade?: number | null
          inss?: number | null
          irrf?: number | null
          matricula?: string | null
          nome?: string | null
          origem_arquivo?: string | null
          piso_complementacao?: number | null
          profissional_id?: string | null
          salario_base?: number | null
          setor?: string | null
          status_match?: string
          unidade?: string | null
          updated_at?: string
          valor_final?: number | null
          valor_liquido?: number | null
          vinculo?: string | null
        }
        Update: {
          adicional_noturno?: number | null
          auxilio_financeiro?: number | null
          cargo?: string | null
          competencia?: string | null
          cpf?: string | null
          created_at?: string
          data_importacao?: string
          ferias?: number | null
          ferias_1_3?: number | null
          gratificacao?: number | null
          historico_id?: string
          hora_extra_100?: number | null
          hora_extra_50?: number | null
          id?: string
          importado_por?: string | null
          insalubridade?: number | null
          inss?: number | null
          irrf?: number | null
          matricula?: string | null
          nome?: string | null
          origem_arquivo?: string | null
          piso_complementacao?: number | null
          profissional_id?: string | null
          salario_base?: number | null
          setor?: string | null
          status_match?: string
          unidade?: string | null
          updated_at?: string
          valor_final?: number | null
          valor_liquido?: number | null
          vinculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "piso_enfermagem_historico_id_fkey"
            columns: ["historico_id"]
            isOneToOne: false
            referencedRelation: "historico_importacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piso_enfermagem_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      piso_mapeamentos_salvos: {
        Row: {
          created_at: string
          criado_por: string | null
          id: string
          mapeamento: Json
          modelo: string
          nome: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criado_por?: string | null
          id?: string
          mapeamento?: Json
          modelo: string
          nome: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criado_por?: string | null
          id?: string
          mapeamento?: Json
          modelo?: string
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      profissionais: {
        Row: {
          agencia: string | null
          banco: string | null
          c_h: number | null
          carga_horaria_semanal: number | null
          cargo_id: string | null
          cns: string | null
          conselho_classe: string | null
          conselho_numero: string | null
          conselho_uf: string | null
          conselho_validade: string | null
          conta_corrente: string | null
          cpf: string
          created_at: string
          created_by: string | null
          data_admissao: string | null
          data_desligamento: string | null
          data_nascimento: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string | null
          endereco_completo: string | null
          foto_url: string | null
          funcao_id: string | null
          gestor_imediato_id: string | null
          h_p: number | null
          horas_previstas: number | null
          id: string
          jorn: number | null
          jornada: string | null
          matricula: string | null
          nome_completo: string
          nome_social: string | null
          observacoes: string | null
          pis_pasep: string | null
          proj: number | null
          projeto: string | null
          rg: string | null
          rg_orgao: string | null
          rg_uf: string | null
          secretaria_id: string
          setor_id: string | null
          sexo: string | null
          situacao_funcional:
            | Database["public"]["Enums"]["situacao_funcional"]
            | null
          status: Database["public"]["Enums"]["status_profissional"]
          telefone: string | null
          unidade_id: string | null
          updated_at: string
          updated_by: string | null
          vinculo_id: string | null
        }
        Insert: {
          agencia?: string | null
          banco?: string | null
          c_h?: number | null
          carga_horaria_semanal?: number | null
          cargo_id?: string | null
          cns?: string | null
          conselho_classe?: string | null
          conselho_numero?: string | null
          conselho_uf?: string | null
          conselho_validade?: string | null
          conta_corrente?: string | null
          cpf: string
          created_at?: string
          created_by?: string | null
          data_admissao?: string | null
          data_desligamento?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          endereco_completo?: string | null
          foto_url?: string | null
          funcao_id?: string | null
          gestor_imediato_id?: string | null
          h_p?: number | null
          horas_previstas?: number | null
          id?: string
          jorn?: number | null
          jornada?: string | null
          matricula?: string | null
          nome_completo: string
          nome_social?: string | null
          observacoes?: string | null
          pis_pasep?: string | null
          proj?: number | null
          projeto?: string | null
          rg?: string | null
          rg_orgao?: string | null
          rg_uf?: string | null
          secretaria_id: string
          setor_id?: string | null
          sexo?: string | null
          situacao_funcional?:
            | Database["public"]["Enums"]["situacao_funcional"]
            | null
          status?: Database["public"]["Enums"]["status_profissional"]
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vinculo_id?: string | null
        }
        Update: {
          agencia?: string | null
          banco?: string | null
          c_h?: number | null
          carga_horaria_semanal?: number | null
          cargo_id?: string | null
          cns?: string | null
          conselho_classe?: string | null
          conselho_numero?: string | null
          conselho_uf?: string | null
          conselho_validade?: string | null
          conta_corrente?: string | null
          cpf?: string
          created_at?: string
          created_by?: string | null
          data_admissao?: string | null
          data_desligamento?: string | null
          data_nascimento?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string | null
          endereco_completo?: string | null
          foto_url?: string | null
          funcao_id?: string | null
          gestor_imediato_id?: string | null
          h_p?: number | null
          horas_previstas?: number | null
          id?: string
          jorn?: number | null
          jornada?: string | null
          matricula?: string | null
          nome_completo?: string
          nome_social?: string | null
          observacoes?: string | null
          pis_pasep?: string | null
          proj?: number | null
          projeto?: string | null
          rg?: string | null
          rg_orgao?: string | null
          rg_uf?: string | null
          secretaria_id?: string
          setor_id?: string | null
          sexo?: string | null
          situacao_funcional?:
            | Database["public"]["Enums"]["situacao_funcional"]
            | null
          status?: Database["public"]["Enums"]["status_profissional"]
          telefone?: string | null
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vinculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profissionais_cargo_id_fkey"
            columns: ["cargo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissionais_funcao_id_fkey"
            columns: ["funcao_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissionais_gestor_imediato_id_fkey"
            columns: ["gestor_imediato_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissionais_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissionais_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissionais_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissionais_vinculo_id_fkey"
            columns: ["vinculo_id"]
            isOneToOne: false
            referencedRelation: "vinculos"
            referencedColumns: ["id"]
          },
        ]
      }
      profissional_historico_funcional: {
        Row: {
          carga_horaria_anterior: number | null
          carga_horaria_nova: number | null
          cargo_anterior_id: string | null
          cargo_novo_id: string | null
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          deleted_at: string | null
          deleted_by: string | null
          documento_referencia: string | null
          documento_url: string | null
          funcao_anterior_id: string | null
          funcao_novo_id: string | null
          id: string
          motivo: string | null
          observacoes: string | null
          profissional_id: string
          secretaria_anterior_id: string | null
          secretaria_novo_id: string | null
          setor_anterior_id: string | null
          setor_novo_id: string | null
          status_anterior:
            | Database["public"]["Enums"]["status_profissional"]
            | null
          status_novo: Database["public"]["Enums"]["status_profissional"] | null
          tipo_evento: Database["public"]["Enums"]["tipo_evento_funcional"]
          unidade_anterior_id: string | null
          unidade_novo_id: string | null
          updated_at: string
          updated_by: string | null
          vinculo_anterior_id: string | null
          vinculo_novo_id: string | null
        }
        Insert: {
          carga_horaria_anterior?: number | null
          carga_horaria_nova?: number | null
          cargo_anterior_id?: string | null
          cargo_novo_id?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio: string
          deleted_at?: string | null
          deleted_by?: string | null
          documento_referencia?: string | null
          documento_url?: string | null
          funcao_anterior_id?: string | null
          funcao_novo_id?: string | null
          id?: string
          motivo?: string | null
          observacoes?: string | null
          profissional_id: string
          secretaria_anterior_id?: string | null
          secretaria_novo_id?: string | null
          setor_anterior_id?: string | null
          setor_novo_id?: string | null
          status_anterior?:
            | Database["public"]["Enums"]["status_profissional"]
            | null
          status_novo?:
            | Database["public"]["Enums"]["status_profissional"]
            | null
          tipo_evento: Database["public"]["Enums"]["tipo_evento_funcional"]
          unidade_anterior_id?: string | null
          unidade_novo_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vinculo_anterior_id?: string | null
          vinculo_novo_id?: string | null
        }
        Update: {
          carga_horaria_anterior?: number | null
          carga_horaria_nova?: number | null
          cargo_anterior_id?: string | null
          cargo_novo_id?: string | null
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          deleted_at?: string | null
          deleted_by?: string | null
          documento_referencia?: string | null
          documento_url?: string | null
          funcao_anterior_id?: string | null
          funcao_novo_id?: string | null
          id?: string
          motivo?: string | null
          observacoes?: string | null
          profissional_id?: string
          secretaria_anterior_id?: string | null
          secretaria_novo_id?: string | null
          setor_anterior_id?: string | null
          setor_novo_id?: string | null
          status_anterior?:
            | Database["public"]["Enums"]["status_profissional"]
            | null
          status_novo?:
            | Database["public"]["Enums"]["status_profissional"]
            | null
          tipo_evento?: Database["public"]["Enums"]["tipo_evento_funcional"]
          unidade_anterior_id?: string | null
          unidade_novo_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vinculo_anterior_id?: string | null
          vinculo_novo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profissional_historico_funcional_cargo_anterior_id_fkey"
            columns: ["cargo_anterior_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_historico_funcional_cargo_novo_id_fkey"
            columns: ["cargo_novo_id"]
            isOneToOne: false
            referencedRelation: "cargos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_historico_funcional_funcao_anterior_id_fkey"
            columns: ["funcao_anterior_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_historico_funcional_funcao_novo_id_fkey"
            columns: ["funcao_novo_id"]
            isOneToOne: false
            referencedRelation: "funcoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_historico_funcional_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_historico_funcional_secretaria_anterior_id_fkey"
            columns: ["secretaria_anterior_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_historico_funcional_secretaria_novo_id_fkey"
            columns: ["secretaria_novo_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_historico_funcional_setor_anterior_id_fkey"
            columns: ["setor_anterior_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_historico_funcional_setor_novo_id_fkey"
            columns: ["setor_novo_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_historico_funcional_unidade_anterior_id_fkey"
            columns: ["unidade_anterior_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_historico_funcional_unidade_novo_id_fkey"
            columns: ["unidade_novo_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_historico_funcional_vinculo_anterior_id_fkey"
            columns: ["vinculo_anterior_id"]
            isOneToOne: false
            referencedRelation: "vinculos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profissional_historico_funcional_vinculo_novo_id_fkey"
            columns: ["vinculo_novo_id"]
            isOneToOne: false
            referencedRelation: "vinculos"
            referencedColumns: ["id"]
          },
        ]
      }
      secretarias: {
        Row: {
          cnpj: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          endereco: Json | null
          id: string
          nome: string
          observacoes: string | null
          responsavel_email: string | null
          responsavel_nome: string | null
          responsavel_telefone: string | null
          sigla: string | null
          status: Database["public"]["Enums"]["status_entidade"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          endereco?: Json | null
          id?: string
          nome: string
          observacoes?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          sigla?: string | null
          status?: Database["public"]["Enums"]["status_entidade"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          endereco?: Json | null
          id?: string
          nome?: string
          observacoes?: string | null
          responsavel_email?: string | null
          responsavel_nome?: string | null
          responsavel_telefone?: string | null
          sigla?: string | null
          status?: Database["public"]["Enums"]["status_entidade"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      setores: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string | null
          gestor_id: string | null
          id: string
          nome: string
          observacoes: string | null
          responsavel_cpf: string | null
          responsavel_nome: string | null
          sigla: string | null
          status: Database["public"]["Enums"]["status_entidade"]
          unidade_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          gestor_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          responsavel_cpf?: string | null
          responsavel_nome?: string | null
          sigla?: string | null
          status?: Database["public"]["Enums"]["status_entidade"]
          unidade_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          gestor_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          responsavel_cpf?: string | null
          responsavel_nome?: string | null
          sigla?: string | null
          status?: Database["public"]["Enums"]["status_entidade"]
          unidade_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "setores_gestor_id_fkey"
            columns: ["gestor_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "setores_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_unidade: {
        Row: {
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string | null
          id: string
          nome: string
          status: Database["public"]["Enums"]["status_entidade"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          id?: string
          nome: string
          status?: Database["public"]["Enums"]["status_entidade"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          status?: Database["public"]["Enums"]["status_entidade"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      unidades: {
        Row: {
          capacidade_atendimento: number | null
          cnes: string | null
          cnpj: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          distrito: string | null
          email_institucional: string | null
          endereco: Json | null
          horario_funcionamento: Json | null
          id: string
          latitude: number | null
          longitude: number | null
          municipio: string | null
          nivel_complexidade: string | null
          nome: string
          observacoes: string | null
          responsavel_cpf: string | null
          responsavel_nome: string | null
          secretaria_id: string
          sigla: string | null
          status: Database["public"]["Enums"]["status_entidade"]
          telefone: string | null
          tipo_atendimento: string | null
          tipo_unidade: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          capacidade_atendimento?: number | null
          cnes?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          distrito?: string | null
          email_institucional?: string | null
          endereco?: Json | null
          horario_funcionamento?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          municipio?: string | null
          nivel_complexidade?: string | null
          nome: string
          observacoes?: string | null
          responsavel_cpf?: string | null
          responsavel_nome?: string | null
          secretaria_id: string
          sigla?: string | null
          status?: Database["public"]["Enums"]["status_entidade"]
          telefone?: string | null
          tipo_atendimento?: string | null
          tipo_unidade?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          capacidade_atendimento?: number | null
          cnes?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          distrito?: string | null
          email_institucional?: string | null
          endereco?: Json | null
          horario_funcionamento?: Json | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          municipio?: string | null
          nivel_complexidade?: string | null
          nome?: string
          observacoes?: string | null
          responsavel_cpf?: string | null
          responsavel_nome?: string | null
          secretaria_id?: string
          sigla?: string | null
          status?: Database["public"]["Enums"]["status_entidade"]
          telefone?: string | null
          tipo_atendimento?: string | null
          tipo_unidade?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "unidades_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
        ]
      }
      uso_eventos: {
        Row: {
          contexto: Json
          created_at: string
          evento: string
          id: number
          perfil_codigo: string | null
          rota: string | null
          sessao_hash: string | null
        }
        Insert: {
          contexto?: Json
          created_at?: string
          evento: string
          id?: number
          perfil_codigo?: string | null
          rota?: string | null
          sessao_hash?: string | null
        }
        Update: {
          contexto?: Json
          created_at?: string
          evento?: string
          id?: number
          perfil_codigo?: string | null
          rota?: string | null
          sessao_hash?: string | null
        }
        Relationships: []
      }
      usuario_permissoes: {
        Row: {
          concedida_em: string
          concedida_por: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          motivo: string | null
          origem: Database["public"]["Enums"]["origem_permissao"]
          permissao_id: string
          secretaria_id: string | null
          tipo: Database["public"]["Enums"]["tipo_permissao_usuario"]
          unidade_id: string | null
          updated_at: string
          updated_by: string | null
          usuario_id: string
          valido_ate: string | null
          valido_de: string
        }
        Insert: {
          concedida_em?: string
          concedida_por?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          motivo?: string | null
          origem?: Database["public"]["Enums"]["origem_permissao"]
          permissao_id: string
          secretaria_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_permissao_usuario"]
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          usuario_id: string
          valido_ate?: string | null
          valido_de?: string
        }
        Update: {
          concedida_em?: string
          concedida_por?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          motivo?: string | null
          origem?: Database["public"]["Enums"]["origem_permissao"]
          permissao_id?: string
          secretaria_id?: string | null
          tipo?: Database["public"]["Enums"]["tipo_permissao_usuario"]
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          usuario_id?: string
          valido_ate?: string | null
          valido_de?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_permissoes_permissao_id_fkey"
            columns: ["permissao_id"]
            isOneToOne: false
            referencedRelation: "permissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_permissoes_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_permissoes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_permissoes_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_secretarias: {
        Row: {
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          deleted_at: string | null
          deleted_by: string | null
          is_principal: boolean
          motivo: string | null
          secretaria_id: string
          updated_at: string
          updated_by: string | null
          usuario_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          deleted_at?: string | null
          deleted_by?: string | null
          is_principal?: boolean
          motivo?: string | null
          secretaria_id: string
          updated_at?: string
          updated_by?: string | null
          usuario_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          deleted_at?: string | null
          deleted_by?: string | null
          is_principal?: boolean
          motivo?: string | null
          secretaria_id?: string
          updated_at?: string
          updated_by?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_secretarias_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_secretarias_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuario_unidades: {
        Row: {
          created_at: string
          created_by: string | null
          data_fim: string | null
          data_inicio: string
          deleted_at: string | null
          deleted_by: string | null
          is_principal: boolean
          motivo: string | null
          unidade_id: string
          updated_at: string
          updated_by: string | null
          usuario_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          deleted_at?: string | null
          deleted_by?: string | null
          is_principal?: boolean
          motivo?: string | null
          unidade_id: string
          updated_at?: string
          updated_by?: string | null
          usuario_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_fim?: string | null
          data_inicio?: string
          deleted_at?: string | null
          deleted_by?: string | null
          is_principal?: boolean
          motivo?: string | null
          unidade_id?: string
          updated_at?: string
          updated_by?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usuario_unidades_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuario_unidades_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          acesso_todas_secretarias: boolean
          acesso_todas_unidades: boolean
          cargo_descricao: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          email: string
          foto_url: string | null
          id: string
          mfa_backup_codes: Json
          nome_completo: string
          observacoes: string | null
          perfil_id: string | null
          profissional_id: string | null
          secretaria_id: string | null
          status: Database["public"]["Enums"]["status_usuario"]
          telefone: string | null
          ultimo_acesso_at: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          acesso_todas_secretarias?: boolean
          acesso_todas_unidades?: boolean
          cargo_descricao?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email: string
          foto_url?: string | null
          id: string
          mfa_backup_codes?: Json
          nome_completo: string
          observacoes?: string | null
          perfil_id?: string | null
          profissional_id?: string | null
          secretaria_id?: string | null
          status?: Database["public"]["Enums"]["status_usuario"]
          telefone?: string | null
          ultimo_acesso_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          acesso_todas_secretarias?: boolean
          acesso_todas_unidades?: boolean
          cargo_descricao?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          email?: string
          foto_url?: string | null
          id?: string
          mfa_backup_codes?: Json
          nome_completo?: string
          observacoes?: string | null
          perfil_id?: string | null
          profissional_id?: string | null
          secretaria_id?: string | null
          status?: Database["public"]["Enums"]["status_usuario"]
          telefone?: string | null
          ultimo_acesso_at?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usuarios_secretaria_id_fkey"
            columns: ["secretaria_id"]
            isOneToOne: false
            referencedRelation: "secretarias"
            referencedColumns: ["id"]
          },
        ]
      }
      vinculos: {
        Row: {
          base_legal: string | null
          categoria: string | null
          codigo: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string | null
          id: string
          natureza: Database["public"]["Enums"]["natureza_vinculo"] | null
          nome: string
          permite_acumulo: boolean
          requer_concurso: boolean
          status: Database["public"]["Enums"]["status_entidade"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_legal?: string | null
          categoria?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          id?: string
          natureza?: Database["public"]["Enums"]["natureza_vinculo"] | null
          nome: string
          permite_acumulo?: boolean
          requer_concurso?: boolean
          status?: Database["public"]["Enums"]["status_entidade"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_legal?: string | null
          categoria?: string | null
          codigo?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          id?: string
          natureza?: Database["public"]["Enums"]["natureza_vinculo"] | null
          nome?: string
          permite_acumulo?: boolean
          requer_concurso?: boolean
          status?: Database["public"]["Enums"]["status_entidade"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      documentos_assinados_publico: {
        Row: {
          assinado_em: string | null
          assinado_por_nome: string | null
          descricao: string | null
          hash_conteudo: string | null
          id: string | null
          tipo: string | null
        }
        Insert: {
          assinado_em?: string | null
          assinado_por_nome?: string | null
          descricao?: string | null
          hash_conteudo?: string | null
          id?: string | null
          tipo?: string | null
        }
        Update: {
          assinado_em?: string | null
          assinado_por_nome?: string | null
          descricao?: string | null
          hash_conteudo?: string | null
          id?: string | null
          tipo?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      ack_evento_dominio: { Args: { _id: string }; Returns: undefined }
      assinatura_dashboard: { Args: never; Returns: Json }
      assinatura_pendentes: {
        Args: never
        Returns: {
          dias_pendente: number
          email: string
          nome: string
          perfil_codigo: string
          perfil_nome: string
          unidade_id: string
          unidade_nome: string
          usuario_id: string
        }[]
      }
      claim_eventos_dominio: {
        Args: { _qtd?: number; _worker?: string }
        Returns: {
          agregado: string
          agregado_id: string | null
          causation_id: string | null
          correlation_id: string
          created_at: string
          dados: Json
          emitido_por: string | null
          id: string
          idempotency_key: string | null
          metadata: Json
          processado_em: string | null
          proxima_tentativa_em: string | null
          status: string
          tentativas: number
          tipo: string
          ultimo_erro: string | null
          updated_at: string
          versao_evento: number
          worker_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "eventos_dominio"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      descartar_evento_dominio: {
        Args: { _id: string; _motivo?: string }
        Returns: undefined
      }
      emit_evento: {
        Args: {
          _agregado: string
          _agregado_id: string
          _causation_id?: string
          _correlation_id?: string
          _dados?: Json
          _idempotency_key?: string
          _metadata?: Json
          _tipo: string
          _versao?: number
        }
        Returns: string
      }
      eventos_travados: { Args: { _limit?: number }; Returns: Json }
      get_assinaturas_documento: {
        Args: {
          _secretaria_id?: string
          _tipo_documento: string
          _unidade_id?: string
        }
        Returns: {
          assinatura_id: string
          escopo: string
          obrigatoria: boolean
          ordem: number
          perfil_codigo: string
          regra_id: string
          storage_path: string
          tipo_assinatura: Database["public"]["Enums"]["tipo_assinatura"]
          titular_cargo: string
          titular_nome: string
        }[]
      }
      get_my_permissions: { Args: never; Returns: string[] }
      get_my_user_context: {
        Args: never
        Returns: {
          acesso_todas_secretarias: boolean
          acesso_todas_unidades: boolean
          email: string
          id: string
          is_master: boolean
          nome_completo: string
          perfil_admin_2fa_required: boolean
          perfil_codigo: string
          perfil_id: string
          perfil_nome: string
          secretaria_id: string
          status: Database["public"]["Enums"]["status_usuario"]
        }[]
      }
      has_permission: {
        Args: {
          _codigo: string
          _secretaria_id?: string
          _unidade_id?: string
          _user_id: string
        }
        Returns: boolean
      }
      health_cron_jobs: { Args: never; Returns: Json }
      health_eventos_dominio: { Args: never; Returns: Json }
      health_pendencias_sla: { Args: never; Returns: Json }
      is_master: { Args: { _user_id: string }; Returns: boolean }
      log_client_action: {
        Args: {
          _acao: string
          _contexto?: Json
          _operacao: Database["public"]["Enums"]["operacao_auditoria"]
          _registro_id?: string
          _tabela?: string
          _user_agent?: string
        }
        Returns: number
      }
      nack_evento_dominio: {
        Args: { _erro: string; _id: string }
        Returns: undefined
      }
      notificar_assinatura_pendentes: { Args: never; Returns: number }
      proximo_numero_pendencia: {
        Args: { _secretaria_id: string }
        Returns: string
      }
      reprocessar_evento_dominio: { Args: { _id: string }; Returns: undefined }
      sla_pendencias_processar: {
        Args: never
        Returns: {
          escaladas: number
          proximas: number
          vencidas: number
        }[]
      }
      track_uso: {
        Args: { _contexto?: Json; _evento: string; _rota?: string }
        Returns: undefined
      }
      user_has_secretaria: {
        Args: { _secretaria_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_unit: {
        Args: { _unidade_id: string; _user_id: string }
        Returns: boolean
      }
      uso_metricas: { Args: { _dias?: number }; Returns: Json }
      usuario_pode_cadastrar_assinatura: {
        Args: { _user_id: string }
        Returns: boolean
      }
      verify_and_consume_backup_code: {
        Args: { _code: string }
        Returns: boolean
      }
    }
    Enums: {
      abrangencia_calendario: "municipal" | "estadual" | "nacional"
      canal_notificacao: "interno" | "email" | "sms" | "push"
      categoria_permissao:
        | "visualizacao"
        | "criacao"
        | "edicao"
        | "exclusao"
        | "aprovacao"
        | "exportacao"
        | "administracao"
        | "acao"
      modulo_sistema:
        | "dashboard"
        | "competencia"
        | "frequencia"
        | "relatorio"
        | "usuario"
        | "auditoria"
        | "configuracao"
        | "documento"
        | "notificacao"
        | "assinatura"
        | "profissional"
        | "unidade"
        | "secretaria"
        | "perfil"
        | "permissao"
        | "sistema"
        | "pendencia"
        | "piso"
      natureza_vinculo:
        | "efetivo"
        | "celetista"
        | "comissionado"
        | "temporario"
        | "terceirizado"
        | "estagiario"
        | "residente"
        | "voluntario"
      nivel_cargo:
        | "fundamental"
        | "medio"
        | "tecnico"
        | "superior"
        | "pos_graduacao"
      operacao_auditoria:
        | "insert"
        | "update"
        | "delete"
        | "login"
        | "logout"
        | "custom"
      origem_permissao: "perfil" | "individual" | "temporaria" | "delegada"
      pendencia_categoria:
        | "frequencia"
        | "documento"
        | "ponto"
        | "folha"
        | "geral"
      pendencia_prioridade: "baixa" | "media" | "alta" | "critica"
      pendencia_status:
        | "aberta"
        | "em_analise"
        | "aguardando_resposta"
        | "respondida"
        | "resolvida"
        | "reaberta"
        | "cancelada"
      prioridade_notificacao: "baixa" | "normal" | "alta" | "urgente"
      situacao_funcional:
        | "ativo"
        | "licenca"
        | "ferias"
        | "cedido"
        | "afastado"
        | "desligado"
      status_competencia:
        | "aberta"
        | "em_processamento"
        | "encerrada"
        | "arquivada"
      status_competencia_unidade:
        | "nao_iniciada"
        | "em_elaboracao"
        | "enviada"
        | "em_analise"
        | "com_pendencias"
        | "aprovada"
        | "rejeitada"
        | "arquivada"
      status_entidade: "ativa" | "inativa" | "suspensa" | "arquivada"
      status_frequencia:
        | "rascunho"
        | "enviada"
        | "em_analise"
        | "com_pendencias"
        | "aprovada"
        | "rejeitada"
        | "arquivada"
      status_linha_frequencia: "pendente" | "aprovada" | "rejeitada"
      status_pendencia: "aberta" | "respondida" | "resolvida" | "cancelada"
      status_profissional:
        | "ativo"
        | "afastado"
        | "ferias"
        | "licenca"
        | "desligado"
        | "inativo"
      status_usuario:
        | "ativo"
        | "inativo"
        | "bloqueado"
        | "suspenso"
        | "pendente"
      tipo_assinatura: "assinatura" | "carimbo" | "logo"
      tipo_data_calendario:
        | "feriado_nacional"
        | "feriado_estadual"
        | "feriado_municipal"
        | "ponto_facultativo"
        | "recesso"
        | "data_comemorativa"
      tipo_entidade_documento:
        | "frequencia"
        | "competencia"
        | "competencia_unidade"
        | "profissional"
        | "unidade"
        | "secretaria"
        | "outros"
      tipo_evento_funcional:
        | "admissao"
        | "transferencia"
        | "promocao"
        | "mudanca_cargo"
        | "mudanca_funcao"
        | "mudanca_vinculo"
        | "afastamento"
        | "retorno"
        | "ferias"
        | "licenca"
        | "desligamento"
        | "outro"
      tipo_frequencia: "contratados" | "efetivos"
      tipo_notificacao:
        | "info"
        | "sucesso"
        | "alerta"
        | "erro"
        | "pendencia"
        | "aprovacao"
        | "sistema"
      tipo_permissao_usuario: "concedida" | "revogada"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      abrangencia_calendario: ["municipal", "estadual", "nacional"],
      canal_notificacao: ["interno", "email", "sms", "push"],
      categoria_permissao: [
        "visualizacao",
        "criacao",
        "edicao",
        "exclusao",
        "aprovacao",
        "exportacao",
        "administracao",
        "acao",
      ],
      modulo_sistema: [
        "dashboard",
        "competencia",
        "frequencia",
        "relatorio",
        "usuario",
        "auditoria",
        "configuracao",
        "documento",
        "notificacao",
        "assinatura",
        "profissional",
        "unidade",
        "secretaria",
        "perfil",
        "permissao",
        "sistema",
        "pendencia",
        "piso",
      ],
      natureza_vinculo: [
        "efetivo",
        "celetista",
        "comissionado",
        "temporario",
        "terceirizado",
        "estagiario",
        "residente",
        "voluntario",
      ],
      nivel_cargo: [
        "fundamental",
        "medio",
        "tecnico",
        "superior",
        "pos_graduacao",
      ],
      operacao_auditoria: [
        "insert",
        "update",
        "delete",
        "login",
        "logout",
        "custom",
      ],
      origem_permissao: ["perfil", "individual", "temporaria", "delegada"],
      pendencia_categoria: [
        "frequencia",
        "documento",
        "ponto",
        "folha",
        "geral",
      ],
      pendencia_prioridade: ["baixa", "media", "alta", "critica"],
      pendencia_status: [
        "aberta",
        "em_analise",
        "aguardando_resposta",
        "respondida",
        "resolvida",
        "reaberta",
        "cancelada",
      ],
      prioridade_notificacao: ["baixa", "normal", "alta", "urgente"],
      situacao_funcional: [
        "ativo",
        "licenca",
        "ferias",
        "cedido",
        "afastado",
        "desligado",
      ],
      status_competencia: [
        "aberta",
        "em_processamento",
        "encerrada",
        "arquivada",
      ],
      status_competencia_unidade: [
        "nao_iniciada",
        "em_elaboracao",
        "enviada",
        "em_analise",
        "com_pendencias",
        "aprovada",
        "rejeitada",
        "arquivada",
      ],
      status_entidade: ["ativa", "inativa", "suspensa", "arquivada"],
      status_frequencia: [
        "rascunho",
        "enviada",
        "em_analise",
        "com_pendencias",
        "aprovada",
        "rejeitada",
        "arquivada",
      ],
      status_linha_frequencia: ["pendente", "aprovada", "rejeitada"],
      status_pendencia: ["aberta", "respondida", "resolvida", "cancelada"],
      status_profissional: [
        "ativo",
        "afastado",
        "ferias",
        "licenca",
        "desligado",
        "inativo",
      ],
      status_usuario: ["ativo", "inativo", "bloqueado", "suspenso", "pendente"],
      tipo_assinatura: ["assinatura", "carimbo", "logo"],
      tipo_data_calendario: [
        "feriado_nacional",
        "feriado_estadual",
        "feriado_municipal",
        "ponto_facultativo",
        "recesso",
        "data_comemorativa",
      ],
      tipo_entidade_documento: [
        "frequencia",
        "competencia",
        "competencia_unidade",
        "profissional",
        "unidade",
        "secretaria",
        "outros",
      ],
      tipo_evento_funcional: [
        "admissao",
        "transferencia",
        "promocao",
        "mudanca_cargo",
        "mudanca_funcao",
        "mudanca_vinculo",
        "afastamento",
        "retorno",
        "ferias",
        "licenca",
        "desligamento",
        "outro",
      ],
      tipo_frequencia: ["contratados", "efetivos"],
      tipo_notificacao: [
        "info",
        "sucesso",
        "alerta",
        "erro",
        "pendencia",
        "aprovacao",
        "sistema",
      ],
      tipo_permissao_usuario: ["concedida", "revogada"],
    },
  },
} as const
