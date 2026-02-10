import { supabase } from '../lib/supabase';

export interface User {
  id: string;
  name: string;
  email?: string;
  createdAt: string;
}

export interface GroupMember {
  id: string;
  groupId: string;
  name: string;
  email?: string;
  connectedUserId?: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  mainCurrencyCode: string;
  createdAt: string;
}

export interface GroupWithMembers extends Group {
  members: GroupMember[];
}

async function resolveCurrentUserId(
  currentUserId?: string,
): Promise<string | null> {
  if (currentUserId) {
    return currentUserId;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.user?.id || null;
}

// Ensures a row exists in the `users` table for the current user
export async function ensureUserProfile(
  name?: string,
  currentUserId?: string,
): Promise<User | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const authUser = session?.user;
    const authUserId = currentUserId || authUser?.id;

    if (!authUserId) {
      throw new Error('No authenticated user');
    }

    if (authUser && currentUserId && authUser.id !== currentUserId) {
      throw new Error('Authenticated user mismatch');
    }

    const existingUser = await getUser(authUserId);
    if (existingUser) {
      return existingUser;
    }

    if (!authUser || authUser.id !== authUserId) {
      throw new Error(
        'Missing authenticated user details required to create profile',
      );
    }

    const resolvedName =
      name?.trim() ||
      (typeof authUser?.user_metadata?.name === 'string'
        ? authUser.user_metadata.name.trim()
        : '') ||
      authUser?.email?.split('@')[0] ||
      'User';

    const { data, error } = await supabase
      .from('users')
      .insert({
        id: authUserId,
        name: resolvedName,
        email: authUser?.email || null,
      })
      .select()
      .single();

    if (error) throw error;

    await connectUserToGroups();

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

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
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
    console.error('Failed to get user by email:', error);
    return null;
  }
}

export async function updateUserName(
  userId: string,
  name: string,
): Promise<User | null> {
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

export async function createGroupMember(
  groupId: string,
  name: string,
  email?: string,
  connectedUserId?: string,
): Promise<GroupMember | null> {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .insert({
        group_id: groupId,
        name,
        email: email || null,
        connected_user_id: connectedUserId || null,
      })
      .select()
      .single();

    if (error) throw error;

    const member = {
      id: data.id,
      groupId: data.group_id,
      name: data.name,
      email: data.email || undefined,
      connectedUserId: data.connected_user_id || undefined,
      createdAt: data.created_at,
    };

    // Update known users if the member is connected to a user
    if (connectedUserId) {
      await updateKnownUsersForMember(groupId, data.id);
    }

    return member;
  } catch (error) {
    console.error('Failed to create group member:', error);
    return null;
  }
}

export async function getGroupMembers(
  groupId: string,
  currentUserId?: string,
): Promise<GroupMember[] | null> {
  try {
    const resolvedCurrentUserId = await resolveCurrentUserId(currentUserId);

    const { data, error } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Failed to get group members:', error);
      return null;
    }

    const members = (data || []).map((m) => ({
      id: m.id,
      groupId: m.group_id,
      name: m.name,
      email: m.email || undefined,
      connectedUserId: m.connected_user_id || undefined,
      createdAt: m.created_at,
    }));

    if (!resolvedCurrentUserId) return members;

    const currentMemberIndex = members.findIndex(
      (member) => member.connectedUserId === resolvedCurrentUserId,
    );

    if (currentMemberIndex <= 0) return members;

    const [currentMember] = members.splice(currentMemberIndex, 1);
    members.unshift(currentMember);

    return members;
  } catch (error) {
    console.error('Failed to get group members:', error);
    return null;
  }
}

export async function getGroupMember(
  memberId: string,
): Promise<GroupMember | null> {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select('*')
      .eq('id', memberId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      groupId: data.group_id,
      name: data.name,
      email: data.email || undefined,
      connectedUserId: data.connected_user_id || undefined,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Failed to get group member:', error);
    return null;
  }
}

