export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string | null;
          created_at: string;
          last_login: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          email?: string | null;
          created_at?: string;
          last_login?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string | null;
          created_at?: string;
          last_login?: string | null;
        };
      };
      groups: {
        Row: {
          id: string;
          name: string;
          main_currency_code: string;
          created_at: string;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          main_currency_code: string;
          created_at?: string;
          created_by?: string | null;
        };
        Update: {
          id?: string;
          name?: string;
          main_currency_code?: string;
          created_at?: string;
          created_by?: string | null;
        };
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          name: string;
          email: string | null;
          connected_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          name: string;
          email?: string | null;
          connected_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          name?: string;
          email?: string | null;
          connected_user_id?: string | null;
          created_at?: string;
        };
      };
      expenses: {
        Row: {
          id: string;
          group_id: string;
          description: string | null;
          date_time: string;
          currency_code: string;
          total_amount_scaled: number;
          payer_member_id: string;
          exchange_rate_to_main_scaled: number;
          total_in_main_scaled: number;
          created_at: string;
          payment_type: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          description?: string | null;
          date_time: string;
          currency_code: string;
          total_amount_scaled: number;
          payer_member_id: string;
          exchange_rate_to_main_scaled: number;
          total_in_main_scaled: number;
          created_at?: string;
          payment_type?: string;
        };
        Update: {
          id?: string;
          group_id?: string;
          description?: string | null;
          date_time?: string;
          currency_code?: string;
          total_amount_scaled?: number;
          payer_member_id?: string;
          exchange_rate_to_main_scaled?: number;
          total_in_main_scaled?: number;
          created_at?: string;
          payment_type?: string;
        };
      };
      expense_shares: {
        Row: {
          id: string;
          expense_id: string;
          member_id: string;
          share_amount_scaled: number;
          share_in_main_scaled: number;
        };
        Insert: {
          id?: string;
          expense_id: string;
          member_id: string;
          share_amount_scaled: number;
          share_in_main_scaled: number;
        };
        Update: {
          id?: string;
          expense_id?: string;
          member_id?: string;
          share_amount_scaled?: number;
          share_in_main_scaled?: number;
        };
      };
      exchange_rates: {
        Row: {
          id: string;
          base_currency_code: string;
          quote_currency_code: string;
          rate_scaled: number;
          fetched_at: string;
        };
        Insert: {
          id?: string;
          base_currency_code: string;
          quote_currency_code: string;
          rate_scaled: number;
          fetched_at?: string;
        };
        Update: {
          id?: string;
          base_currency_code?: string;
          quote_currency_code?: string;
          rate_scaled?: number;
          fetched_at?: string;
        };
      };
      user_currency_preferences: {
        Row: {
          id: string;
          user_id: string;
          currency_order: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          currency_order?: string[];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          currency_order?: string[];
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};
