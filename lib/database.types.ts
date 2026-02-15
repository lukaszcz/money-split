export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          name: string;
          main_currency_code: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          main_currency_code: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          main_currency_code?: string;
          created_at?: string;
        };
        Relationships: [];
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
        Relationships: [
          {
            foreignKeyName: 'group_members_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'group_members_connected_user_id_fkey';
            columns: ['connected_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
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
          split_type: string;
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
          split_type?: string;
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
          split_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'expenses_group_id_fkey';
            columns: ['group_id'];
            isOneToOne: false;
            referencedRelation: 'groups';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expenses_payer_member_id_fkey';
            columns: ['payer_member_id'];
            isOneToOne: false;
            referencedRelation: 'group_members';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'expense_shares_expense_id_fkey';
            columns: ['expense_id'];
            isOneToOne: false;
            referencedRelation: 'expenses';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'expense_shares_member_id_fkey';
            columns: ['member_id'];
            isOneToOne: false;
            referencedRelation: 'group_members';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [];
      };
      recovery_passwords: {
        Row: {
          id: string;
          user_id: string;
          password_hash: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          password_hash: string;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          password_hash?: string;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'recovery_passwords_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: 'user_currency_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_group_preferences: {
        Row: {
          user_id: string;
          group_order: string[];
          updated_at: string;
        };
        Insert: {
          user_id: string;
          group_order?: string[];
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          group_order?: string[];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_group_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_known_users: {
        Row: {
          user_id: string;
          known_user_id: string;
          first_shared_at: string;
          last_shared_at: string;
        };
        Insert: {
          user_id: string;
          known_user_id: string;
          first_shared_at?: string;
          last_shared_at?: string;
        };
        Update: {
          user_id?: string;
          known_user_id?: string;
          first_shared_at?: string;
          last_shared_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_known_users_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'user_known_users_known_user_id_fkey';
            columns: ['known_user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      user_settle_preferences: {
        Row: {
          user_id: string;
          simplify_debts: boolean;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          simplify_debts?: boolean;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          simplify_debts?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'user_settle_preferences_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: true;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_activity_feed: {
        Args: {
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          group_id: string;
          group_name: string;
          description: string | null;
          date_time: string;
          currency_code: string;
          total_amount_scaled: number;
          payer_member_id: string | null;
          payer_name: string;
          payment_type: string;
          split_type: string;
          created_at: string;
        }[];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
