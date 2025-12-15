import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import { useState, useEffect, useCallback } from 'react';
import { getAllGroups, getGroupExpenses, getUser, Expense } from '../../services/groupRepository';
import { formatNumber } from '../../utils/money';

interface ActivityItem extends Expense {
  groupName: string;
  payerName: string;
}

export default function ActivityScreen() {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadActivities = useCallback(async () => {
    const groups = await getAllGroups();
    const allActivities: ActivityItem[] = [];

    for (const group of groups) {
      const expenses = await getGroupExpenses(group.id);

      for (const expense of expenses) {
        const payer = await getUser(expense.payerUserId);
        allActivities.push({
          ...expense,
          groupName: group.name,
          payerName: payer?.name || 'Unknown',
        });
      }
    }

    allActivities.sort((a, b) => new Date(b.dateTime).getTime() - new Date(a.dateTime).getTime());

    setActivities(allActivities);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadActivities();
  }, [loadActivities]);

  const onRefresh = () => {
    setRefreshing(true);
    loadActivities();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return date.toLocaleDateString();
  };

  const renderActivityItem = ({ item }: { item: ActivityItem }) => (
    <View style={styles.activityCard}>
      <View style={styles.activityHeader}>
        <Text style={styles.description}>{item.description || 'Expense'}</Text>
        <Text style={styles.amount}>
          {item.currencyCode} {formatNumber(item.totalAmountScaled)}
        </Text>
      </View>
      <Text style={styles.details}>
        {item.payerName} paid in {item.groupName}
      </Text>
      <Text style={styles.date}>{formatDate(item.dateTime)}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Activity</Text>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <Text>Loading activity...</Text>
        </View>
      ) : activities.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyText}>No activity yet</Text>
          <Text style={styles.emptySubtext}>Expenses will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={activities}
          renderItem={renderActivityItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  list: {
    padding: 16,
  },
  activityCard: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  amount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2563eb',
  },
  details: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  date: {
    fontSize: 12,
    color: '#9ca3af',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