export async function getCurrentUserMemberInGroup(
  groupId: string,
  currentUserId?: string,
): Promise<GroupMember | null> {
  try {
    const resolvedCurrentUserId = await resolveCurrentUserId(currentUserId);
    if (!resolvedCurrentUserId) return null;

    const { data, error } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('connected_user_id', resolvedCurrentUserId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;

    return {
      id: data.id,
      groupId: data.group_id,
      name: data.name,
      email: data.email || undefined,
      connectedUserId: data.connected_user_id || undefined,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Failed to get current user member:', error);
    return null;
  }
}

export async function connectUserToGroupMembers(
  userId: string,
  email: string,
): Promise<number> {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .update({ connected_user_id: userId })
      .eq('email', email)
      .is('connected_user_id', null)
      .select();

    if (error) throw error;

    return data?.length || 0;
  } catch (error) {
    console.error('Failed to connect user to group members:', error);
    return 0;
  }
}

export async function createGroup(
  name: string,
  mainCurrencyCode: string,
  initialMembers: { name: string; email?: string }[],
): Promise<Group | null> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      throw new Error('No session token available');
    }

    const { data, error } = await supabase.functions.invoke('create-group', {
      body: { name, mainCurrencyCode, initialMembers },
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (error) {
      console.error('Create group function error:', error);
      throw new Error(error.message || 'Failed to create group');
    }

    if (!data?.success || !data?.group) {
      throw new Error(data?.error || 'Failed to create group');
    }

    return {
      id: data.group.id,
      name: data.group.name,
      mainCurrencyCode: data.group.mainCurrencyCode,
      createdAt: data.group.createdAt,
    };
  } catch (error) {
    console.error('Failed to create group:', error);
    return null;
  }
}

export async function getGroup(
  groupId: string,
  currentUserId?: string,
): Promise<GroupWithMembers | null> {
  try {
    const { data: groupData, error: groupError } = await supabase
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .maybeSingle();

    if (groupError) throw groupError;
    if (!groupData) return null;

    const members = await getGroupMembers(groupId, currentUserId);
    if (!members) return null;

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
      .select(
        `
        *,
        group_members (
          id,
          group_id,
          name,
          email,
          connected_user_id,
          created_at
        )
      `,
      )
      .order('created_at', { ascending: false });

    if (groupError) throw groupError;

    const groups: GroupWithMembers[] = (groupData || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      mainCurrencyCode: g.main_currency_code,
      createdAt: g.created_at,
      members: (g.group_members || [])
        .map((m: any) => ({
          id: m.id,
          groupId: m.group_id,
          name: m.name,
          email: m.email || undefined,
          connectedUserId: m.connected_user_id || undefined,
          createdAt: m.created_at,
        }))
        .sort(
          (a: any, b: any) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        ),
    }));

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
  payerMemberId: string;
  exchangeRateToMainScaled: bigint;
  totalInMainScaled: bigint;
  createdAt: string;
  shares: ExpenseShare[];
  paymentType?: 'expense' | 'transfer';
  splitType?: 'equal' | 'percentage' | 'exact';
}

export interface ExpenseShare {
  id: string;
  memberId: string;
  shareAmountScaled: bigint;
  shareInMainScaled: bigint;
}

export interface ActivityFeedItem {
  id: string;
  groupId: string;
  groupName: string;
  description?: string;
  dateTime: string;
  currencyCode: string;
  totalAmountScaled: bigint;
  payerMemberId: string;
  payerName: string;
  paymentType: 'expense' | 'transfer';
  splitType: 'equal' | 'percentage' | 'exact';
  createdAt: string;
}

