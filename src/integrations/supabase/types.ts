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
      access_logs: {
        Row: {
          created_at: string
          duration_seconds: number
          id: string
          last_activity_at: string
          login_at: string
          updated_at: string
          user_agent: string | null
          user_email: string | null
          user_id: string
          user_name: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number
          id?: string
          last_activity_at?: string
          login_at?: string
          updated_at?: string
          user_agent?: string | null
          user_email?: string | null
          user_id: string
          user_name?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number
          id?: string
          last_activity_at?: string
          login_at?: string
          updated_at?: string
          user_agent?: string | null
          user_email?: string | null
          user_id?: string
          user_name?: string | null
        }
        Relationships: []
      }
      app_parameters: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      caixas: {
        Row: {
          agencia: string | null
          ativo: boolean
          banco: string | null
          chave_pix: string | null
          conta: string | null
          created_at: string
          created_by: string | null
          id: string
          nome: string
          saldo: number
          updated_at: string
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          chave_pix?: string | null
          conta?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome: string
          saldo?: number
          updated_at?: string
        }
        Update: {
          agencia?: string | null
          ativo?: boolean
          banco?: string | null
          chave_pix?: string | null
          conta?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          nome?: string
          saldo?: number
          updated_at?: string
        }
        Relationships: []
      }
      cdi_auditoria: {
        Row: {
          alterado_em: string
          data: string
          id: string
          taxa_anterior: number
          taxa_nova: number
        }
        Insert: {
          alterado_em?: string
          data: string
          id?: string
          taxa_anterior: number
          taxa_nova: number
        }
        Update: {
          alterado_em?: string
          data?: string
          id?: string
          taxa_anterior?: number
          taxa_nova?: number
        }
        Relationships: []
      }
      cdi_diario: {
        Row: {
          created_at: string
          data: string
          taxa: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: string
          taxa: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: string
          taxa?: number
          updated_at?: string
        }
        Relationships: []
      }
      cedentes: {
        Row: {
          ativo: boolean
          cidade: string | null
          cnpj: string
          created_at: string
          created_by: string | null
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome_fantasia: string | null
          observacoes: string | null
          razao_social: string
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          cnpj: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social: string
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          cnpj?: string
          created_at?: string
          created_by?: string | null
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome_fantasia?: string | null
          observacoes?: string | null
          razao_social?: string
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      cotas_debenture: {
        Row: {
          created_at: string
          debenture_id: string
          emitida_em: string
          emitida_por: string | null
          id: string
          numero: string
          situacao: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          debenture_id: string
          emitida_em?: string
          emitida_por?: string | null
          id?: string
          numero: string
          situacao?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          debenture_id?: string
          emitida_em?: string
          emitida_por?: string | null
          id?: string
          numero?: string
          situacao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cotas_debenture_debenture_id_fkey"
            columns: ["debenture_id"]
            isOneToOne: false
            referencedRelation: "debentures"
            referencedColumns: ["id"]
          },
        ]
      }
      debentures: {
        Row: {
          created_at: string
          created_by: string | null
          data_final_vendas: string | null
          data_inicio: string | null
          data_vencimento: string
          duracao_meses: number | null
          emissao: string | null
          id: string
          nome: string
          observacoes: string | null
          quantidade_cotas: number | null
          rentabilidade_anual: number | null
          serie: string | null
          status: string
          taxa: number
          tipo_retirada: string | null
          tipo_taxa: string
          updated_at: string
          valor: number
          valor_cota: number | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data_final_vendas?: string | null
          data_inicio?: string | null
          data_vencimento: string
          duracao_meses?: number | null
          emissao?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          quantidade_cotas?: number | null
          rentabilidade_anual?: number | null
          serie?: string | null
          status?: string
          taxa?: number
          tipo_retirada?: string | null
          tipo_taxa?: string
          updated_at?: string
          valor?: number
          valor_cota?: number | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data_final_vendas?: string | null
          data_inicio?: string | null
          data_vencimento?: string
          duracao_meses?: number | null
          emissao?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          quantidade_cotas?: number | null
          rentabilidade_anual?: number | null
          serie?: string | null
          status?: string
          taxa?: number
          tipo_retirada?: string | null
          tipo_taxa?: string
          updated_at?: string
          valor?: number
          valor_cota?: number | null
        }
        Relationships: []
      }
      debenturistas: {
        Row: {
          anexo_investidor_profissional_path: string | null
          ativo: boolean
          auth_user_id: string | null
          bairro: string | null
          cep: string | null
          cidade: string | null
          complemento: string | null
          comprovante_cpf_path: string | null
          comprovante_endereco_path: string | null
          comprovante_renda_path: string | null
          comprovante_rg_path: string | null
          created_at: string
          created_by: string | null
          data_emissao_rg: string | null
          data_nascimento: string | null
          documento: string | null
          email: string | null
          empregador: string | null
          estado: string | null
          estado_civil: string | null
          id: string
          nome: string
          numero: string | null
          orgao_emissor: string | null
          profissao: string | null
          renda: number | null
          rg: string | null
          rua: string | null
          status: string
          telefone: string | null
          termo_assinado_path: string | null
          tipo: string
          updated_at: string
        }
        Insert: {
          anexo_investidor_profissional_path?: string | null
          ativo?: boolean
          auth_user_id?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          comprovante_cpf_path?: string | null
          comprovante_endereco_path?: string | null
          comprovante_renda_path?: string | null
          comprovante_rg_path?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao_rg?: string | null
          data_nascimento?: string | null
          documento?: string | null
          email?: string | null
          empregador?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          nome: string
          numero?: string | null
          orgao_emissor?: string | null
          profissao?: string | null
          renda?: number | null
          rg?: string | null
          rua?: string | null
          status?: string
          telefone?: string | null
          termo_assinado_path?: string | null
          tipo?: string
          updated_at?: string
        }
        Update: {
          anexo_investidor_profissional_path?: string | null
          ativo?: boolean
          auth_user_id?: string | null
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          complemento?: string | null
          comprovante_cpf_path?: string | null
          comprovante_endereco_path?: string | null
          comprovante_renda_path?: string | null
          comprovante_rg_path?: string | null
          created_at?: string
          created_by?: string | null
          data_emissao_rg?: string | null
          data_nascimento?: string | null
          documento?: string | null
          email?: string | null
          empregador?: string | null
          estado?: string | null
          estado_civil?: string | null
          id?: string
          nome?: string
          numero?: string | null
          orgao_emissor?: string | null
          profissao?: string | null
          renda?: number | null
          rg?: string | null
          rua?: string | null
          status?: string
          telefone?: string | null
          termo_assinado_path?: string | null
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      feriados: {
        Row: {
          created_at: string
          created_by: string | null
          data: string
          descricao: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          data: string
          descricao: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          data?: string
          descricao?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      informes_rendimento: {
        Row: {
          ano_calendario: number
          created_at: string
          created_by: string | null
          debenture_id: string | null
          debenturista_id: string
          gerado_em: string | null
          id: string
          pdf_path: string | null
          saldo_em_31_12: number
          total_ir_retido: number
          total_rendimento_bruto: number
          total_rendimento_liquido: number
          updated_at: string
        }
        Insert: {
          ano_calendario: number
          created_at?: string
          created_by?: string | null
          debenture_id?: string | null
          debenturista_id: string
          gerado_em?: string | null
          id?: string
          pdf_path?: string | null
          saldo_em_31_12?: number
          total_ir_retido?: number
          total_rendimento_bruto?: number
          total_rendimento_liquido?: number
          updated_at?: string
        }
        Update: {
          ano_calendario?: number
          created_at?: string
          created_by?: string | null
          debenture_id?: string | null
          debenturista_id?: string
          gerado_em?: string | null
          id?: string
          pdf_path?: string | null
          saldo_em_31_12?: number
          total_ir_retido?: number
          total_rendimento_bruto?: number
          total_rendimento_liquido?: number
          updated_at?: string
        }
        Relationships: []
      }
      integrations_log: {
        Row: {
          created_at: string
          error: string | null
          id: string
          integration: string
          payload: Json | null
          reference_id: string | null
          response: Json | null
          status_code: number | null
        }
        Insert: {
          created_at?: string
          error?: string | null
          id?: string
          integration: string
          payload?: Json | null
          reference_id?: string | null
          response?: Json | null
          status_code?: number | null
        }
        Update: {
          created_at?: string
          error?: string | null
          id?: string
          integration?: string
          payload?: Json | null
          reference_id?: string | null
          response?: Json | null
          status_code?: number | null
        }
        Relationships: []
      }
      operacoes: {
        Row: {
          cedente_id: string
          created_at: string
          created_by: string | null
          data_emissao: string
          data_liquidacao: string | null
          data_vencimento: string
          id: string
          numero: string
          observacoes: string | null
          prazo_dias: number
          sacado_id: string
          status: Database["public"]["Enums"]["operacao_status"]
          taxa_mensal: number
          updated_at: string
          valor_liquido: number | null
          valor_principal: number
        }
        Insert: {
          cedente_id: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_liquidacao?: string | null
          data_vencimento: string
          id?: string
          numero: string
          observacoes?: string | null
          prazo_dias?: number
          sacado_id: string
          status?: Database["public"]["Enums"]["operacao_status"]
          taxa_mensal?: number
          updated_at?: string
          valor_liquido?: number | null
          valor_principal: number
        }
        Update: {
          cedente_id?: string
          created_at?: string
          created_by?: string | null
          data_emissao?: string
          data_liquidacao?: string | null
          data_vencimento?: string
          id?: string
          numero?: string
          observacoes?: string | null
          prazo_dias?: number
          sacado_id?: string
          status?: Database["public"]["Enums"]["operacao_status"]
          taxa_mensal?: number
          updated_at?: string
          valor_liquido?: number | null
          valor_principal?: number
        }
        Relationships: [
          {
            foreignKeyName: "operacoes_cedente_id_fkey"
            columns: ["cedente_id"]
            isOneToOne: false
            referencedRelation: "cedentes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operacoes_sacado_id_fkey"
            columns: ["sacado_id"]
            isOneToOne: false
            referencedRelation: "sacados"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rendimentos_debenture: {
        Row: {
          aliquota_ir: number
          consolidado: boolean
          created_at: string
          created_by: string | null
          data_competencia: string
          data_pagamento: string | null
          debenture_id: string
          debenturista_id: string
          dias_uteis_periodo: number
          id: string
          observacoes: string | null
          pago: boolean
          rendimento_bruto: number
          rendimento_liquido: number
          tipo_calculo: string
          updated_at: string
          valor_ir_retido: number
          venda_id: string
        }
        Insert: {
          aliquota_ir?: number
          consolidado?: boolean
          created_at?: string
          created_by?: string | null
          data_competencia: string
          data_pagamento?: string | null
          debenture_id: string
          debenturista_id: string
          dias_uteis_periodo?: number
          id?: string
          observacoes?: string | null
          pago?: boolean
          rendimento_bruto?: number
          rendimento_liquido?: number
          tipo_calculo?: string
          updated_at?: string
          valor_ir_retido?: number
          venda_id: string
        }
        Update: {
          aliquota_ir?: number
          consolidado?: boolean
          created_at?: string
          created_by?: string | null
          data_competencia?: string
          data_pagamento?: string | null
          debenture_id?: string
          debenturista_id?: string
          dias_uteis_periodo?: number
          id?: string
          observacoes?: string | null
          pago?: boolean
          rendimento_bruto?: number
          rendimento_liquido?: number
          tipo_calculo?: string
          updated_at?: string
          valor_ir_retido?: number
          venda_id?: string
        }
        Relationships: []
      }
      retiradas_debenture: {
        Row: {
          caixa_id: string | null
          created_at: string
          created_by: string | null
          data_retirada: string
          debenture_id: string
          debenturista_id: string
          id: string
          observacoes: string | null
          rendimento_bruto: number
          rendimento_liquido: number
          tipo: string
          updated_at: string
          valor_ir_retido: number
          valor_retirado: number
          venda_id: string
        }
        Insert: {
          caixa_id?: string | null
          created_at?: string
          created_by?: string | null
          data_retirada: string
          debenture_id: string
          debenturista_id: string
          id?: string
          observacoes?: string | null
          rendimento_bruto?: number
          rendimento_liquido?: number
          tipo?: string
          updated_at?: string
          valor_ir_retido?: number
          valor_retirado?: number
          venda_id: string
        }
        Update: {
          caixa_id?: string | null
          created_at?: string
          created_by?: string | null
          data_retirada?: string
          debenture_id?: string
          debenturista_id?: string
          id?: string
          observacoes?: string | null
          rendimento_bruto?: number
          rendimento_liquido?: number
          tipo?: string
          updated_at?: string
          valor_ir_retido?: number
          valor_retirado?: number
          venda_id?: string
        }
        Relationships: []
      }
      sacados: {
        Row: {
          ativo: boolean
          cidade: string | null
          created_at: string
          created_by: string | null
          documento: string
          email: string | null
          endereco: string | null
          estado: string | null
          id: string
          nome: string
          observacoes: string | null
          status: string
          telefone: string | null
          tipo: Database["public"]["Enums"]["pessoa_tipo"]
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          documento: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          status?: string
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cidade?: string | null
          created_at?: string
          created_by?: string | null
          documento?: string
          email?: string | null
          endereco?: string | null
          estado?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          status?: string
          telefone?: string | null
          tipo?: Database["public"]["Enums"]["pessoa_tipo"]
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendas_debenture: {
        Row: {
          caixa_id: string | null
          comprovante_path: string | null
          cota_id: string
          created_at: string
          created_by: string | null
          data_venda: string
          debenture_id: string
          debenturista_id: string | null
          id: string
          updated_at: string
          valor: number
        }
        Insert: {
          caixa_id?: string | null
          comprovante_path?: string | null
          cota_id: string
          created_at?: string
          created_by?: string | null
          data_venda?: string
          debenture_id: string
          debenturista_id?: string | null
          id?: string
          updated_at?: string
          valor?: number
        }
        Update: {
          caixa_id?: string | null
          comprovante_path?: string | null
          cota_id?: string
          created_at?: string
          created_by?: string | null
          data_venda?: string
          debenture_id?: string
          debenturista_id?: string | null
          id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "vendas_debenture_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_debenture_cota_id_fkey"
            columns: ["cota_id"]
            isOneToOne: false
            referencedRelation: "cotas_debenture"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_debenture_debenture_id_fkey"
            columns: ["debenture_id"]
            isOneToOne: false
            referencedRelation: "debentures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_debenture_debenturista_id_fkey"
            columns: ["debenturista_id"]
            isOneToOne: false
            referencedRelation: "debenturistas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_debenturista_id: { Args: never; Returns: string }
      ensure_current_user_setup: { Args: never; Returns: undefined }
      exec_sql: { Args: { sql_query: string }; Returns: Json }
      get_my_roles: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      marcar_inadimplentes: { Args: never; Returns: number }
      suspender_debentures_vencidas: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin" | "gestor" | "operador" | "investidor"
      operacao_status:
        | "rascunho"
        | "ativa"
        | "liquidada"
        | "inadimplente"
        | "cancelada"
      pessoa_tipo: "PF" | "PJ"
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
      app_role: ["admin", "gestor", "operador", "investidor"],
      operacao_status: [
        "rascunho",
        "ativa",
        "liquidada",
        "inadimplente",
        "cancelada",
      ],
      pessoa_tipo: ["PF", "PJ"],
    },
  },
} as const
