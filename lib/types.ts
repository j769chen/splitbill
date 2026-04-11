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
      };
    };
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
    };
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Group = Database["public"]["Tables"]["groups"]["Row"];
export type GroupMember = Database["public"]["Tables"]["group_members"]["Row"];
export type Expense = Database["public"]["Tables"]["expenses"]["Row"];
export type ExpenseSplit = Database["public"]["Tables"]["expense_splits"]["Row"];
export type Payment = Database["public"]["Tables"]["payments"]["Row"];

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

export interface GroupWithMembers extends Group {
  group_members: (GroupMember & { profiles: Profile })[];
}