export async function getActivityFeed(
  limit = 100,
  offset = 0,
): Promise<ActivityFeedItem[]> {
  try {
    const normalizedLimit = Math.min(Math.max(limit, 0), 500);
    const normalizedOffset = Math.max(offset, 0);

    const { data, error } = await supabase.rpc('get_activity_feed', {
      p_limit: normalizedLimit,
      p_offset: normalizedOffset,
    });

    if (error) throw error;

    return (data || []).map((row: any) => ({
      id: row.id,
      groupId: row.group_id,
      groupName: row.group_name,
      description: row.description || undefined,
      dateTime: row.date_time,
      currencyCode: row.currency_code,
      totalAmountScaled: BigInt(row.total_amount_scaled),
      payerMemberId: row.payer_member_id || '',
      payerName: row.payer_name || 'Unknown',
      paymentType: row.payment_type || 'expense',
      splitType: row.split_type || 'equal',
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error('Failed to get activity feed:', error);
    return [];
  }
}

export async function createExpense(
  groupId: string,
  description: string | undefined,
  dateTime: string,
  currencyCode: string,
  totalAmountScaled: bigint,
  payerMemberId: string,
  exchangeRateToMainScaled: bigint,
  totalInMainScaled: bigint,
  shares: {
    memberId: string;
    shareAmountScaled: bigint;
    shareInMainScaled: bigint;
  }[],
  paymentType: 'expense' | 'transfer' = 'expense',
  splitType: 'equal' | 'percentage' | 'exact' = 'equal',
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
        payer_member_id: payerMemberId,
        exchange_rate_to_main_scaled: Number(exchangeRateToMainScaled),
        total_in_main_scaled: Number(totalInMainScaled),
        payment_type: paymentType,
        split_type: splitType,
      })
      .select()
      .single();

    if (expenseError) throw expenseError;

    const expenseId = expenseData.id;

    const shareRows = shares.map((s) => ({
      expense_id: expenseId,
      member_id: s.memberId,
      share_amount_scaled: Number(s.shareAmountScaled),
      share_in_main_scaled: Number(s.shareInMainScaled),
    }));

    const { error: shareError } = await supabase
      .from('expense_shares')
      .insert(shareRows);

    if (shareError) throw shareError;

    return {
      id: expenseData.id,
      groupId: expenseData.group_id,
      description: expenseData.description || undefined,
      dateTime: expenseData.date_time,
      currencyCode: expenseData.currency_code,
      totalAmountScaled: BigInt(expenseData.total_amount_scaled),
      payerMemberId: expenseData.payer_member_id,
      exchangeRateToMainScaled: BigInt(
        expenseData.exchange_rate_to_main_scaled,
      ),
      totalInMainScaled: BigInt(expenseData.total_in_main_scaled),
      createdAt: expenseData.created_at,
      paymentType:
        (expenseData.payment_type as 'expense' | 'transfer') || 'expense',
      splitType:
        (expenseData.split_type as 'equal' | 'percentage' | 'exact') || 'equal',
      shares: shares.map((s) => ({
        id: '',
        memberId: s.memberId,
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
      .select(
        `
        *,
        expense_shares (
          id,
          member_id,
          share_amount_scaled,
          share_in_main_scaled
        )
      `,
      )
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });

    if (expenseError) throw expenseError;

    const expenses: Expense[] = (expenseData || []).map((e: any) => ({
      id: e.id,
      groupId: e.group_id,
      description: e.description || undefined,
      dateTime: e.date_time,
      currencyCode: e.currency_code,
      totalAmountScaled: BigInt(e.total_amount_scaled),
      payerMemberId: e.payer_member_id,
      exchangeRateToMainScaled: BigInt(e.exchange_rate_to_main_scaled),
      totalInMainScaled: BigInt(e.total_in_main_scaled),
      createdAt: e.created_at,
      paymentType: e.payment_type || 'expense',
      splitType: e.split_type || 'equal',
      shares: (e.expense_shares || []).map((s: any) => ({
        id: s.id,
        memberId: s.member_id,
        shareAmountScaled: BigInt(s.share_amount_scaled),
        shareInMainScaled: BigInt(s.share_in_main_scaled),
      })),
    }));

    return expenses;
  } catch (error) {
    console.error('Failed to get group expenses:', error);
    return [];
  }
}

export async function getExpense(expenseId: string): Promise<Expense | null> {
  try {
    const { data: expenseData, error: expenseError } = await supabase
      .from('expenses')
      .select('*')
      .eq('id', expenseId)
      .maybeSingle();

    if (expenseError) throw expenseError;
    if (!expenseData) return null;

    const { data: shareData } = await supabase
      .from('expense_shares')
      .select('*')
      .eq('expense_id', expenseData.id);

    return {
      id: expenseData.id,
      groupId: expenseData.group_id,
      description: expenseData.description || undefined,
      dateTime: expenseData.date_time,
      currencyCode: expenseData.currency_code,
      totalAmountScaled: BigInt(expenseData.total_amount_scaled),
      payerMemberId: expenseData.payer_member_id,
      exchangeRateToMainScaled: BigInt(
        expenseData.exchange_rate_to_main_scaled,
      ),
      totalInMainScaled: BigInt(expenseData.total_in_main_scaled),
      createdAt: expenseData.created_at,
      paymentType:
        (expenseData.payment_type as 'expense' | 'transfer') || 'expense',
      splitType:
        (expenseData.split_type as 'equal' | 'percentage' | 'exact') || 'equal',
      shares: (shareData || []).map((s) => ({
        id: s.id,
        memberId: s.member_id,
        shareAmountScaled: BigInt(s.share_amount_scaled),
        shareInMainScaled: BigInt(s.share_in_main_scaled),
      })),
    };
  } catch (error) {
    console.error('Failed to get expense:', error);
    return null;
  }
}

export async function updateExpense(
  expenseId: string,
  description: string | undefined,
  dateTime: string,
  currencyCode: string,
  totalAmountScaled: bigint,
  payerMemberId: string,
  exchangeRateToMainScaled: bigint,
  totalInMainScaled: bigint,
  shares: {
    memberId: string;
    shareAmountScaled: bigint;
    shareInMainScaled: bigint;
  }[],
  splitType: 'equal' | 'percentage' | 'exact' = 'equal',
): Promise<Expense | null> {
  try {
    const { data: expenseData, error: expenseError } = await supabase
      .from('expenses')
      .update({
        description: description || null,
        date_time: dateTime,
        currency_code: currencyCode,
        total_amount_scaled: Number(totalAmountScaled),
        payer_member_id: payerMemberId,
        exchange_rate_to_main_scaled: Number(exchangeRateToMainScaled),
        total_in_main_scaled: Number(totalInMainScaled),
        split_type: splitType,
      })
      .eq('id', expenseId)
      .select()
      .single();

    if (expenseError) throw expenseError;

    const { error: deleteSharesError } = await supabase
      .from('expense_shares')
      .delete()
      .eq('expense_id', expenseId);

    if (deleteSharesError) throw deleteSharesError;

    const shareRows = shares.map((s) => ({
      expense_id: expenseId,
      member_id: s.memberId,
      share_amount_scaled: Number(s.shareAmountScaled),
      share_in_main_scaled: Number(s.shareInMainScaled),
    }));

    const { error: shareError } = await supabase
      .from('expense_shares')
      .insert(shareRows);

    if (shareError) throw shareError;

    return {
      id: expenseData.id,
      groupId: expenseData.group_id,
      description: expenseData.description || undefined,
      dateTime: expenseData.date_time,
      currencyCode: expenseData.currency_code,
      totalAmountScaled: BigInt(expenseData.total_amount_scaled),
      payerMemberId: expenseData.payer_member_id,
      exchangeRateToMainScaled: BigInt(
        expenseData.exchange_rate_to_main_scaled,
      ),
      totalInMainScaled: BigInt(expenseData.total_in_main_scaled),
      createdAt: expenseData.created_at,
      paymentType:
        (expenseData.payment_type as 'expense' | 'transfer') || 'expense',
      splitType:
        (expenseData.split_type as 'equal' | 'percentage' | 'exact') || 'equal',
      shares: shares.map((s) => ({
        id: '',
        memberId: s.memberId,
        shareAmountScaled: s.shareAmountScaled,
        shareInMainScaled: s.shareInMainScaled,
      })),
    };
  } catch (error) {
    console.error('Failed to update expense:', error);
    return null;
  }
}

export async function deleteExpense(expenseId: string): Promise<boolean> {
  try {
    const { error: sharesError } = await supabase
      .from('expense_shares')
      .delete()
      .eq('expense_id', expenseId);

    if (sharesError) throw sharesError;

    const { error: expenseError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expenseId);

    if (expenseError) throw expenseError;

    return true;
  } catch (error) {
    console.error('Failed to delete expense:', error);
    return false;
  }
}

export async function updateGroupMember(
  memberId: string,
  name: string,
  email?: string,
  connectedUserId?: string,
): Promise<GroupMember | null> {
  try {
    // Get the current member to check if connected_user_id is changing
    const currentMember = await getGroupMember(memberId);
    const connectionChanged =
      currentMember &&
      currentMember.connectedUserId !== connectedUserId &&
      connectedUserId;

    const { data, error } = await supabase
      .from('group_members')
      .update({
        name,
        email: email || null,
        connected_user_id: connectedUserId || null,
      })
      .eq('id', memberId)
      .select()
      .single();

    if (error) throw error;

    const updatedMember = {
      id: data.id,
      groupId: data.group_id,
      name: data.name,
      email: data.email || undefined,
      connectedUserId: data.connected_user_id || undefined,
      createdAt: data.created_at,
    };

    // Update known users if connection changed to a new user
    if (connectionChanged) {
      await updateKnownUsersForMember(data.group_id, data.id);
    }

    return updatedMember;
  } catch (error) {
    console.error('Failed to update group member:', error);
    return null;
  }
}

export async function canDeleteGroupMember(memberId: string): Promise<boolean> {
  try {
    // Check if member has any non-zero shares or is the payer on any expense.
    const [
      { data: shareData, error: shareError },
      { data: payerData, error: payerError },
    ] = await Promise.all([
      supabase
        .from('expense_shares')
        .select('id')
        .eq('member_id', memberId)
        .neq('share_amount_scaled', 0)
        .limit(1),
      supabase
        .from('expenses')
        .select('id')
        .eq('payer_member_id', memberId)
        .limit(1),
    ]);

    if (shareError) throw shareError;
    if (payerError) throw payerError;

    // Member can be deleted if they have no non-zero shares and are not a payer.
    return shareData.length === 0 && payerData.length === 0;
  } catch (error) {
    console.error('Failed to check if member can be deleted:', error);
    return false;
  }
}

export async function deleteGroupMember(memberId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('group_members')
      .delete()
      .eq('id', memberId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Failed to delete group member:', error);
    return false;
  }
}

export async function leaveGroup(
  groupId: string,
  currentUserId?: string,
): Promise<boolean> {
  try {
    const resolvedCurrentUserId = await resolveCurrentUserId(currentUserId);
    if (!resolvedCurrentUserId) {
      throw new Error('No authenticated user');
    }

    const currentMember = await getCurrentUserMemberInGroup(
      groupId,
      resolvedCurrentUserId,
    );
    if (!currentMember) {
      throw new Error('You are not a member of this group');
    }

    const { error } = await supabase
      .from('group_members')
      .update({ connected_user_id: null })
      .eq('id', currentMember.id);

    if (error) throw error;

    try {
      console.log('Triggering cleanup-orphaned-groups function...');
      const { error: cleanupError } = await supabase.functions.invoke(
        'cleanup-orphaned-groups',
      );
      if (cleanupError) {
        console.error('Cleanup function failed:', cleanupError);
        if ('context' in cleanupError) {
          console.error(
            'Cleanup function error context:',
            cleanupError.context,
          );
        }
      } else {
        console.log('Cleanup function succeeded');
      }
    } catch (cleanupError) {
      console.error('Failed to trigger cleanup:', cleanupError);
    }

    return true;
  } catch (error) {
    console.error('Failed to leave group:', error);
    return false;
  }
}

export async function deleteUserAccount(
  currentUserId?: string,
): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const resolvedCurrentUserId = currentUserId || session?.user?.id;
    if (!resolvedCurrentUserId) {
      throw new Error('No authenticated user');
    }

    const token = session?.access_token;

    if (!token) {
      throw new Error('No session token available');
    }

    const { error: deleteError } = await supabase.functions.invoke(
      'delete-user',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );
    if (deleteError) {
      throw new Error(deleteError.message || 'Failed to delete user account');
    }

    await supabase.auth.signOut();

    return true;
  } catch (error) {
    console.error('Failed to delete user account:', error);
    return false;
  }
}

