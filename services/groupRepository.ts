import { supabase } from '../lib/supabase';

export interface User {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  mainCurrencyCode: string;
  createdAt: string;
}

export interface GroupWithMembers extends Group {
  members: User[];
}

export async function createUser(name: string, email?: string): Promise<User | null> {
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      throw new Error('No authenticated user');
    }

    const { data, error } = await supabase
      .from('users')
      .insert({ id: authUser.id, name, email: email || authUser.email || null })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      email: data.email || undefined,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Failed to create user:', error);
    return null;
  }
}

export async function ensureUserProfile(name?: string): Promise<User | null> {
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      throw new Error('No authenticated user');
    }

    const existingUser = await getUser(authUser.id);
    if (existingUser) {
      return existingUser;
    }

    const { data, error } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        name: name || authUser.email?.split('@')[0] || 'User',
        email: authUser.email || null
      })
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      email: data.email || undefined,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Failed to ensure user profile:', error);
    return null;
  }
}

export async function getAllUsers(): Promise<User[]> {
  try {
    const { data, error } = await supabase.from('users').select('*');

    if (error) throw error;

    return (data || []).map(u => ({
      id: u.id,
      name: u.name,
      email: u.email || undefined,
      createdAt: u.created_at,
    }));
  } catch (error) {
    console.error('Failed to get all users:', error);
    return [];
  }
}

export async function getUser(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      name: data.name,
      email: data.email || undefined,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Failed to get user:', error);
    return null;
  }
}

export async function updateUserName(userId: string, name: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .update({ name })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;

    return {
      id: data.id,
      name: data.name,
      email: data.email || undefined,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Failed to update user name:', error);
    return null;
  }
}

export async function createGroup(
  name: string,
  mainCurrencyCode: string,
  memberIds: string[]
): Promise<Group | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('No authenticated user');
    }

    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .insert({ name, main_currency_code: mainCurrencyCode, created_by: user.id })
      .select()
      .single();

    if (groupError) {
      console.error('Group creation error details:', groupError);
      throw groupError;
    }

    const groupId = groupData.id;

    for (const userId of memberIds) {
      const { error: memberError } = await supabase.from('group_members').insert({
        group_id: groupId,
        user_id: userId,
      });

      if (memberError) {
        console.warn(`Failed to add member ${userId} to group:`, memberError);
      }
    }

    return {
      id: groupData.id,
      name: groupData.name,
      mainCurrencyCode: groupData.main_currency_code,
      createdAt: groupData.created_at,
    };
  } catch (error) {
    console.error('Failed to create group:', error);
    return null;
  }
}

export async function getGroup(groupId: string): Promise<GroupWithMembers | null> {
  try {
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .maybeSingle();

    if (groupError) throw groupError;
    if (!groupData) return null;

    const { data: memberData, error: memberError } = await supabase
      .from('group_members')
      .select('users(*)')
      .eq('group_id', groupId);

    if (memberError) throw memberError;

    const members = (memberData || []).map(m => {
      const u = m.users as any;
      return {
        id: u.id,
        name: u.name,
        email: u.email || undefined,
        createdAt: u.created_at,
      };
    });

    return {
      id: groupData.id,
      name: groupData.name,
      mainCurrencyCode: groupData.main_currency_code,
      createdAt: groupData.created_at,
      members,
    };
  } catch (error) {
    console.error('Failed to get group:', error);
    return null;
  }
}

export async function getAllGroups(): Promise<GroupWithMembers[]> {
  try {
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .order('created_at', { ascending: false });

    if (groupError) throw groupError;

    const groups: GroupWithMembers[] = [];

    for (const g of groupData || []) {
      const { data: memberData } = await supabase
        .from('group_members')
        .select('users(*)')
        .eq('group_id', g.id);

      const members = (memberData || []).map(m => {
        const u = m.users as any;
        return {
          id: u.id,
          name: u.name,
          email: u.email || undefined,
          createdAt: u.created_at,
        };
      });

      groups.push({
        id: g.id,
        name: g.name,
        mainCurrencyCode: g.main_currency_code,
        createdAt: g.created_at,
        members,
      });
    }

    return groups;
  } catch (error) {
    console.error('Failed to get all groups:', error);
    return [];
  }
}

