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
      machine_products: {
        Row: {
          created_at: string
          current_balance: number | null
          desired_price: number | null
          id: string
          logical_locator: string | null
          machine_id: string
          product_id: string
          status: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_balance?: number | null
          desired_price?: number | null
          id?: string
          logical_locator?: string | null
          machine_id: string
          product_id: string
          status?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_balance?: number | null
          desired_price?: number | null
          id?: string
          logical_locator?: string | null
          machine_id?: string
          product_id?: string
          status?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "machine_products_machine_id_fkey"
            columns: ["machine_id"]
            isOneToOne: false
            referencedRelation: "machines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "machine_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      machines: {
        Row: {
          asset_number: string | null
          created_at: string
          id: string
          installation_id: number | null
          location_id: number | null
          location_name: string | null
          place: string | null
          tags: string[] | null
          updated_at: string
          vmpay_machine_id: number
        }
        Insert: {
          asset_number?: string | null
          created_at?: string
          id?: string
          installation_id?: number | null
          location_id?: number | null
          location_name?: string | null
          place?: string | null
          tags?: string[] | null
          updated_at?: string
          vmpay_machine_id: number
        }
        Update: {
          asset_number?: string | null
          created_at?: string
          id?: string
          installation_id?: number | null
          location_id?: number | null
          location_name?: string | null
          place?: string | null
          tags?: string[] | null
          updated_at?: string
          vmpay_machine_id?: number
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          category_id: number | null
          created_at: string
          description: string | null
          id: string
          manufacturer_id: number | null
          name: string
          tags: string[] | null
          upc_code: string | null
          updated_at: string
          vmpay_good_id: number
        }
        Insert: {
          barcode?: string | null
          category_id?: number | null
          created_at?: string
          description?: string | null
          id?: string
          manufacturer_id?: number | null
          name: string
          tags?: string[] | null
          upc_code?: string | null
          updated_at?: string
          vmpay_good_id: number
        }
        Update: {
          barcode?: string | null
          category_id?: number | null
          created_at?: string
          description?: string | null
          id?: string
          manufacturer_id?: number | null
          name?: string
          tags?: string[] | null
          upc_code?: string | null
          updated_at?: string
          vmpay_good_id?: number
        }
        Relationships: []
      }
      sync_log_entries: {
        Row: {
          attempt: number
          created_at: string
          duration_ms: number | null
          endpoint: string
          error_message: string | null
          id: string
          ok: boolean
          page: number | null
          status_code: number | null
          sync_id: string | null
        }
        Insert: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          endpoint: string
          error_message?: string | null
          id?: string
          ok?: boolean
          page?: number | null
          status_code?: number | null
          sync_id?: string | null
        }
        Update: {
          attempt?: number
          created_at?: string
          duration_ms?: number | null
          endpoint?: string
          error_message?: string | null
          id?: string
          ok?: boolean
          page?: number | null
          status_code?: number | null
          sync_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sync_log_entries_sync_id_fkey"
            columns: ["sync_id"]
            isOneToOne: false
            referencedRelation: "sync_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: string
          machines_count: number | null
          prices_count: number | null
          prices_inserted: number | null
          prices_skipped: number | null
          prices_updated: number | null
          products_count: number | null
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          machines_count?: number | null
          prices_count?: number | null
          prices_inserted?: number | null
          prices_skipped?: number | null
          prices_updated?: number | null
          products_count?: number | null
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: string
          machines_count?: number | null
          prices_count?: number | null
          prices_inserted?: number | null
          prices_skipped?: number | null
          prices_updated?: number | null
          products_count?: number | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