export async function connectUserToGroups(): Promise<number> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      console.warn('No session token available for connecting to groups');
      return 0;
    }

    console.log('Calling connect-user-to-groups edge function');

    const { data, error } = await supabase.functions.invoke(
      'connect-user-to-groups',
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (error) {
      console.error('Error connecting user to groups:', error);
      return 0;
    }

    if (data?.error) {
      console.error('Error from edge function:', data.error);
      return 0;
    }

    const connectedCount = data?.connectedCount || 0;
    console.log(`Successfully connected to ${connectedCount} group(s)`);

    return connectedCount;
  } catch (error) {
    console.error('Failed to connect user to groups:', error);
    return 0;
  }
}

export async function sendInvitationEmail(
  email: string,
  groupName: string,
): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('send-invitation', {
      body: { email, groupName },
    });

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    return false;
  }
}

export interface KnownUser {
  id: string;
  name: string;
  email?: string;
}

type KnownUserRow = {
  users: {
    id: string;
    name: string;
    email: string | null;
  } | null;
};

export async function getKnownUsers(
  currentUserId?: string,
): Promise<KnownUser[]> {
  try {
    const resolvedCurrentUserId = await resolveCurrentUserId(currentUserId);
    if (!resolvedCurrentUserId) {
      return [];
    }

    const { data, error } = await supabase
      .from('user_known_users')
      .select(
        `
        known_user_id,
        users!user_known_users_known_user_id_fkey (
          id,
          name,
          email
        )
      `,
      )
      .eq('user_id', resolvedCurrentUserId)
      .order('last_shared_at', { ascending: false });

    if (error) {
      console.error('Error fetching known users:', error);
      return [];
    }

    return (data || [])
      .map((item: KnownUserRow): KnownUser | null => {
        const knownUser = item.users;
        if (!knownUser) return null;
        return {
          id: knownUser.id,
          name: knownUser.name,
          email: knownUser.email ?? undefined,
        };
      })
      .filter((u): u is KnownUser => u !== null);
  } catch (error) {
    console.error('Failed to get known users:', error);
    return [];
  }
}

export async function updateKnownUsersForMember(
  groupId: string,
  memberId: string,
): Promise<boolean> {
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (!token) {
      console.warn('No session token available for updating known users');
      return false;
    }

    const { data, error } = await supabase.functions.invoke(
      'update-known-users',
      {
        body: { groupId, newMemberId: memberId },
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (error) {
      let errorDetails = '';
      if (error instanceof Error && 'context' in error) {
        try {
          const response = (error as { context?: Response }).context;
          if (response) {
            const payload = await response.json();
            errorDetails = JSON.stringify(payload);
          }
        } catch {
          errorDetails = '';
        }
      }
      console.error('Error updating known users:', error, errorDetails);
      return false;
    }

    if (data?.error) {
      console.error('Error updating known users:', data.error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Failed to update known users:', error);
    return false;
  }
}
