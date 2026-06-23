export type SplitType = "equal" | "exact" | "percentage";

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
        };
        Insert: {
          id?: string;
          name: string;
          image_url?: string | null;
          created_by: string;
        };
        Update: {
          name?: string;
          image_url?: string | null;
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
        };
        Update: {
          amount?: number;
          description?: string;
          category?: string | null;
          split_type?: SplitType;
          date?: string;
        };
        Relationships: [];
      };
      expense_splits: {
        Row: {
          id: string;
          expense_id: string;
          user_id: string;
          amount: number;
        };
        Insert: {
          id?: string;
          expense_id: string;
          user_id: string;
          amount: number;
        };
        Update: {
          amount?: number;
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
        };
        Insert: {
          id?: string;
          group_id: string;
          paid_by: string;
          paid_to: string;
          amount: number;
          note?: string | null;
        };
        Update: {
          amount?: number;
          note?: string | null;
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
        };
        Update: {
          amount?: number;
          description?: string;
          category?: string | null;
          split_type?: SplitType;
          date?: string;
        };
        Relationships: [];
      };
      contact_expense_splits: {
        Row: {
          id: string;
          expense_id: string;
          user_id: string;
          amount: number;
        };
        Insert: {
          id?: string;
          expense_id: string;
          user_id: string;
          amount: number;
        };
        Update: {
          amount?: number;
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
          total_owed: number;
          total_owing: number;
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
        Args: { p_name: string; p_member_ids: string[] };
        Returns: Database["public"]["Tables"]["groups"]["Row"];
      };
      create_expense_with_splits: {
        Args: {
          p_group_id: string;
          p_paid_by: string;
          p_amount: number;
          p_description: string;
          p_category: string | null;
          p_split_type: SplitType;
          p_splits: { userId: string; amount: number }[];
          p_date?: string | null;
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
          p_splits: { userId: string; amount: number }[];
          p_date?: string | null;
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
      get_contact_combined_balance: {
        Args: { p_contact_user_id: string };
        Returns: number;
      };
      get_contacts_with_combined_balances: {
        Args: Record<string, never>;
        Returns: {
          contact_user_id: string;
          full_name: string;
          avatar_url: string | null;
          balance: number;
        }[];
      };
      get_contact_group_breakdown: {
        Args: { p_contact_user_id: string };
        Returns: {
          group_id: string;
          group_name: string;
          balance: number;
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

export interface ContactWithBalance {
  contact_user_id: string;
  full_name: string;
  avatar_url: string | null;
  balance: number;
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

export interface GroupWithMembers extends Group {
  group_members: (GroupMember & { profiles: Profile })[];
}

export interface ContactGroupBreakdown {
  group_id: string;
  group_name: string;
  balance: number;
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
