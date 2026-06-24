export type SplitType = "equal" | "exact" | "percentage";

export type { CurrencyCode } from "./currency";

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          avatar_url?: string | null;
        };
        Update: {
          full_name?: string;
          avatar_url?: string | null;
        };
        Relationships: [];
      };
      groups: {
        Row: {
          id: string;
          name: string;
          image_url: string | null;
          created_by: string;
          created_at: string;
          currency: string;
          simplify_debts: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          image_url?: string | null;
          created_by: string;
          currency?: string;
          simplify_debts?: boolean;
        };
        Update: {
          name?: string;
          image_url?: string | null;
          currency?: string;
          simplify_debts?: boolean;
        };
        Relationships: [];
      };
      group_members: {
        Row: {
          id: string;
          group_id: string;
          user_id: string;
          joined_at: string;
        };
        Insert: {
          id?: string;
          group_id: string;
          user_id: string;
        };
        Update: {};
        Relationships: [];
      };
      expenses: {
        Row: {
          id: string;
          group_id: string;
          paid_by: string;
          amount: number;
          description: string;
          category: string | null;
          split_type: SplitType;
          date: string;
          created_at: string;
          currency: string;
          exchange_rate: number;
          base_amount: number;
        };
        Insert: {
          id?: string;
          group_id: string;
          paid_by: string;
          amount: number;
          description: string;
          category?: string | null;
          split_type: SplitType;
          date?: string;
          currency?: string;
          exchange_rate?: number;
          base_amount?: number;
        };
        Update: {
          amount?: number;
          description?: string;
          category?: string | null;
          split_type?: SplitType;
          date?: string;
          currency?: string;
          exchange_rate?: number;
          base_amount?: number;
        };
        Relationships: [];
      };
      expense_splits: {
        Row: {
          id: string;
          expense_id: string;
          user_id: string;
          amount: number;
          base_amount: number;
        };
        Insert: {
          id?: string;
          expense_id: string;
          user_id: string;
          amount: number;
          base_amount?: number;
        };
        Update: {
          amount?: number;
          base_amount?: number;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          id: string;
          group_id: string;
          paid_by: string;
          paid_to: string;
          amount: number;
          note: string | null;
          created_at: string;
          currency: string;
          exchange_rate: number;
          base_amount: number;
        };
        Insert: {
          id?: string;
          group_id: string;
          paid_by: string;
          paid_to: string;
          amount: number;
          note?: string | null;
          currency?: string;
          exchange_rate?: number;
          base_amount?: number;
        };
        Update: {
          paid_by?: string;
          paid_to?: string;
          amount?: number;
          note?: string | null;
          currency?: string;
          exchange_rate?: number;
          base_amount?: number;
        };
        Relationships: [];
      };
      contacts: {
        Row: {
          id: string;
          owner_id: string;
          contact_user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          contact_user_id: string;
        };
        Update: {};
        Relationships: [];
      };
      contact_expenses: {
        Row: {
          id: string;
          paid_by: string;
          user_lo: string;
          user_hi: string;
          amount: number;
          description: string;
          category: string | null;
          split_type: SplitType;
          date: string;
          created_at: string;
          currency: string;
          exchange_rate: number;
          base_amount: number;
        };
        Insert: {
          id?: string;
          paid_by: string;
          user_lo: string;
          user_hi: string;
          amount: number;
          description: string;
          category?: string | null;
          split_type: SplitType;
          date?: string;
          currency?: string;
          exchange_rate?: number;
          base_amount?: number;
        };
        Update: {
          amount?: number;
          description?: string;
          category?: string | null;
          split_type?: SplitType;
          date?: string;
          currency?: string;
          exchange_rate?: number;
          base_amount?: number;
        };
        Relationships: [];
      };
      contact_expense_splits: {
        Row: {
          id: string;
          expense_id: string;
          user_id: string;
          amount: number;
          base_amount: number;
        };
        Insert: {
          id?: string;
          expense_id: string;
          user_id: string;
          amount: number;
          base_amount?: number;
        };
        Update: {
          amount?: number;
          base_amount?: number;
        };
        Relationships: [];
      };
      contact_payments: {
        Row: {
          id: string;
          paid_by: string;
          paid_to: string;
          user_lo: string;
          user_hi: string;
          amount: number;
          note: string | null;
          created_at: string;
          currency: string;
          exchange_rate: number;
          base_amount: number;
        };
        Insert: {
          id?: string;
          paid_by: string;
          paid_to: string;
          user_lo: string;
          user_hi: string;
          amount: number;
          note?: string | null;
          currency?: string;
          exchange_rate?: number;
          base_amount?: number;
        };
        Update: {
          paid_by?: string;
          paid_to?: string;
          amount?: number;
          note?: string | null;
          currency?: string;
          exchange_rate?: number;
          base_amount?: number;
        };
        Relationships: [];
      };
      contact_pair_settings: {
        Row: {
          user_lo: string;
          user_hi: string;
          currency: string;
          updated_at: string;
        };
        Insert: {
          user_lo: string;
          user_hi: string;
          currency?: string;
        };
        Update: {
          currency?: string;
        };
        Relationships: [];
      };
      contact_requests: {
        Row: {
          id: string;
          requester_id: string;
          recipient_id: string;
          status: "pending" | "accepted" | "declined";
          created_at: string;
          responded_at: string | null;
        };
        Insert: {
          id?: string;
          requester_id: string;
          recipient_id: string;
          status?: "pending" | "accepted" | "declined";
          created_at?: string;
          responded_at?: string | null;
        };
        Update: {
          status?: "pending" | "accepted" | "declined";
          responded_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {};
    Functions: {
      get_group_balances: {
        Args: { p_group_id: string };
        Returns: {
          user_id: string;
          full_name: string;
          balance: number;
        }[];
      };
      get_user_total_balance: {
        Args: { p_user_id: string };
        Returns: {
          balance: number;
          currency: string;
        }[];
      };
      get_user_ids_by_email: {
        Args: { emails: string[] };
        Returns: {
          id: string;
          email: string;
        }[];
      };
      create_group_with_members: {
        Args: { p_name: string; p_member_ids: string[]; p_currency?: string };
        Returns: Database["public"]["Tables"]["groups"]["Row"];
      };
      add_group_members: {
        Args: { p_group_id: string; p_member_ids: string[] };
        Returns: void;
      };
      rename_group: {
        Args: { p_group_id: string; p_name: string };
        Returns: Database["public"]["Tables"]["groups"]["Row"];
      };
      get_group_pairwise_balances: {
        Args: { p_group_id: string };
        Returns: {
          from_user: string;
          from_name: string;
          to_user: string;
          to_name: string;
          amount: number;
        }[];
      };
      get_group_simplified_edges: {
        Args: { p_group_id: string };
        Returns: {
          from_user: string;
          from_name: string;
          to_user: string;
          to_name: string;
          amount: number;
        }[];
      };
      create_expense_with_splits: {
        Args: {
          p_group_id: string;
          p_paid_by: string;
          p_amount: number;
          p_description: string;
          p_category: string | null;
          p_split_type: SplitType;
          p_splits: { userId: string; amount: number; baseAmount: number }[];
          p_date?: string | null;
          p_currency?: string;
          p_exchange_rate?: number;
        };
        Returns: Database["public"]["Tables"]["expenses"]["Row"];
      };
      update_expense_with_splits: {
        Args: {
          p_expense_id: string;
          p_paid_by: string;
          p_amount: number;
          p_description: string;
          p_category: string | null;
          p_split_type: SplitType;
          p_splits: { userId: string; amount: number; baseAmount: number }[];
          p_date?: string | null;
          p_currency?: string;
          p_exchange_rate?: number;
        };
        Returns: Database["public"]["Tables"]["expenses"]["Row"];
      };
      leave_group: {
        Args: { p_group_id: string };
        Returns: void;
      };
      send_contact_request: {
        Args: { p_recipient_user_id: string };
        Returns: void;
      };
      respond_contact_request: {
        Args: { p_request_id: string; p_accept: boolean };
        Returns: void;
      };
      cancel_contact_request: {
        Args: { p_request_id: string };
        Returns: void;
      };
      get_contact_requests: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          direction: "incoming" | "outgoing";
          status: "pending" | "accepted" | "declined";
          created_at: string;
          user_id: string;
          full_name: string;
          avatar_url: string | null;
        }[];
      };
      create_contact_expense_with_splits: {
        Args: {
          p_contact_user_id: string;
          p_paid_by: string;
          p_amount: number;
          p_description: string;
          p_category: string | null;
          p_split_type: SplitType;
          p_splits: { userId: string; amount: number; baseAmount: number }[];
          p_date?: string | null;
          p_currency?: string;
          p_exchange_rate?: number;
        };
        Returns: Database["public"]["Tables"]["contact_expenses"]["Row"];
      };
      update_contact_expense_with_splits: {
        Args: {
          p_expense_id: string;
          p_paid_by: string;
          p_amount: number;
          p_description: string;
          p_category: string | null;
          p_split_type: SplitType;
          p_splits: { userId: string; amount: number; baseAmount: number }[];
          p_date?: string | null;
          p_currency?: string;
          p_exchange_rate?: number;
        };
        Returns: Database["public"]["Tables"]["contact_expenses"]["Row"];
      };
      get_contact_balance: {
        Args: { p_contact_user_id: string };
        Returns: number;
      };
      get_contacts_with_balances: {
        Args: Record<string, never>;
        Returns: {
          contact_user_id: string;
          full_name: string;
          avatar_url: string | null;
          balance: number;
        }[];
      };
      get_contact_balance_contexts: {
        Args: { p_contact_user_id: string };
        Returns: {
          currency: string;
          balance: number;
        }[];
      };
      get_contact_currency: {
        Args: { p_contact_user_id: string };
        Returns: string;
      };
      set_contact_currency: {
        Args: { p_contact_user_id: string; p_currency: string };
        Returns: string;
      };
      set_group_currency: {
        Args: { p_group_id: string; p_currency: string };
        Returns: Database["public"]["Tables"]["groups"]["Row"];
      };
      set_group_simplify_debts: {
        Args: { p_group_id: string; p_enabled: boolean };
        Returns: Database["public"]["Tables"]["groups"]["Row"];
      };
      get_contacts_with_combined_balances: {
        Args: Record<string, never>;
        Returns: {
          contact_user_id: string;
          full_name: string;
          avatar_url: string | null;
          currency: string;
          balance: number;
          is_accepted: boolean;
        }[];
      };
      get_contact_group_breakdown: {
        Args: { p_contact_user_id: string };
        Returns: {
          group_id: string;
          group_name: string;
          balance: number;
          currency: string;
        }[];
      };
    };
    Enums: {
      split_type: SplitType;
    };
    CompositeTypes: {};
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Group = Database["public"]["Tables"]["groups"]["Row"];
export type GroupMember = Database["public"]["Tables"]["group_members"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
export type ExpenseSplit = Database["public"]["Tables"]["expense_splits"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];
export type Contact = Database["public"]["Tables"]["contacts"]["Row"];
export type ContactExpense =
  Database["public"]["Tables"]["contact_expenses"]["Row"];
export type ContactExpenseSplit =
  Database["public"]["Tables"]["contact_expense_splits"]["Row"];
export type ContactPayment =
  Database["public"]["Tables"]["contact_payments"]["Row"];

export interface ContactWithBalance {
  contact_user_id: string;
  full_name: string;
  avatar_url: string | null;
  balance: number;
  is_accepted: boolean;
}

export interface ContactExpenseWithSplits extends ContactExpense {
  expense_splits: (ContactExpenseSplit & { profiles: Profile })[];
  payer: Profile;
}

export interface GroupBalance {
  user_id: string;
  full_name: string;
  balance: number;
}

export interface DebtEdge {
  from: string;
  from_name: string;
  to: string;
  to_name: string;
  amount: number;
}

export interface ExpenseWithSplits extends Expense {
  expense_splits: (ExpenseSplit & { profiles: Profile })[];
  payer: Profile;
}

export interface PaymentWithProfiles extends Payment {
  payer: Profile;
  payee: Profile;
}

export interface ContactPaymentWithProfiles extends ContactPayment {
  payer: Profile;
  payee: Profile;
}

export interface GroupWithMembers extends Group {
  group_members: (GroupMember & { profiles: Profile })[];
}

export interface ContactGroupBreakdown {
  group_id: string;
  group_name: string;
  balance: number;
  currency: string;
}

export interface ContactRequest {
  id: string;
  direction: "incoming" | "outgoing";
  status: "pending" | "accepted" | "declined";
  created_at: string;
  profile: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}
