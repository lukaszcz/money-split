import { supabase } from '../lib/supabase';

interface GroupPreference {
  user_id: string;
  group_order: string[];
  updated_at: string;
}

export async function getGroupPreferences(): Promise<string[]> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from('user_group_preferences')
    .select('group_order')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Error fetching group preferences:', error);
    return [];
  }

  return data?.group_order || [];
}

export async function recordGroupVisit(groupId: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const currentOrder = await getGroupPreferences();
  const newOrder = [groupId, ...currentOrder.filter((id) => id !== groupId)];

  const { error } = await supabase
    .from('user_group_preferences')
    .upsert(
      {
        user_id: user.id,
        group_order: newOrder,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: 'user_id',
      }
    );

  if (error) {
    console.error('Error recording group visit:', error);
  }
}

export async function cleanupGroupPreferences(validGroupIds: string[]): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return;
  }

  const currentOrder = await getGroupPreferences();
  const cleanedOrder = currentOrder.filter((id) => validGroupIds.includes(id));

  if (cleanedOrder.length !== currentOrder.length) {
    const { error } = await supabase
      .from('user_group_preferences')
      .update({
        group_order: cleanedOrder,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (error) {
      console.error('Error cleaning up group preferences:', error);
    }
  }
}

interface Group {
  id: string;
  name: string;
  main_currency: string;
  created_at: string;
}

export async function getOrderedGroups(groups: Group[]): Promise<Group[]> {
  if (groups.length === 0) {
    return [];
  }

  const groupOrder = await getGroupPreferences();
  const groupMap = new Map(groups.map((g) => [g.id, g]));
  const validGroupIds = groups.map((g) => g.id);

  await cleanupGroupPreferences(validGroupIds);

  const orderedGroups: Group[] = [];
  const groupsInOrder = new Set<string>();

  const newGroups = groups
    .filter((g) => !groupOrder.includes(g.id))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  newGroups.forEach((g) => {
    orderedGroups.push(g);
    groupsInOrder.add(g.id);
  });

  groupOrder.forEach((groupId) => {
    const group = groupMap.get(groupId);
    if (group && !groupsInOrder.has(groupId)) {
      orderedGroups.push(group);
      groupsInOrder.add(groupId);
    }
  });

  return orderedGroups;
}
