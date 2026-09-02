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
          alinhamento: string
          ativa: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          id: string
          is_pessoal: boolean
          metadata: Json
          mime_type: string | null
          mostrar_cargo: boolean
          mostrar_nome: boolean
          obrigatoria: boolean
          ordem: number
          perfil_id: string | null
          posicao_x: number | null
          posicao_y: number | null
          secretaria_id: string | null
          storage_path: string
          tamanho_percentual: number
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
          alinhamento?: string
          ativa?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_pessoal?: boolean
          metadata?: Json
          mime_type?: string | null
          mostrar_cargo?: boolean
          mostrar_nome?: boolean
          obrigatoria?: boolean
          ordem?: number
          perfil_id?: string | null
          posicao_x?: number | null
          posicao_y?: number | null
          secretaria_id?: string | null
          storage_path: string
          tamanho_percentual?: number
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
          alinhamento?: string
          ativa?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string
          is_pessoal?: boolean
          metadata?: Json
          mime_type?: string | null
          mostrar_cargo?: boolean
          mostrar_nome?: boolean
          obrigatoria?: boolean
          ordem?: number
          perfil_id?: string | null
          posicao_x?: number | null
          posicao_y?: number | null
          secretaria_id?: string | null
          storage_path?: string
          tamanho_percentual?: number
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
      avisos_mural: {
        Row: {
          ativa_modo_manutencao: boolean | null
          ativo: boolean
          atualizado_em: string
          confirmacao_obrigatoria: boolean
          criado_em: string
          criado_por: string | null
          data_fim: string | null
          data_inicio: string
          destinatarios: Json
          email_enviado_em: string | null
          fixado: boolean
          id: string
          mensagem: string
          notificar_email: boolean | null
          previsao_termino: string | null
          prioridade: string
          subtitulo: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          ativa_modo_manutencao?: boolean | null
          ativo?: boolean
          atualizado_em?: string
          confirmacao_obrigatoria?: boolean
          criado_em?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          destinatarios?: Json
          email_enviado_em?: string | null
          fixado?: boolean
          id?: string
          mensagem: string
          notificar_email?: boolean | null
          previsao_termino?: string | null
          prioridade?: string
          subtitulo?: string | null
          tipo?: string
          titulo: string
        }
        Update: {
          ativa_modo_manutencao?: boolean | null
          ativo?: boolean
          atualizado_em?: string
          confirmacao_obrigatoria?: boolean
          criado_em?: string
          criado_por?: string | null
          data_fim?: string | null
          data_inicio?: string
          destinatarios?: Json
          email_enviado_em?: string | null
          fixado?: boolean
          id?: string
          mensagem?: string
          notificar_email?: boolean | null
          previsao_termino?: string | null
          prioridade?: string
          subtitulo?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      avisos_mural_anexos: {
        Row: {
          aviso_id: string
          bucket: string
          criado_em: string | null
          id: string
          mime: string
          nome: string
          path: string
          size: number
        }
        Insert: {
          aviso_id: string
          bucket?: string
          criado_em?: string | null
          id?: string
          mime: string
          nome: string
          path: string
          size: number
        }
        Update: {
          aviso_id?: string
          bucket?: string
          criado_em?: string | null
          id?: string
          mime?: string
          nome?: string
          path?: string
          size?: number
        }
        Relationships: [
          {
            foreignKeyName: "avisos_mural_anexos_aviso_id_fkey"
            columns: ["aviso_id"]
            isOneToOne: false
            referencedRelation: "avisos_mural"
            referencedColumns: ["id"]
          },
        ]
      }
      avisos_mural_leituras: {
        Row: {
          aviso_id: string
          confirmado: boolean
          id: string
          lido_em: string
          usuario_id: string
        }
        Insert: {
          aviso_id: string
          confirmado?: boolean
          id?: string
          lido_em?: string
          usuario_id: string
        }
        Update: {
          aviso_id?: string
          confirmado?: boolean
          id?: string
          lido_em?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avisos_mural_leituras_aviso_id_fkey"
            columns: ["aviso_id"]
            isOneToOne: false
            referencedRelation: "avisos_mural"
            referencedColumns: ["id"]
          },
        ]
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
      configuracoes_sistema: {
        Row: {
          chave: string
          created_at: string
          id: string
          smtp_ativo: boolean
          smtp_from_email: string | null
          smtp_from_name: string
          smtp_host: string | null
          smtp_password: string | null
          smtp_port: number
          smtp_secure: boolean
          smtp_user: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          chave?: string
          created_at?: string
          id?: string
          smtp_ativo?: boolean
          smtp_from_email?: string | null
          smtp_from_name?: string
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number
          smtp_secure?: boolean
          smtp_user?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          chave?: string
          created_at?: string
          id?: string
          smtp_ativo?: boolean
          smtp_from_email?: string | null
          smtp_from_name?: string
          smtp_host?: string | null
          smtp_password?: string | null
          smtp_port?: number
          smtp_secure?: boolean
          smtp_user?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "configuracoes_sistema_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "usuarios"
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
          purga_apos: string | null
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
          purga_apos?: string | null
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
          purga_apos?: string | null
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
          assinado_por_id: string | null
          cargo_assinante: string | null
          codigo_validacao: string
          created_at: string
          documento_tipo: string
          frequencia_id: string | null
          hash_sha256: string
          id: string
          ip_address: string | null
          metadata: Json | null
          nome_assinante: string
          user_agent: string | null
        }
        Insert: {
          assinado_em?: string
          assinado_por_id?: string | null
          cargo_assinante?: string | null
          codigo_validacao: string
          created_at?: string
          documento_tipo?: string
          frequencia_id?: string | null
          hash_sha256: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          nome_assinante: string
          user_agent?: string | null
        }
        Update: {
          assinado_em?: string
          assinado_por_id?: string | null
          cargo_assinante?: string | null
          codigo_validacao?: string
          created_at?: string
          documento_tipo?: string
          frequencia_id?: string | null
          hash_sha256?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          nome_assinante?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_assinados_frequencia_id_fkey"
            columns: ["frequencia_id"]
            isOneToOne: false
            referencedRelation: "frequencias"
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
      frequencia_assinaturas_snapshot: {
        Row: {
          acao: string
          alinhamento: string | null
          assinatura_id: string | null
          created_at: string
          frequencia_id: string
          id: string
          metadata: Json | null
          posicao_x: number | null
          posicao_y: number | null
          storage_path: string | null
          tamanho_percentual: number | null
          titular_cargo: string | null
          titular_nome: string
          usuario_id: string
        }
        Insert: {
          acao: string
          alinhamento?: string | null
          assinatura_id?: string | null
          created_at?: string
          frequencia_id: string
          id?: string
          metadata?: Json | null
          posicao_x?: number | null
          posicao_y?: number | null
          storage_path?: string | null
          tamanho_percentual?: number | null
          titular_cargo?: string | null
          titular_nome: string
          usuario_id: string
        }
        Update: {
          acao?: string
          alinhamento?: string | null
          assinatura_id?: string | null
          created_at?: string
          frequencia_id?: string
          id?: string
          metadata?: Json | null
          posicao_x?: number | null
          posicao_y?: number | null
          storage_path?: string | null
          tamanho_percentual?: number | null
          titular_cargo?: string | null
          titular_nome?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "frequencia_assinaturas_snapshot_assinatura_id_fkey"
            columns: ["assinatura_id"]
            isOneToOne: false
            referencedRelation: "assinaturas_institucionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_assinaturas_snapshot_frequencia_id_fkey"
            columns: ["frequencia_id"]
            isOneToOne: false
            referencedRelation: "frequencias"
            referencedColumns: ["id"]
          },
        ]
      }
      frequencia_historico: {
        Row: {
          acao: string
          created_at: string
          executado_nome: string | null
          executado_perfil: string | null
          executado_por: string | null
          frequencia_id: string
          id: string
          justificativa: string | null
          status_anterior:
            | Database["public"]["Enums"]["status_frequencia"]
            | null
          status_novo: Database["public"]["Enums"]["status_frequencia"]
        }
        Insert: {
          acao: string
          created_at?: string
          executado_nome?: string | null
          executado_perfil?: string | null
          executado_por?: string | null
          frequencia_id: string
          id?: string
          justificativa?: string | null
          status_anterior?:
            | Database["public"]["Enums"]["status_frequencia"]
            | null
          status_novo: Database["public"]["Enums"]["status_frequencia"]
        }
        Update: {
          acao?: string
          created_at?: string
          executado_nome?: string | null
          executado_perfil?: string | null
          executado_por?: string | null
          frequencia_id?: string
          id?: string
          justificativa?: string | null
          status_anterior?:
            | Database["public"]["Enums"]["status_frequencia"]
            | null
          status_novo?: Database["public"]["Enums"]["status_frequencia"]
        }
        Relationships: [
          {
            foreignKeyName: "frequencia_historico_frequencia_id_fkey"
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
      frequencia_pendencias_linhas: {
        Row: {
          aberto_em: string
          aberto_por: string | null
          frequencia_id: string
          id: string
          motivo_pendencia: string
          profissional_id: string
          resolvido_em: string | null
          resolvido_por: string | null
          rubrica: string | null
          status: Database["public"]["Enums"]["status_pendencia"]
        }
        Insert: {
          aberto_em?: string
          aberto_por?: string | null
          frequencia_id: string
          id?: string
          motivo_pendencia: string
          profissional_id: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          rubrica?: string | null
          status?: Database["public"]["Enums"]["status_pendencia"]
        }
        Update: {
          aberto_em?: string
          aberto_por?: string | null
          frequencia_id?: string
          id?: string
          motivo_pendencia?: string
          profissional_id?: string
          resolvido_em?: string | null
          resolvido_por?: string | null
          rubrica?: string | null
          status?: Database["public"]["Enums"]["status_pendencia"]
        }
        Relationships: [
          {
            foreignKeyName: "frequencia_pendencias_linhas_frequencia_id_fkey"
            columns: ["frequencia_id"]
            isOneToOne: false
            referencedRelation: "frequencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "frequencia_pendencias_linhas_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      frequencia_profissional: {
        Row: {
          adicional_noturno: string | null
          afastamentos: string | null
          analisado_em: string | null
          analisado_por: string | null
          aprovada_em: string | null
          aprovada_por: string | null
          atestado: string | null
          aulas_suplementares: string | null
          carga_horaria_mensal: string | null
          cargo_id: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          detalhes: Json
          dias_trabalhados: string | null
          faltas_injustificadas: string | null
          faltas_justificadas: string | null
          ferias: string | null
          ferias_integral: string | null
          ferias_terco: string | null
          frequencia_id: string
          funcao_id: string | null
          he_100: string | null
          he_50: string | null
          horas_extras: string | null
          id: string
          incentivo: string | null
          licenca_premio: string | null
          licencas: string | null
          observacao_analise: string | null
          observacoes: string | null
          plantoes_extras: string | null
          profissional_id: string
          sal_sub_h: string | null
          sobreaviso: string | null
          status_linha: Database["public"]["Enums"]["status_linha_frequencia"]
          updated_at: string
          updated_by: string | null
          vinculo_id: string | null
        }
        Insert: {
          adicional_noturno?: string | null
          afastamentos?: string | null
          analisado_em?: string | null
          analisado_por?: string | null
          aprovada_em?: string | null
          aprovada_por?: string | null
          atestado?: string | null
          aulas_suplementares?: string | null
          carga_horaria_mensal?: string | null
          cargo_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          detalhes?: Json
          dias_trabalhados?: string | null
          faltas_injustificadas?: string | null
          faltas_justificadas?: string | null
          ferias?: string | null
          ferias_integral?: string | null
          ferias_terco?: string | null
          frequencia_id: string
          funcao_id?: string | null
          he_100?: string | null
          he_50?: string | null
          horas_extras?: string | null
          id?: string
          incentivo?: string | null
          licenca_premio?: string | null
          licencas?: string | null
          observacao_analise?: string | null
          observacoes?: string | null
          plantoes_extras?: string | null
          profissional_id: string
          sal_sub_h?: string | null
          sobreaviso?: string | null
          status_linha?: Database["public"]["Enums"]["status_linha_frequencia"]
          updated_at?: string
          updated_by?: string | null
          vinculo_id?: string | null
        }
        Update: {
          adicional_noturno?: string | null
          afastamentos?: string | null
          analisado_em?: string | null
          analisado_por?: string | null
          aprovada_em?: string | null
          aprovada_por?: string | null
          atestado?: string | null
          aulas_suplementares?: string | null
          carga_horaria_mensal?: string | null
          cargo_id?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          detalhes?: Json
          dias_trabalhados?: string | null
          faltas_injustificadas?: string | null
          faltas_justificadas?: string | null
          ferias?: string | null
          ferias_integral?: string | null
          ferias_terco?: string | null
          frequencia_id?: string
          funcao_id?: string | null
          he_100?: string | null
          he_50?: string | null
          horas_extras?: string | null
          id?: string
          incentivo?: string | null
          licenca_premio?: string | null
          licencas?: string | null
          observacao_analise?: string | null
          observacoes?: string | null
          plantoes_extras?: string | null
          profissional_id?: string
          sal_sub_h?: string | null
          sobreaviso?: string | null
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
            foreignKeyName: "frequencia_profissional_aprovada_por_fkey"
            columns: ["aprovada_por"]
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
      frequencia_profissional_backup_20260813: {
        Row: {
          adicional_noturno: string | null
          afastamentos: string | null
          analisado_em: string | null
          analisado_por: string | null
          atestado: string | null
          aulas_suplementares: number | null
          carga_horaria_mensal: string | null
          cargo_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          detalhes: Json | null
          dias_trabalhados: string | null
          faltas_injustificadas: string | null
          faltas_justificadas: string | null
          ferias: string | null
          ferias_integral: string | null
          ferias_terco: string | null
          frequencia_id: string | null
          funcao_id: string | null
          he_100: string | null
          he_50: string | null
          horas_extras: string | null
          id: string | null
          incentivo: string | null
          licenca_premio: string | null
          licencas: string | null
          observacao_analise: string | null
          observacoes: string | null
          plantoes_extras: string | null
          profissional_id: string | null
          sal_sub_h: string | null
          sobreaviso: string | null
          status_linha:
            | Database["public"]["Enums"]["status_linha_frequencia"]
            | null
          updated_at: string | null
          updated_by: string | null
          vinculo_id: string | null
        }
        Insert: {
          adicional_noturno?: string | null
          afastamentos?: string | null
          analisado_em?: string | null
          analisado_por?: string | null
          atestado?: string | null
          aulas_suplementares?: number | null
          carga_horaria_mensal?: string | null
          cargo_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          detalhes?: Json | null
          dias_trabalhados?: string | null
          faltas_injustificadas?: string | null
          faltas_justificadas?: string | null
          ferias?: string | null
          ferias_integral?: string | null
          ferias_terco?: string | null
          frequencia_id?: string | null
          funcao_id?: string | null
          he_100?: string | null
          he_50?: string | null
          horas_extras?: string | null
          id?: string | null
          incentivo?: string | null
          licenca_premio?: string | null
          licencas?: string | null
          observacao_analise?: string | null
          observacoes?: string | null
          plantoes_extras?: string | null
          profissional_id?: string | null
          sal_sub_h?: string | null
          sobreaviso?: string | null
          status_linha?:
            | Database["public"]["Enums"]["status_linha_frequencia"]
            | null
          updated_at?: string | null
          updated_by?: string | null
          vinculo_id?: string | null
        }
        Update: {
          adicional_noturno?: string | null
          afastamentos?: string | null
          analisado_em?: string | null
          analisado_por?: string | null
          atestado?: string | null
          aulas_suplementares?: number | null
          carga_horaria_mensal?: string | null
          cargo_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          detalhes?: Json | null
          dias_trabalhados?: string | null
          faltas_injustificadas?: string | null
          faltas_justificadas?: string | null
          ferias?: string | null
          ferias_integral?: string | null
          ferias_terco?: string | null
          frequencia_id?: string | null
          funcao_id?: string | null
          he_100?: string | null
          he_50?: string | null
          horas_extras?: string | null
          id?: string | null
          incentivo?: string | null
          licenca_premio?: string | null
          licencas?: string | null
          observacao_analise?: string | null
          observacoes?: string | null
          plantoes_extras?: string | null
          profissional_id?: string | null
          sal_sub_h?: string | null
          sobreaviso?: string | null
          status_linha?:
            | Database["public"]["Enums"]["status_linha_frequencia"]
            | null
          updated_at?: string | null
          updated_by?: string | null
          vinculo_id?: string | null
        }
        Relationships: []
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
          setor_id: string | null
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
          setor_id?: string | null
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
          setor_id?: string | null
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
          {
            foreignKeyName: "frequencias_setor_id_fkey"
            columns: ["setor_id"]
            isOneToOne: false
            referencedRelation: "setores"
            referencedColumns: ["id"]
          },
        ]
      }
      frequencias_contratados: {
        Row: {
          adn: string | null
          aprovada_em: string | null
          aprovada_por: string | null
          atestado: string | null
          competencia_id: string
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          devolvida_em: string | null
          devolvida_por: string | null
          dias_falta: string | null
          dias_trabalhados: string | null
          enviada_em: string | null
          enviada_por: string | null
          he_100: string | null
          he_50: string | null
          id: string
          incentivo: string | null
          justificativa_devolucao: string | null
          observacoes: string | null
          plantoes: string | null
          profissional_id: string
          sobreaviso: string | null
          status: Database["public"]["Enums"]["status_frequencia"]
          unidade_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          adn?: string | null
          aprovada_em?: string | null
          aprovada_por?: string | null
          atestado?: string | null
          competencia_id: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          devolvida_em?: string | null
          devolvida_por?: string | null
          dias_falta?: string | null
          dias_trabalhados?: string | null
          enviada_em?: string | null
          enviada_por?: string | null
          he_100?: string | null
          he_50?: string | null
          id?: string
          incentivo?: string | null
          justificativa_devolucao?: string | null
          observacoes?: string | null
          plantoes?: string | null
          profissional_id: string
          sobreaviso?: string | null
          status?: Database["public"]["Enums"]["status_frequencia"]
          unidade_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          adn?: string | null
          aprovada_em?: string | null
          aprovada_por?: string | null
          atestado?: string | null
          competencia_id?: string
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          devolvida_em?: string | null
          devolvida_por?: string | null
          dias_falta?: string | null
          dias_trabalhados?: string | null
          enviada_em?: string | null
          enviada_por?: string | null
          he_100?: string | null
          he_50?: string | null
          id?: string
          incentivo?: string | null
          justificativa_devolucao?: string | null
          observacoes?: string | null
          plantoes?: string | null
          profissional_id?: string
          sobreaviso?: string | null
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
      frequencias_contratados_backup_20260813: {
        Row: {
          adn: string | null
          aprovada_em: string | null
          aprovada_por: string | null
          atestado: string | null
          competencia_id: string | null
          created_at: string | null
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          devolvida_em: string | null
          devolvida_por: string | null
          dias_falta: string | null
          dias_trabalhados: string | null
          enviada_em: string | null
          enviada_por: string | null
          he_100: string | null
          he_50: string | null
          id: string | null
          incentivo: string | null
          justificativa_devolucao: string | null
          observacoes: string | null
          plantoes: string | null
          profissional_id: string | null
          sobreaviso: string | null
          status: Database["public"]["Enums"]["status_frequencia"] | null
          unidade_id: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          adn?: string | null
          aprovada_em?: string | null
          aprovada_por?: string | null
          atestado?: string | null
          competencia_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          devolvida_em?: string | null
          devolvida_por?: string | null
          dias_falta?: string | null
          dias_trabalhados?: string | null
          enviada_em?: string | null
          enviada_por?: string | null
          he_100?: string | null
          he_50?: string | null
          id?: string | null
          incentivo?: string | null
          justificativa_devolucao?: string | null
          observacoes?: string | null
          plantoes?: string | null
          profissional_id?: string | null
          sobreaviso?: string | null
          status?: Database["public"]["Enums"]["status_frequencia"] | null
          unidade_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          adn?: string | null
          aprovada_em?: string | null
          aprovada_por?: string | null
          atestado?: string | null
          competencia_id?: string | null
          created_at?: string | null
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          devolvida_em?: string | null
          devolvida_por?: string | null
          dias_falta?: string | null
          dias_trabalhados?: string | null
          enviada_em?: string | null
          enviada_por?: string | null
          he_100?: string | null
          he_50?: string | null
          id?: string | null
          incentivo?: string | null
          justificativa_devolucao?: string | null
          observacoes?: string | null
          plantoes?: string | null
          profissional_id?: string | null
          sobreaviso?: string | null
          status?: Database["public"]["Enums"]["status_frequencia"] | null
          unidade_id?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
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
          duracao_ms: number | null
          id: string
          importado_por: string | null
          mapeamento: Json
          modelo: string
          modelo_planilha_id: string | null
          nome_arquivo: string
          registros_atualizados: number
          registros_divergentes: number
          registros_importados: number
          registros_nao_encontrados: number
          registros_pendencias: number
          status: string
          tipo_arquivo: string
          tipo_planilha: string | null
          total_registros: number
          updated_at: string
        }
        Insert: {
          competencia?: string | null
          created_at?: string
          data_importacao?: string
          duracao_ms?: number | null
          id?: string
          importado_por?: string | null
          mapeamento?: Json
          modelo: string
          modelo_planilha_id?: string | null
          nome_arquivo: string
          registros_atualizados?: number
          registros_divergentes?: number
          registros_importados?: number
          registros_nao_encontrados?: number
          registros_pendencias?: number
          status?: string
          tipo_arquivo: string
          tipo_planilha?: string | null
          total_registros?: number
          updated_at?: string
        }
        Update: {
          competencia?: string | null
          created_at?: string
          data_importacao?: string
          duracao_ms?: number | null
          id?: string
          importado_por?: string | null
          mapeamento?: Json
          modelo?: string
          modelo_planilha_id?: string | null
          nome_arquivo?: string
          registros_atualizados?: number
          registros_divergentes?: number
          registros_importados?: number
          registros_nao_encontrados?: number
          registros_pendencias?: number
          status?: string
          tipo_arquivo?: string
          tipo_planilha?: string | null
          total_registros?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "historico_importacoes_modelo_planilha_id_fkey"
            columns: ["modelo_planilha_id"]
            isOneToOne: false
            referencedRelation: "planilha_modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      hsm_auditoria: {
        Row: {
          acao: string | null
          agente: string | null
          cache_hit: boolean
          contexto: Json
          conversa_id: string | null
          created_at: string
          custo_usd: number
          duracao_ms: number | null
          erro: string | null
          ferramenta: string | null
          id: number
          modelo: string | null
          provedor: string | null
          sucesso: boolean
          tokens: number
          tokens_entrada: number
          tokens_saida: number
          user_id: string
        }
        Insert: {
          acao?: string | null
          agente?: string | null
          cache_hit?: boolean
          contexto?: Json
          conversa_id?: string | null
          created_at?: string
          custo_usd?: number
          duracao_ms?: number | null
          erro?: string | null
          ferramenta?: string | null
          id?: number
          modelo?: string | null
          provedor?: string | null
          sucesso?: boolean
          tokens?: number
          tokens_entrada?: number
          tokens_saida?: number
          user_id?: string
        }
        Update: {
          acao?: string | null
          agente?: string | null
          cache_hit?: boolean
          contexto?: Json
          conversa_id?: string | null
          created_at?: string
          custo_usd?: number
          duracao_ms?: number | null
          erro?: string | null
          ferramenta?: string | null
          id?: number
          modelo?: string | null
          provedor?: string | null
          sucesso?: boolean
          tokens?: number
          tokens_entrada?: number
          tokens_saida?: number
          user_id?: string
        }
        Relationships: []
      }
      hsm_config: {
        Row: {
          agentes_habilitados: Json
          ativo: boolean
          cache_config: Json
          created_at: string
          ferramentas_habilitadas: Json
          id: boolean
          limites: Json
          metadata: Json
          modo_execucao: string
          observabilidade_config: Json
          prompt_sistema: string
          retencao_config: Json
          somente_leitura: boolean
          updated_at: string
        }
        Insert: {
          agentes_habilitados?: Json
          ativo?: boolean
          cache_config?: Json
          created_at?: string
          ferramentas_habilitadas?: Json
          id?: boolean
          limites?: Json
          metadata?: Json
          modo_execucao?: string
          observabilidade_config?: Json
          prompt_sistema?: string
          retencao_config?: Json
          somente_leitura?: boolean
          updated_at?: string
        }
        Update: {
          agentes_habilitados?: Json
          ativo?: boolean
          cache_config?: Json
          created_at?: string
          ferramentas_habilitadas?: Json
          id?: boolean
          limites?: Json
          metadata?: Json
          modo_execucao?: string
          observabilidade_config?: Json
          prompt_sistema?: string
          retencao_config?: Json
          somente_leitura?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      hsm_conversas: {
        Row: {
          agente: string | null
          arquivada: boolean
          created_at: string
          favorito: boolean
          id: string
          modelo: string | null
          titulo: string
          tokens: number
          updated_at: string
          user_id: string
        }
        Insert: {
          agente?: string | null
          arquivada?: boolean
          created_at?: string
          favorito?: boolean
          id?: string
          modelo?: string | null
          titulo?: string
          tokens?: number
          updated_at?: string
          user_id?: string
        }
        Update: {
          agente?: string | null
          arquivada?: boolean
          created_at?: string
          favorito?: boolean
          id?: string
          modelo?: string | null
          titulo?: string
          tokens?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hsm_feedback: {
        Row: {
          comentario: string | null
          created_at: string
          id: string
          mensagem_id: string
          user_id: string
          util: boolean
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          id?: string
          mensagem_id: string
          user_id?: string
          util: boolean
        }
        Update: {
          comentario?: string | null
          created_at?: string
          id?: string
          mensagem_id?: string
          user_id?: string
          util?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "hsm_feedback_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "hsm_mensagens"
            referencedColumns: ["id"]
          },
        ]
      }
      hsm_mensagens: {
        Row: {
          conteudo: string
          conversa_id: string
          created_at: string
          duracao_ms: number | null
          erro: string | null
          ferramentas: Json
          id: string
          modelo: string | null
          papel: string
          partes: Json
          provedor: string | null
          tokens: number
          user_id: string
        }
        Insert: {
          conteudo?: string
          conversa_id: string
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          ferramentas?: Json
          id?: string
          modelo?: string | null
          papel: string
          partes?: Json
          provedor?: string | null
          tokens?: number
          user_id?: string
        }
        Update: {
          conteudo?: string
          conversa_id?: string
          created_at?: string
          duracao_ms?: number | null
          erro?: string | null
          ferramentas?: Json
          id?: string
          modelo?: string | null
          papel?: string
          partes?: Json
          provedor?: string | null
          tokens?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hsm_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "hsm_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      import_alias_sugestoes: {
        Row: {
          alias: string
          alias_norm: string
          campo_interno: string
          confirmacoes: number
          created_at: string
          criado_por: string | null
          id: string
          modulo: string
          origem: string
          status: string
          updated_at: string
          usuarios: string[]
        }
        Insert: {
          alias: string
          alias_norm: string
          campo_interno: string
          confirmacoes?: number
          created_at?: string
          criado_por?: string | null
          id?: string
          modulo?: string
          origem?: string
          status?: string
          updated_at?: string
          usuarios?: string[]
        }
        Update: {
          alias?: string
          alias_norm?: string
          campo_interno?: string
          confirmacoes?: number
          created_at?: string
          criado_por?: string | null
          id?: string
          modulo?: string
          origem?: string
          status?: string
          updated_at?: string
          usuarios?: string[]
        }
        Relationships: []
      }
      import_campo_aliases: {
        Row: {
          alias: string
          ativo: boolean
          campo_interno: string
          created_at: string
          criado_por: string | null
          id: string
          modulo: string
          origem: string
          peso: number
          ultimo_uso: string | null
          usos: number
        }
        Insert: {
          alias: string
          ativo?: boolean
          campo_interno: string
          created_at?: string
          criado_por?: string | null
          id?: string
          modulo?: string
          origem?: string
          peso?: number
          ultimo_uso?: string | null
          usos?: number
        }
        Update: {
          alias?: string
          ativo?: boolean
          campo_interno?: string
          created_at?: string
          criado_por?: string | null
          id?: string
          modulo?: string
          origem?: string
          peso?: number
          ultimo_uso?: string | null
          usos?: number
        }
        Relationships: []
      }
      import_layout_campos: {
        Row: {
          aliases: string[]
          campo_interno: string
          coluna_padrao: string | null
          condicional: boolean
          created_at: string
          id: string
          ignorado: boolean
          label: string | null
          obrigatorio: boolean
          ordem: number
          pesos: Json
          tipo_dado: string
          updated_at: string
          versao_id: string
        }
        Insert: {
          aliases?: string[]
          campo_interno: string
          coluna_padrao?: string | null
          condicional?: boolean
          created_at?: string
          id?: string
          ignorado?: boolean
          label?: string | null
          obrigatorio?: boolean
          ordem?: number
          pesos?: Json
          tipo_dado?: string
          updated_at?: string
          versao_id: string
        }
        Update: {
          aliases?: string[]
          campo_interno?: string
          coluna_padrao?: string | null
          condicional?: boolean
          created_at?: string
          id?: string
          ignorado?: boolean
          label?: string | null
          obrigatorio?: boolean
          ordem?: number
          pesos?: Json
          tipo_dado?: string
          updated_at?: string
          versao_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_layout_campos_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "import_layout_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      import_layout_uso: {
        Row: {
          competencia: string | null
          created_at: string
          detalhes: Json
          duracao_ms: number | null
          historico_id: string | null
          id: string
          layout_codigo: string | null
          layout_id: string | null
          modulo: string
          nome_arquivo: string | null
          total_linhas: number
          usuario_id: string
          versao: number | null
          versao_id: string | null
        }
        Insert: {
          competencia?: string | null
          created_at?: string
          detalhes?: Json
          duracao_ms?: number | null
          historico_id?: string | null
          id?: string
          layout_codigo?: string | null
          layout_id?: string | null
          modulo?: string
          nome_arquivo?: string | null
          total_linhas?: number
          usuario_id?: string
          versao?: number | null
          versao_id?: string | null
        }
        Update: {
          competencia?: string | null
          created_at?: string
          detalhes?: Json
          duracao_ms?: number | null
          historico_id?: string | null
          id?: string
          layout_codigo?: string | null
          layout_id?: string | null
          modulo?: string
          nome_arquivo?: string | null
          total_linhas?: number
          usuario_id?: string
          versao?: number | null
          versao_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_layout_uso_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "import_layouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_layout_uso_versao_id_fkey"
            columns: ["versao_id"]
            isOneToOne: false
            referencedRelation: "import_layout_versoes"
            referencedColumns: ["id"]
          },
        ]
      }
      import_layout_versoes: {
        Row: {
          arquivo_hints: string[]
          config: Json
          created_at: string
          criado_por: string | null
          header_hints: string[]
          id: string
          layout_id: string
          notas: string | null
          regras: Json
          situacao: string
          updated_at: string
          versao: number
        }
        Insert: {
          arquivo_hints?: string[]
          config?: Json
          created_at?: string
          criado_por?: string | null
          header_hints?: string[]
          id?: string
          layout_id: string
          notas?: string | null
          regras?: Json
          situacao?: string
          updated_at?: string
          versao: number
        }
        Update: {
          arquivo_hints?: string[]
          config?: Json
          created_at?: string
          criado_por?: string | null
          header_hints?: string[]
          id?: string
          layout_id?: string
          notas?: string | null
          regras?: Json
          situacao?: string
          updated_at?: string
          versao?: number
        }
        Relationships: [
          {
            foreignKeyName: "import_layout_versoes_layout_id_fkey"
            columns: ["layout_id"]
            isOneToOne: false
            referencedRelation: "import_layouts"
            referencedColumns: ["id"]
          },
        ]
      }
      import_layouts: {
        Row: {
          ativo: boolean
          classificacao: string
          codigo: string
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          modulo: string
          nome: string
          tipo: string
          updated_at: string
          versao_atual: number
        }
        Insert: {
          ativo?: boolean
          classificacao?: string
          codigo: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          modulo?: string
          nome: string
          tipo?: string
          updated_at?: string
          versao_atual?: number
        }
        Update: {
          ativo?: boolean
          classificacao?: string
          codigo?: string
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          modulo?: string
          nome?: string
          tipo?: string
          updated_at?: string
          versao_atual?: number
        }
        Relationships: []
      }
      logs_notificacoes: {
        Row: {
          assunto: string
          data_envio: string | null
          destinatario: string
          detalhe_erro: string | null
          id: string
          status: string
        }
        Insert: {
          assunto: string
          data_envio?: string | null
          destinatario: string
          detalhe_erro?: string | null
          id?: string
          status: string
        }
        Update: {
          assunto?: string
          data_envio?: string | null
          destinatario?: string
          detalhe_erro?: string | null
          id?: string
          status?: string
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
          deleted_at: string | null
          perfil_id: string
          permissao_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          concedida?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          perfil_id: string
          permissao_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          concedida?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
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
      perfil_permissoes_unidade: {
        Row: {
          concedida: boolean
          created_at: string
          created_by: string | null
          deleted_at: string | null
          perfil_id: string
          permissao_id: string
          unidade_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          concedida: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          perfil_id: string
          permissao_id: string
          unidade_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          concedida?: boolean
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          perfil_id?: string
          permissao_id?: string
          unidade_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "perfil_permissoes_unidade_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_permissoes_unidade_permissao_id_fkey"
            columns: ["permissao_id"]
            isOneToOne: false
            referencedRelation: "permissoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perfil_permissoes_unidade_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
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
      piso_competencia_profissional: {
        Row: {
          auxilio_financeiro: number | null
          carga_horaria_semanal: number | null
          cargo_id: string | null
          cargo_nome: string | null
          categoria: string | null
          competencia: string
          complementacao: number | null
          consolidado_em: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          divergencia: boolean
          divergencia_detalhe: string | null
          divergencia_valor: number | null
          gratificacoes: number | null
          historico_id_fopag: string | null
          historico_id_piso: string | null
          hora_extra_100: number | null
          hora_extra_50: number | null
          id: string
          inconsistencias: Json
          insalubridade: number | null
          inss: number | null
          irrf: number | null
          matricula: string | null
          nome: string | null
          origem_folha_arquivo: string | null
          origem_folha_em: string | null
          origem_folha_layout: string | null
          origem_folha_usuario: string | null
          origem_fopag: boolean
          origem_piso: boolean
          origem_piso_arquivo: string | null
          origem_piso_em: string | null
          origem_piso_layout: string | null
          origem_piso_usuario: string | null
          plantao: number | null
          profissional_id: string
          salario_base: number | null
          setor_id: string | null
          setor_nome: string | null
          situacao_funcional: string | null
          sobreaviso: number | null
          status_consolidacao: string
          status_importacao: string
          tempo_servico: number | null
          total_descontos: number | null
          total_proventos: number | null
          total_remuneracao: number | null
          unidade_id: string | null
          unidade_nome: string | null
          updated_at: string
          updated_by: string | null
          vale_transporte: number | null
          valor_liquido: number | null
          valor_referencia: number | null
          vinculo_id: string | null
          vinculo_nome: string | null
        }
        Insert: {
          auxilio_financeiro?: number | null
          carga_horaria_semanal?: number | null
          cargo_id?: string | null
          cargo_nome?: string | null
          categoria?: string | null
          competencia: string
          complementacao?: number | null
          consolidado_em?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          divergencia?: boolean
          divergencia_detalhe?: string | null
          divergencia_valor?: number | null
          gratificacoes?: number | null
          historico_id_fopag?: string | null
          historico_id_piso?: string | null
          hora_extra_100?: number | null
          hora_extra_50?: number | null
          id?: string
          inconsistencias?: Json
          insalubridade?: number | null
          inss?: number | null
          irrf?: number | null
          matricula?: string | null
          nome?: string | null
          origem_folha_arquivo?: string | null
          origem_folha_em?: string | null
          origem_folha_layout?: string | null
          origem_folha_usuario?: string | null
          origem_fopag?: boolean
          origem_piso?: boolean
          origem_piso_arquivo?: string | null
          origem_piso_em?: string | null
          origem_piso_layout?: string | null
          origem_piso_usuario?: string | null
          plantao?: number | null
          profissional_id: string
          salario_base?: number | null
          setor_id?: string | null
          setor_nome?: string | null
          situacao_funcional?: string | null
          sobreaviso?: number | null
          status_consolidacao?: string
          status_importacao?: string
          tempo_servico?: number | null
          total_descontos?: number | null
          total_proventos?: number | null
          total_remuneracao?: number | null
          unidade_id?: string | null
          unidade_nome?: string | null
          updated_at?: string
          updated_by?: string | null
          vale_transporte?: number | null
          valor_liquido?: number | null
          valor_referencia?: number | null
          vinculo_id?: string | null
          vinculo_nome?: string | null
        }
        Update: {
          auxilio_financeiro?: number | null
          carga_horaria_semanal?: number | null
          cargo_id?: string | null
          cargo_nome?: string | null
          categoria?: string | null
          competencia?: string
          complementacao?: number | null
          consolidado_em?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          divergencia?: boolean
          divergencia_detalhe?: string | null
          divergencia_valor?: number | null
          gratificacoes?: number | null
          historico_id_fopag?: string | null
          historico_id_piso?: string | null
          hora_extra_100?: number | null
          hora_extra_50?: number | null
          id?: string
          inconsistencias?: Json
          insalubridade?: number | null
          inss?: number | null
          irrf?: number | null
          matricula?: string | null
          nome?: string | null
          origem_folha_arquivo?: string | null
          origem_folha_em?: string | null
          origem_folha_layout?: string | null
          origem_folha_usuario?: string | null
          origem_fopag?: boolean
          origem_piso?: boolean
          origem_piso_arquivo?: string | null
          origem_piso_em?: string | null
          origem_piso_layout?: string | null
          origem_piso_usuario?: string | null
          plantao?: number | null
          profissional_id?: string
          salario_base?: number | null
          setor_id?: string | null
          setor_nome?: string | null
          situacao_funcional?: string | null
          sobreaviso?: number | null
          status_consolidacao?: string
          status_importacao?: string
          tempo_servico?: number | null
          total_descontos?: number | null
          total_proventos?: number | null
          total_remuneracao?: number | null
          unidade_id?: string | null
          unidade_nome?: string | null
          updated_at?: string
          updated_by?: string | null
          vale_transporte?: number | null
          valor_liquido?: number | null
          valor_referencia?: number | null
          vinculo_id?: string | null
          vinculo_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "piso_competencia_profissional_historico_id_fopag_fkey"
            columns: ["historico_id_fopag"]
            isOneToOne: false
            referencedRelation: "historico_importacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piso_competencia_profissional_historico_id_piso_fkey"
            columns: ["historico_id_piso"]
            isOneToOne: false
            referencedRelation: "historico_importacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piso_competencia_profissional_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      piso_consolidado: {
        Row: {
          cargo: string | null
          categoria_enfermagem: string | null
          competencia: string
          complementacao_calculada: number | null
          cpf: string
          created_at: string | null
          diferenca_ajustar: number | null
          divergencia: boolean | null
          gratificacoes: number | null
          historico_id: string | null
          id: string
          insalubridade: number | null
          matricula: string | null
          metadata: Json | null
          nome: string
          piso_complementacao: number | null
          piso_devido: number | null
          salario_base: number | null
          status: string | null
          tempo_servico: number | null
          unidade: string | null
          updated_at: string | null
        }
        Insert: {
          cargo?: string | null
          categoria_enfermagem?: string | null
          competencia: string
          complementacao_calculada?: number | null
          cpf: string
          created_at?: string | null
          diferenca_ajustar?: number | null
          divergencia?: boolean | null
          gratificacoes?: number | null
          historico_id?: string | null
          id?: string
          insalubridade?: number | null
          matricula?: string | null
          metadata?: Json | null
          nome: string
          piso_complementacao?: number | null
          piso_devido?: number | null
          salario_base?: number | null
          status?: string | null
          tempo_servico?: number | null
          unidade?: string | null
          updated_at?: string | null
        }
        Update: {
          cargo?: string | null
          categoria_enfermagem?: string | null
          competencia?: string
          complementacao_calculada?: number | null
          cpf?: string
          created_at?: string | null
          diferenca_ajustar?: number | null
          divergencia?: boolean | null
          gratificacoes?: number | null
          historico_id?: string | null
          id?: string
          insalubridade?: number | null
          matricula?: string | null
          metadata?: Json | null
          nome?: string
          piso_complementacao?: number | null
          piso_devido?: number | null
          salario_base?: number | null
          status?: string | null
          tempo_servico?: number | null
          unidade?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "piso_consolidado_historico_id_fkey"
            columns: ["historico_id"]
            isOneToOne: false
            referencedRelation: "historico_importacoes"
            referencedColumns: ["id"]
          },
        ]
      }
      piso_enfermagem: {
        Row: {
          adicional_noturno: number | null
          auxilio_financeiro: number | null
          auxilio_transporte: number | null
          cargo: string | null
          competencia: string | null
          conta_bancaria: string | null
          cpf: string | null
          created_at: string
          dados_origem: Json
          data_importacao: string
          dias_trabalhados: number | null
          ferias: number | null
          ferias_1_3: number | null
          gratificacao: number | null
          gratificacao_incentivo: number | null
          historico_id: string
          hora_extra_100: number | null
          hora_extra_50: number | null
          id: string
          importado_por: string | null
          incentivo: number | null
          insalubridade: number | null
          inss: number | null
          irrf: number | null
          iss: number | null
          matricula: string | null
          nome: string | null
          origem_arquivo: string | null
          piso_complementacao: number | null
          plantao: number | null
          profissional_id: string | null
          salario_base: number | null
          setor: string | null
          sobreaviso: number | null
          status_match: string
          total_liquido_base: number | null
          unidade: string | null
          updated_at: string
          valor_final: number | null
          valor_liquido: number | null
          vinculo: string | null
        }
        Insert: {
          adicional_noturno?: number | null
          auxilio_financeiro?: number | null
          auxilio_transporte?: number | null
          cargo?: string | null
          competencia?: string | null
          conta_bancaria?: string | null
          cpf?: string | null
          created_at?: string
          dados_origem?: Json
          data_importacao?: string
          dias_trabalhados?: number | null
          ferias?: number | null
          ferias_1_3?: number | null
          gratificacao?: number | null
          gratificacao_incentivo?: number | null
          historico_id: string
          hora_extra_100?: number | null
          hora_extra_50?: number | null
          id?: string
          importado_por?: string | null
          incentivo?: number | null
          insalubridade?: number | null
          inss?: number | null
          irrf?: number | null
          iss?: number | null
          matricula?: string | null
          nome?: string | null
          origem_arquivo?: string | null
          piso_complementacao?: number | null
          plantao?: number | null
          profissional_id?: string | null
          salario_base?: number | null
          setor?: string | null
          sobreaviso?: number | null
          status_match?: string
          total_liquido_base?: number | null
          unidade?: string | null
          updated_at?: string
          valor_final?: number | null
          valor_liquido?: number | null
          vinculo?: string | null
        }
        Update: {
          adicional_noturno?: number | null
          auxilio_financeiro?: number | null
          auxilio_transporte?: number | null
          cargo?: string | null
          competencia?: string | null
          conta_bancaria?: string | null
          cpf?: string | null
          created_at?: string
          dados_origem?: Json
          data_importacao?: string
          dias_trabalhados?: number | null
          ferias?: number | null
          ferias_1_3?: number | null
          gratificacao?: number | null
          gratificacao_incentivo?: number | null
          historico_id?: string
          hora_extra_100?: number | null
          hora_extra_50?: number | null
          id?: string
          importado_por?: string | null
          incentivo?: number | null
          insalubridade?: number | null
          inss?: number | null
          irrf?: number | null
          iss?: number | null
          matricula?: string | null
          nome?: string | null
          origem_arquivo?: string | null
          piso_complementacao?: number | null
          plantao?: number | null
          profissional_id?: string | null
          salario_base?: number | null
          setor?: string | null
          sobreaviso?: number | null
          status_match?: string
          total_liquido_base?: number | null
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
      piso_extracao_config: {
        Row: {
          created_at: string
          ia_api_key: string | null
          ia_fornecedor: string
          ia_habilitada: boolean
          ia_modelo: string
          id: boolean
          motor: string
          ocr_idioma: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          ia_api_key?: string | null
          ia_fornecedor?: string
          ia_habilitada?: boolean
          ia_modelo?: string
          id?: boolean
          motor?: string
          ocr_idioma?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          ia_api_key?: string | null
          ia_fornecedor?: string
          ia_habilitada?: boolean
          ia_modelo?: string
          id?: boolean
          motor?: string
          ocr_idioma?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      piso_ia_config: {
        Row: {
          atualizado_em: string
          id: boolean
          modo: string
          provedor_id: string | null
        }
        Insert: {
          atualizado_em?: string
          id?: boolean
          modo?: string
          provedor_id?: string | null
        }
        Update: {
          atualizado_em?: string
          id?: boolean
          modo?: string
          provedor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "piso_ia_config_provedor_id_fkey"
            columns: ["provedor_id"]
            isOneToOne: false
            referencedRelation: "piso_ia_provedores"
            referencedColumns: ["id"]
          },
        ]
      }
      piso_ia_provedores: {
        Row: {
          api_key: string | null
          ativo: boolean
          atualizado_em: string
          base_url: string | null
          confianca_n: number
          confianca_soma: number
          criado_em: string
          erros_429: number
          erros_503: number
          execucoes: number
          extra: Json
          falhas: number
          id: string
          modelo: string
          nome: string
          pdfs: number
          prioridade: number
          sucessos: number
          tempo_max_ms: number | null
          tempo_min_ms: number | null
          tempo_total_ms: number
          tentativas: number
          timeout_ms: number
          timeouts: number
          tipo: string
          ultima_utilizacao: string | null
          ultimo_erro: string | null
        }
        Insert: {
          api_key?: string | null
          ativo?: boolean
          atualizado_em?: string
          base_url?: string | null
          confianca_n?: number
          confianca_soma?: number
          criado_em?: string
          erros_429?: number
          erros_503?: number
          execucoes?: number
          extra?: Json
          falhas?: number
          id?: string
          modelo?: string
          nome: string
          pdfs?: number
          prioridade?: number
          sucessos?: number
          tempo_max_ms?: number | null
          tempo_min_ms?: number | null
          tempo_total_ms?: number
          tentativas?: number
          timeout_ms?: number
          timeouts?: number
          tipo: string
          ultima_utilizacao?: string | null
          ultimo_erro?: string | null
        }
        Update: {
          api_key?: string | null
          ativo?: boolean
          atualizado_em?: string
          base_url?: string | null
          confianca_n?: number
          confianca_soma?: number
          criado_em?: string
          erros_429?: number
          erros_503?: number
          execucoes?: number
          extra?: Json
          falhas?: number
          id?: string
          modelo?: string
          nome?: string
          pdfs?: number
          prioridade?: number
          sucessos?: number
          tempo_max_ms?: number | null
          tempo_min_ms?: number | null
          tempo_total_ms?: number
          tentativas?: number
          timeout_ms?: number
          timeouts?: number
          tipo?: string
          ultima_utilizacao?: string | null
          ultimo_erro?: string | null
        }
        Relationships: []
      }
      piso_importacoes_linhas: {
        Row: {
          aux_fin_piso: number | null
          cargo: string | null
          cargo_exibido: string | null
          categoria_enfermagem: string | null
          competencia: string
          cpf: string
          created_at: string | null
          grat_funcao_pvb: number | null
          grat_funcao_vr: number | null
          grat_nivel_superior: number | null
          historico_id: string | null
          horas_mensais: number | null
          id: string
          insalubridade: number | null
          matricula: string | null
          nome: string | null
          salario_base: number | null
          tempo_servico: number | null
        }
        Insert: {
          aux_fin_piso?: number | null
          cargo?: string | null
          cargo_exibido?: string | null
          categoria_enfermagem?: string | null
          competencia: string
          cpf: string
          created_at?: string | null
          grat_funcao_pvb?: number | null
          grat_funcao_vr?: number | null
          grat_nivel_superior?: number | null
          historico_id?: string | null
          horas_mensais?: number | null
          id?: string
          insalubridade?: number | null
          matricula?: string | null
          nome?: string | null
          salario_base?: number | null
          tempo_servico?: number | null
        }
        Update: {
          aux_fin_piso?: number | null
          cargo?: string | null
          cargo_exibido?: string | null
          categoria_enfermagem?: string | null
          competencia?: string
          cpf?: string
          created_at?: string | null
          grat_funcao_pvb?: number | null
          grat_funcao_vr?: number | null
          grat_nivel_superior?: number | null
          historico_id?: string | null
          horas_mensais?: number | null
          id?: string
          insalubridade?: number | null
          matricula?: string | null
          nome?: string | null
          salario_base?: number | null
          tempo_servico?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "piso_importacoes_linhas_historico_id_fkey"
            columns: ["historico_id"]
            isOneToOne: false
            referencedRelation: "historico_importacoes"
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
      piso_pendencias: {
        Row: {
          cargo: string | null
          competencia: string | null
          cpf: string | null
          created_at: string
          created_by: string | null
          detalhe: string | null
          historico_id: string | null
          id: string
          matricula: string | null
          nome: string | null
          origem_arquivo: string | null
          profissional_id: string | null
          resolvida: boolean
          tipo: string
          updated_at: string
        }
        Insert: {
          cargo?: string | null
          competencia?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          detalhe?: string | null
          historico_id?: string | null
          id?: string
          matricula?: string | null
          nome?: string | null
          origem_arquivo?: string | null
          profissional_id?: string | null
          resolvida?: boolean
          tipo: string
          updated_at?: string
        }
        Update: {
          cargo?: string | null
          competencia?: string | null
          cpf?: string | null
          created_at?: string
          created_by?: string | null
          detalhe?: string | null
          historico_id?: string | null
          id?: string
          matricula?: string | null
          nome?: string | null
          origem_arquivo?: string | null
          profissional_id?: string | null
          resolvida?: boolean
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "piso_pendencias_historico_id_fkey"
            columns: ["historico_id"]
            isOneToOne: false
            referencedRelation: "historico_importacoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "piso_pendencias_profissional_id_fkey"
            columns: ["profissional_id"]
            isOneToOne: false
            referencedRelation: "profissionais"
            referencedColumns: ["id"]
          },
        ]
      }
      piso_referencia: {
        Row: {
          categoria: string
          competencia: string
          created_at: string
          created_by: string | null
          id: string
          jornada_base: number
          observacao: string | null
          updated_at: string
          updated_by: string | null
          valor_referencia: number
        }
        Insert: {
          categoria: string
          competencia: string
          created_at?: string
          created_by?: string | null
          id?: string
          jornada_base?: number
          observacao?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_referencia: number
        }
        Update: {
          categoria?: string
          competencia?: string
          created_at?: string
          created_by?: string | null
          id?: string
          jornada_base?: number
          observacao?: string | null
          updated_at?: string
          updated_by?: string | null
          valor_referencia?: number
        }
        Relationships: []
      }
      planilha_modelos: {
        Row: {
          aba: string
          arquivo_base64: string
          ativo: boolean
          bytes: number
          colunas: Json
          colunas_estruturais: Json
          created_at: string
          criado_por: string | null
          descricao: string | null
          id: string
          linha_cabecalho: number
          modulo: string
          nome: string
          nome_arquivo: string
          padrao: boolean
          unidade_id: string | null
          updated_at: string
          vinculo: string | null
        }
        Insert: {
          aba?: string
          arquivo_base64: string
          ativo?: boolean
          bytes?: number
          colunas?: Json
          colunas_estruturais?: Json
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          linha_cabecalho?: number
          modulo?: string
          nome: string
          nome_arquivo?: string
          padrao?: boolean
          unidade_id?: string | null
          updated_at?: string
          vinculo?: string | null
        }
        Update: {
          aba?: string
          arquivo_base64?: string
          ativo?: boolean
          bytes?: number
          colunas?: Json
          colunas_estruturais?: Json
          created_at?: string
          criado_por?: string | null
          descricao?: string | null
          id?: string
          linha_cabecalho?: number
          modulo?: string
          nome?: string
          nome_arquivo?: string
          padrao?: boolean
          unidade_id?: string | null
          updated_at?: string
          vinculo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planilha_modelos_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
      profissionais: {
        Row: {
          adicional_noturno: number | null
          agencia: string | null
          bairro: string | null
          banco: string | null
          c_h: number | null
          carga_horaria_semanal: number | null
          cargo_id: string | null
          cep: string | null
          cidade: string | null
          cns: string | null
          conselho_classe: string | null
          conselho_numero: string | null
          conselho_uf: string | null
          conselho_validade: string | null
          conta_corrente: string | null
          cpf: string | null
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
          gratificacao_incentivo: number | null
          h_p: number | null
          horas_extras: number | null
          horas_previstas: number | null
          id: string
          jorn: number | null
          jornada: string | null
          logradouro: string | null
          matricula: string | null
          nome_completo: string
          nome_social: string | null
          numero: string | null
          observacoes: string | null
          pis_pasep: string | null
          proj: number | null
          projeto: string | null
          rg: string | null
          rg_orgao: string | null
          rg_uf: string | null
          salario_base: number | null
          salario_bruto: number | null
          salario_liquido: number | null
          secretaria_id: string
          setor_id: string | null
          sexo: string | null
          situacao_data_fim: string | null
          situacao_data_inicio: string | null
          situacao_funcional:
            | Database["public"]["Enums"]["situacao_funcional"]
            | null
          status: Database["public"]["Enums"]["status_profissional"]
          telefone: string | null
          uf: string | null
          unidade_id: string | null
          updated_at: string
          updated_by: string | null
          vencimento_liquido: number | null
          vinculo_id: string | null
        }
        Insert: {
          adicional_noturno?: number | null
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          c_h?: number | null
          carga_horaria_semanal?: number | null
          cargo_id?: string | null
          cep?: string | null
          cidade?: string | null
          cns?: string | null
          conselho_classe?: string | null
          conselho_numero?: string | null
          conselho_uf?: string | null
          conselho_validade?: string | null
          conta_corrente?: string | null
          cpf?: string | null
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
          gratificacao_incentivo?: number | null
          h_p?: number | null
          horas_extras?: number | null
          horas_previstas?: number | null
          id?: string
          jorn?: number | null
          jornada?: string | null
          logradouro?: string | null
          matricula?: string | null
          nome_completo: string
          nome_social?: string | null
          numero?: string | null
          observacoes?: string | null
          pis_pasep?: string | null
          proj?: number | null
          projeto?: string | null
          rg?: string | null
          rg_orgao?: string | null
          rg_uf?: string | null
          salario_base?: number | null
          salario_bruto?: number | null
          salario_liquido?: number | null
          secretaria_id: string
          setor_id?: string | null
          sexo?: string | null
          situacao_data_fim?: string | null
          situacao_data_inicio?: string | null
          situacao_funcional?:
            | Database["public"]["Enums"]["situacao_funcional"]
            | null
          status?: Database["public"]["Enums"]["status_profissional"]
          telefone?: string | null
          uf?: string | null
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vencimento_liquido?: number | null
          vinculo_id?: string | null
        }
        Update: {
          adicional_noturno?: number | null
          agencia?: string | null
          bairro?: string | null
          banco?: string | null
          c_h?: number | null
          carga_horaria_semanal?: number | null
          cargo_id?: string | null
          cep?: string | null
          cidade?: string | null
          cns?: string | null
          conselho_classe?: string | null
          conselho_numero?: string | null
          conselho_uf?: string | null
          conselho_validade?: string | null
          conta_corrente?: string | null
          cpf?: string | null
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
          gratificacao_incentivo?: number | null
          h_p?: number | null
          horas_extras?: number | null
          horas_previstas?: number | null
          id?: string
          jorn?: number | null
          jornada?: string | null
          logradouro?: string | null
          matricula?: string | null
          nome_completo?: string
          nome_social?: string | null
          numero?: string | null
          observacoes?: string | null
          pis_pasep?: string | null
          proj?: number | null
          projeto?: string | null
          rg?: string | null
          rg_orgao?: string | null
          rg_uf?: string | null
          salario_base?: number | null
          salario_bruto?: number | null
          salario_liquido?: number | null
          secretaria_id?: string
          setor_id?: string | null
          sexo?: string | null
          situacao_data_fim?: string | null
          situacao_data_inicio?: string | null
          situacao_funcional?:
            | Database["public"]["Enums"]["situacao_funcional"]
            | null
          status?: Database["public"]["Enums"]["status_profissional"]
          telefone?: string | null
          uf?: string | null
          unidade_id?: string | null
          updated_at?: string
          updated_by?: string | null
          vencimento_liquido?: number | null
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
          cnes: string | null
          cnpj: string | null
          created_at: string
          created_by: string | null
          deleted_at: string | null
          deleted_by: string | null
          descricao: string | null
          endereco: string | null
          gestor_id: string | null
          id: string
          nome: string
          observacoes: string | null
          responsavel_cpf: string | null
          responsavel_nome: string | null
          sigla: string | null
          status: Database["public"]["Enums"]["status_entidade"]
          tipo: string | null
          unidade_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cnes?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          endereco?: string | null
          gestor_id?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          responsavel_cpf?: string | null
          responsavel_nome?: string | null
          sigla?: string | null
          status?: Database["public"]["Enums"]["status_entidade"]
          tipo?: string | null
          unidade_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cnes?: string | null
          cnpj?: string | null
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          descricao?: string | null
          endereco?: string | null
          gestor_id?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          responsavel_cpf?: string | null
          responsavel_nome?: string | null
          sigla?: string | null
          status?: Database["public"]["Enums"]["status_entidade"]
          tipo?: string | null
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
      sistema_config: {
        Row: {
          ativado_em: string | null
          ativado_por: string | null
          aviso_manutencao_id: string | null
          id: number
          modo_manutencao_ativo: boolean | null
        }
        Insert: {
          ativado_em?: string | null
          ativado_por?: string | null
          aviso_manutencao_id?: string | null
          id?: number
          modo_manutencao_ativo?: boolean | null
        }
        Update: {
          ativado_em?: string | null
          ativado_por?: string | null
          aviso_manutencao_id?: string | null
          id?: number
          modo_manutencao_ativo?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "sistema_config_aviso_manutencao_id_fkey"
            columns: ["aviso_manutencao_id"]
            isOneToOne: false
            referencedRelation: "avisos_mural"
            referencedColumns: ["id"]
          },
        ]
      }
      sistemas_externos: {
        Row: {
          ativo: boolean | null
          audience: string | null
          clock_skew: number | null
          clock_skew_segundos: number | null
          cor: string | null
          created_at: string | null
          descricao: string | null
          endpoint_logout: string | null
          endpoint_refresh: string | null
          endpoint_sso: string | null
          expiracao: number | null
          icone: string | null
          id: string
          issuer: string | null
          jti_enabled: boolean | null
          nome: string
          nonce: string | null
          ordem: number | null
          private_key: string | null
          public_key: string | null
          status: string | null
          tipo_autenticacao: string | null
          token_exp_segundos: number | null
          updated_at: string | null
          url_base: string
        }
        Insert: {
          ativo?: boolean | null
          audience?: string | null
          clock_skew?: number | null
          clock_skew_segundos?: number | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          endpoint_logout?: string | null
          endpoint_refresh?: string | null
          endpoint_sso?: string | null
          expiracao?: number | null
          icone?: string | null
          id?: string
          issuer?: string | null
          jti_enabled?: boolean | null
          nome: string
          nonce?: string | null
          ordem?: number | null
          private_key?: string | null
          public_key?: string | null
          status?: string | null
          tipo_autenticacao?: string | null
          token_exp_segundos?: number | null
          updated_at?: string | null
          url_base: string
        }
        Update: {
          ativo?: boolean | null
          audience?: string | null
          clock_skew?: number | null
          clock_skew_segundos?: number | null
          cor?: string | null
          created_at?: string | null
          descricao?: string | null
          endpoint_logout?: string | null
          endpoint_refresh?: string | null
          endpoint_sso?: string | null
          expiracao?: number | null
          icone?: string | null
          id?: string
          issuer?: string | null
          jti_enabled?: boolean | null
          nome?: string
          nonce?: string | null
          ordem?: number | null
          private_key?: string | null
          public_key?: string | null
          status?: string | null
          tipo_autenticacao?: string | null
          token_exp_segundos?: number | null
          updated_at?: string | null
          url_base?: string
        }
        Relationships: []
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
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      v_integridade_profissionais: {
        Row: {
          cadastros_incompletos: number | null
          sem_cargo: number | null
          sem_dados_bancarios: number | null
          sem_email: number | null
          sem_funcao: number | null
          sem_matricula: number | null
          sem_setor: number | null
          sem_telefone: number | null
          total_profissionais: number | null
          unidade_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profissionais_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      ack_evento_dominio: { Args: { _id: string }; Returns: undefined }
      arquivar_profissional: { Args: { _id: string }; Returns: undefined }
      assinatura_dashboard: { Args: never; Returns: Json }
      assinatura_em_uso: { Args: { _storage_path: string }; Returns: boolean }
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
      check_frequencia_duplicada: {
        Args: { _competencia_id: string; _profissional_id: string }
        Returns: boolean
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
      compliance_riscos: {
        Args: { _competencia_id?: string; _unidade_id?: string }
        Returns: Json
      }
      current_user_is_master: { Args: never; Returns: boolean }
      current_user_unidades: { Args: never; Returns: string[] }
      debug_rbac_caller: { Args: never; Returns: Json }
      desativar_modo_manutencao_emergencia: { Args: never; Returns: undefined }
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
      excluir_usuario_completo: { Args: { p_user_id: string }; Returns: Json }
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
      get_cargos_funcoes_uso: { Args: never; Returns: Json }
      get_dashboard_monthly_evolution: {
        Args: { p_ano: number; p_unidade_id?: string }
        Returns: Json
      }
      get_dashboard_summary: {
        Args: { p_competencia_id: string; p_unidade_id?: string }
        Returns: Json
      }
      get_minhas_unidades_ids: { Args: never; Returns: string[] }
      get_my_permissions: { Args: never; Returns: string[] }
      get_my_user_context: { Args: never; Returns: Json }
      get_quadro_lotacao: {
        Args: {
          p_cargo_id?: string
          p_setor_id?: string
          p_unidade_id?: string
        }
        Returns: {
          afastados: number
          ativos: number
          cargo_id: string
          cargo_nome: string
          ferias: number
          funcao_id: string
          funcao_nome: string
          licencas: number
          setor_id: string
          setor_nome: string
          total: number
          unidade_id: string
          unidade_nome: string
          unidade_sigla: string
        }[]
      }
      get_ranking_rh: {
        Args: { p_competencia_id: string }
        Returns: {
          aprovadas: number
          total_faltas: number
          total_folhas: number
          total_horas_extras: number
          total_profissionais: number
          unidade_id: string
          unidade_nome: string
          unidade_sigla: string
        }[]
      }
      get_setores_uso: {
        Args: { p_unidade_id: string }
        Returns: {
          setor_id: string
          total: number
        }[]
      }
      get_unidade_dashboard_summary: {
        Args: { p_unidade_id: string }
        Returns: Json
      }
      get_user_permissions_list: {
        Args: { _user_id: string }
        Returns: string[]
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
      has_permission_core: {
        Args: {
          _codigo: string
          _secretaria_id?: string
          _unidade_id?: string
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      health_cron_jobs: { Args: never; Returns: Json }
      health_eventos_dominio: { Args: never; Returns: Json }
      health_pendencias_sla: { Args: never; Returns: Json }
      hsm_config_ler: { Args: never; Returns: Json }
      hsm_config_salvar: {
        Args: {
          _agentes_habilitados: Json
          _ativo: boolean
          _cache_config: Json
          _ferramentas_habilitadas: Json
          _limites: Json
          _metadata: Json
          _modo_execucao: string
          _observabilidade_config: Json
          _prompt_sistema: string
          _retencao_config: Json
          _somente_leitura: boolean
        }
        Returns: Json
      }
      hsm_estatisticas: { Args: { _dias?: number }; Returns: Json }
      is_aviso_gestor: { Args: { _user_id: string }; Returns: boolean }
      is_master: { Args: { _user_id?: string }; Returns: boolean }
      is_master_core: { Args: { _user_id: string }; Returns: boolean }
      is_master_db: { Args: { _user_id: string }; Returns: boolean }
      jwt_has_permission: { Args: { _perm: string }; Returns: boolean }
      limpar_valor_texto: { Args: { val: string }; Returns: string }
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
      mfa_exigido_nao_atendido: { Args: { _user_id: string }; Returns: boolean }
      mfa_exigido_nao_atendido_core: {
        Args: { _user_id: string }
        Returns: boolean
      }
      nack_evento_dominio: {
        Args: { _erro: string; _id: string }
        Returns: undefined
      }
      notificar_assinatura_pendentes: { Args: never; Returns: number }
      piso_extracao_config_ler: { Args: never; Returns: Json }
      piso_extracao_config_salvar: {
        Args: {
          _atualizar_chave?: boolean
          _ia_api_key?: string
          _ia_fornecedor: string
          _ia_habilitada: boolean
          _ia_modelo: string
          _motor: string
          _ocr_idioma: string
        }
        Returns: Json
      }
      piso_extracao_ia_key: { Args: never; Returns: string }
      piso_ia_cadeia: { Args: never; Returns: Json }
      piso_ia_config_salvar: {
        Args: { _modo: string; _provedor_id: string }
        Returns: undefined
      }
      piso_ia_provedor_excluir: { Args: { _id: string }; Returns: undefined }
      piso_ia_provedor_key: { Args: { _id: string }; Returns: string }
      piso_ia_provedor_metrica: {
        Args: {
          _confianca: number
          _erro: string
          _id: string
          _ms: number
          _ok: boolean
          _pdfs: number
          _status: number
        }
        Returns: undefined
      }
      piso_ia_provedor_salvar: {
        Args: {
          _api_key: string
          _ativo: boolean
          _atualizar_chave: boolean
          _base_url: string
          _extra: Json
          _id: string
          _modelo: string
          _nome: string
          _prioridade: number
          _tentativas: number
          _timeout_ms: number
          _tipo: string
        }
        Returns: string
      }
      piso_ia_provedores_listar: { Args: never; Returns: Json }
      piso_ia_provedores_ordenar: {
        Args: { _ids: string[] }
        Returns: undefined
      }
      proximo_numero_pendencia: {
        Args: { _secretaria_id: string }
        Returns: string
      }
      reprocessar_evento_dominio: { Args: { _id: string }; Returns: undefined }
      revogar_documento_assinado: {
        Args: { _id: string; _motivo: string }
        Returns: undefined
      }
      rls_cache_get: { Args: { _key: string }; Returns: boolean }
      rls_cache_put: { Args: { _key: string; _val: boolean }; Returns: boolean }
      save_profissional_complete: { Args: { p_payload: Json }; Returns: Json }
      sla_pendencias_processar: {
        Args: never
        Returns: {
          escaladas: number
          proximas: number
          vencidas: number
        }[]
      }
      sync_user_units_to_jwt_manual: {
        Args: { _user_id: string }
        Returns: undefined
      }
      track_uso: {
        Args: { _contexto?: Json; _evento: string; _rota?: string }
        Returns: undefined
      }
      user_has_secretaria: {
        Args: { _secretaria_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_secretaria_core: {
        Args: { _secretaria_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_unit: {
        Args: { _unidade_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_unit_core: {
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
      app_role: "admin" | "moderator" | "user"
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
        | "atestado"
        | "licenca_premio"
        | "licenca_maternidade"
        | "licenca_saude"
        | "licenca_luto"
        | "licenca_sem_vencimento"
        | "licenca_estudo"
        | "vacancia"
        | "afastamento_inss"
        | "falta_pad"
        | "inativo"
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
        | "devolvida"
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
        | "atestado"
        | "licenca_premio"
        | "licenca_maternidade"
        | "licenca_saude"
        | "licenca_luto"
        | "licenca_sem_vencimento"
        | "licenca_estudo"
        | "vacancia"
        | "afastamento_inss"
        | "falta_pad"
        | "cedido"
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
        | "frequencia_submissao"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "moderator", "user"],
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
        "atestado",
        "licenca_premio",
        "licenca_maternidade",
        "licenca_saude",
        "licenca_luto",
        "licenca_sem_vencimento",
        "licenca_estudo",
        "vacancia",
        "afastamento_inss",
        "falta_pad",
        "inativo",
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
        "devolvida",
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
        "atestado",
        "licenca_premio",
        "licenca_maternidade",
        "licenca_saude",
        "licenca_luto",
        "licenca_sem_vencimento",
        "licenca_estudo",
        "vacancia",
        "afastamento_inss",
        "falta_pad",
        "cedido",
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
        "frequencia_submissao",
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
