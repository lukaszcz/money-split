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
        email: authUser.email || null,
      })
      .select()
      .single();

    if (error) throw error;

    await reconnectGroupMembers();

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

export async function createGroupMember(
  groupId: string,
  name: string,
  email?: string,
  connectedUserId?: string
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

    return {
      id: data.id,
      groupId: data.group_id,
      name: data.name,
      email: data.email || undefined,
      connectedUserId: data.connected_user_id || undefined,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Failed to create group member:', error);
    return null;
  }
}

export async function getGroupMembers(groupId: string): Promise<GroupMember[]> {
  try {
    const { data, error } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return (data || []).map((m) => ({
      id: m.id,
      groupId: m.group_id,
      name: m.name,
      email: m.email || undefined,
      connectedUserId: m.connected_user_id || undefined,
      createdAt: m.created_at,
    }));
  } catch (error) {
    console.error('Failed to get group members:', error);
    return [];
  }
}

export async function getGroupMember(memberId: string): Promise<GroupMember | null> {
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

export async function getCurrentUserMemberInGroup(groupId: string): Promise<GroupMember | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from('group_members')
      .select('*')
      .eq('group_id', groupId)
      .eq('connected_user_id', user.id)
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

export async function connectUserToGroupMembers(userId: string, email: string): Promise<number> {
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
  initialMembers: Array<{ name: string; email?: string }>
): Promise<Group | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('No authenticated user');
    }

    const userProfile = await ensureUserProfile();
    if (!userProfile) {
      throw new Error('Failed to ensure user profile');
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

    const creatorMember = await createGroupMember(
      groupId,
      userProfile.name,
      userProfile.email,
      user.id
    );

    if (!creatorMember) {
      console.warn('Failed to add creator as group member');
    }

    for (const member of initialMembers) {
      let connectedUserId: string | undefined;

      if (member.email) {
        const existingUser = await getUserByEmail(member.email);
        if (existingUser) {
          connectedUserId = existingUser.id;
        }
      }

      const memberName =
        member.name || (member.email ? member.email.split('@')[0] : 'Unknown');

      await createGroupMember(groupId, memberName, member.email, connectedUserId);
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

    const members = await getGroupMembers(groupId);

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
      const members = await getGroupMembers(g.id);

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
  payerMemberId: string;
  exchangeRateToMainScaled: bigint;
  totalInMainScaled: bigint;
  createdAt: string;
  shares: ExpenseShare[];
}

export interface ExpenseShare {
  id: string;
  memberId: string;
  shareAmountScaled: bigint;
  shareInMainScaled: bigint;
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
  shares: Array<{ memberId: string; shareAmountScaled: bigint; shareInMainScaled: bigint }>
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

    const { error: shareError } = await supabase.from('expense_shares').insert(shareRows);

    if (shareError) throw shareError;

    return {
      id: expenseData.id,
      groupId: expenseData.group_id,
      description: expenseData.description || undefined,
      dateTime: expenseData.date_time,
      currencyCode: expenseData.currency_code,
      totalAmountScaled: BigInt(expenseData.total_amount_scaled),
      payerMemberId: expenseData.payer_member_id,
      exchangeRateToMainScaled: BigInt(expenseData.exchange_rate_to_main_scaled),
      totalInMainScaled: BigInt(expenseData.total_in_main_scaled),
      createdAt: expenseData.created_at,
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
        payerMemberId: e.payer_member_id,
        exchangeRateToMainScaled: BigInt(e.exchange_rate_to_main_scaled),
        totalInMainScaled: BigInt(e.total_in_main_scaled),
        createdAt: e.created_at,
        shares: (shareData || []).map((s) => ({
          id: s.id,
          memberId: s.member_id,
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

export async function deleteGroupMember(memberId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('group_members').delete().eq('id', memberId);

    if (error) throw error;

    return true;
  } catch (error) {
    console.error('Failed to delete group member:', error);
    return false;
  }
}

export async function updateGroupMember(
  memberId: string,
  name: string,
  email?: string,
  connectedUserId?: string
): Promise<GroupMember | null> {
  try {
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

    return {
      id: data.id,
      groupId: data.group_id,
      name: data.name,
      email: data.email || undefined,
      connectedUserId: data.connected_user_id || undefined,
      createdAt: data.created_at,
    };
  } catch (error) {
    console.error('Failed to update group member:', error);
    return null;
  }
}

export async function deleteGroup(groupId: string): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('No authenticated user');
    }

    const group = await getGroup(groupId);
    if (!group) {
      throw new Error('Group not found');
    }

    const { data: groupData } = await supabase
      .from('groups')
      .select('created_by')
      .eq('id', groupId)
      .maybeSingle();

    if (!groupData || groupData.created_by !== user.id) {
      throw new Error('Only the group owner can delete the group');
    }

    const expenses = await getGroupExpenses(groupId);
    const expenseIds = expenses.map((e) => e.id);

    if (expenseIds.length > 0) {
      const { error: sharesError } = await supabase
        .from('expense_shares')
        .delete()
        .in('expense_id', expenseIds);

      if (sharesError) throw sharesError;
    }

    const { error: expensesError } = await supabase
      .from('expenses')
      .delete()
      .eq('group_id', groupId);

    if (expensesError) throw expensesError;

    const { error: membersError } = await supabase
      .from('group_members')
      .delete()
      .eq('group_id', groupId);

    if (membersError) throw membersError;

    const { error: groupError } = await supabase.from('groups').delete().eq('id', groupId);

    if (groupError) throw groupError;

    return true;
  } catch (error) {
    console.error('Failed to delete group:', error);
    return false;
  }
}

export async function isGroupOwner(groupId: string): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data } = await supabase
      .from('groups')
      .select('created_by')
      .eq('id', groupId)
      .maybeSingle();

    return data?.created_by === user.id;
  } catch (error) {
    console.error('Failed to check group ownership:', error);
    return false;
  }
}

export async function deleteUserAccount(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('No authenticated user');
    }

    const { data: ownedGroups } = await supabase
      .from('groups')
      .select('id')
      .eq('created_by', user.id);

    if (ownedGroups && ownedGroups.length > 0) {
      for (const group of ownedGroups) {
        await deleteGroup(group.id);
      }
    }

    const { error: disconnectError } = await supabase
      .from('group_members')
      .update({ connected_user_id: null })
      .eq('connected_user_id', user.id);

    if (disconnectError) throw disconnectError;

    const { error: userError } = await supabase.from('users').delete().eq('id', user.id);

    if (userError) throw userError;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;

    if (token) {
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseAnonKey) {
        await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    }

    await supabase.auth.signOut();

    return true;
  } catch (error) {
    console.error('Failed to delete user account:', error);
    return false;
  }
}

export async function reconnectGroupMembers(): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || !user.email) return;

    await supabase
      .from('group_members')
      .update({ connected_user_id: user.id })
      .eq('email', user.email)
      .is('connected_user_id', null);
  } catch (error) {
    console.error('Failed to reconnect group members:', error);
  }
}

export async function sendInvitationEmail(email: string, groupName: string): Promise<boolean> {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('Missing Supabase configuration');
      return false;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-invitation`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${supabaseAnonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, groupName }),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to send invitation email:', error);
    return false;
  }
}