export interface Expense {
  id: string;
  groupId: string;
  description?: string;
  dateTime: string;
  currencyCode: string;
  totalAmountScaled: bigint;
  payerUserId: string;
  exchangeRateToMainScaled: bigint;
  totalInMainScaled: bigint;
  createdAt: string;
  shares: ExpenseShare[];
}

export interface ExpenseShare {
  id: string;
  userId: string;
  shareAmountScaled: bigint;
  shareInMainScaled: bigint;
}

export async function createExpense(
  groupId: string,
  description: string | undefined,
  dateTime: string,
  currencyCode: string,
  totalAmountScaled: bigint,
  payerUserId: string,
  exchangeRateToMainScaled: bigint,
  totalInMainScaled: bigint,
  shares: Array<{ userId: string; shareAmountScaled: bigint; shareInMainScaled: bigint }>
): Promise<Expense | null> {
  try {
    const { data: expenseData, error: expenseError } = await supabase
      .from('expenses')
      .insert({
        group_id: groupId,
        description: description || null,
        date_time: dateTime,
        currency_code: currencyCode,
        total_amount_scaled: Number(totalAmountScaled),
        payer_user_id: payerUserId,
        exchange_rate_to_main_scaled: Number(exchangeRateToMainScaled),
        total_in_main_scaled: Number(totalInMainScaled),
      })
      .select()
      .single();

    if (expenseError) throw expenseError;

    const expenseId = expenseData.id;

    const shareRows = shares.map(s => ({
      expense_id: expenseId,
      user_id: s.userId,
      share_amount_scaled: Number(s.shareAmountScaled),
      share_in_main_scaled: Number(s.shareInMainScaled),
    }));

    const { error: shareError } = await supabase.from('expense_shares').insert(shareRows);

    if (shareError) throw shareError;

    return {
      id: expenseData.id,
      groupId: expenseData.group_id,
      description: expenseData.description || undefined,
      dateTime: expenseData.date_time,
      currencyCode: expenseData.currency_code,
      totalAmountScaled: BigInt(expenseData.total_amount_scaled),
      payerUserId: expenseData.payer_user_id,
      exchangeRateToMainScaled: BigInt(expenseData.exchange_rate_to_main_scaled),
      totalInMainScaled: BigInt(expenseData.total_in_main_scaled),
      createdAt: expenseData.created_at,
      shares: shares.map(s => ({
        id: '',
        userId: s.userId,
        shareAmountScaled: s.shareAmountScaled,
        shareInMainScaled: s.shareInMainScaled,
      })),
    };
  } catch (error) {
    console.error('Failed to create expense:', error);
    return null;
  }
}

export async function getGroupExpenses(groupId: string): Promise<Expense[]> {
  try {
    const { data: expenseData, error: expenseError } = await supabase
      .from('expenses')
      .select('*')
      .eq('group_id', groupId)
      .order('date_time', { ascending: false });

    if (expenseError) throw expenseError;

    const expenses: Expense[] = [];

    for (const e of expenseData || []) {
      const { data: shareData } = await supabase
        .from('expense_shares')
        .select('*')
        .eq('expense_id', e.id);

      expenses.push({
        id: e.id,
        groupId: e.group_id,
        description: e.description || undefined,
        dateTime: e.date_time,
        currencyCode: e.currency_code,
        totalAmountScaled: BigInt(e.total_amount_scaled),
        payerUserId: e.payer_user_id,
        exchangeRateToMainScaled: BigInt(e.exchange_rate_to_main_scaled),
        totalInMainScaled: BigInt(e.total_in_main_scaled),
        createdAt: e.created_at,
        shares: (shareData || []).map(s => ({
          id: s.id,
          userId: s.user_id,
          shareAmountScaled: BigInt(s.share_amount_scaled),
          shareInMainScaled: BigInt(s.share_in_main_scaled),
        })),
      });
    }

    return expenses;
  } catch (error) {
    console.error('Failed to get group expenses:', error);
    return [];
  }
}
