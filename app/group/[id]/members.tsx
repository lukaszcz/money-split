import { useCallback, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { ArrowLeft, Link, Mail, User } from 'lucide-react-native';
import {
  getGroup,
  GroupMember,
  GroupWithMembers,
} from '../../../services/groupRepository';
import BottomActionBar from '../../../components/BottomActionBar';

export default function GroupMembersScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [group, setGroup] = useState<GroupWithMembers | null>(null);
  const [loading, setLoading] = useState(true);

  const loadGroup = useCallback(async () => {
    if (!id || typeof id !== 'string') return;

    const fetchedGroup = await getGroup(id);
    setGroup(fetchedGroup);
    setLoading(false);
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      loadGroup();
    }, [loadGroup]),
  );

  const handleAddMember = () => {
    if (!group) return;
    router.push(`/group/${group.id}/add-member` as any);
  };

  if (loading || !group) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft color="#111827" size={24} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <ArrowLeft color="#111827" size={24} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>Group members</Text>
          <Text style={styles.headerSubtitle}>{group.name}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.scrollContent}
      >
        <MembersList members={group.members} groupId={group.id} />
      </ScrollView>

      <BottomActionBar label="Add member" onPress={handleAddMember} />
    </SafeAreaView>
  );
}

function MembersList({
  members,
  groupId,
}: {
  members: GroupMember[];
  groupId: string;
}) {
  const router = useRouter();

  if (members.length === 0) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>No members yet</Text>
        <Text style={styles.emptySubtext}>
          Add members to start splitting expenses
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.listContent}>
      {members.map((member) => (
        <TouchableOpacity
          key={member.id}
          style={styles.memberCard}
          onPress={() =>
            router.push(
              `/group/${groupId}/edit-member?memberId=${member.id}` as any,
            )
          }
        >
          <View style={styles.memberIcon}>
            <User
              color={member.connectedUserId ? '#2563eb' : '#6b7280'}
              size={20}
            />
          </View>
          <View style={styles.memberInfo}>
            <Text style={styles.memberName}>{member.name}</Text>
            {member.email && (
              <View style={styles.memberEmailRow}>
                <Mail color="#9ca3af" size={12} />
                <Text style={styles.memberEmail}>{member.email}</Text>
              </View>
            )}
          </View>
          {member.connectedUserId && (
            <View style={styles.connectedBadge}>
              <Link color="#059669" size={14} />
              <Text style={styles.connectedText}>Connected</Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  backButton: {
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#6b7280',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 24,
  },
  listContent: {
    paddingBottom: 8,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
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
  memberCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  memberIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  memberEmailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  memberEmail: {
    fontSize: 13,
    color: '#9ca3af',
  },
  connectedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connectedText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#059669',
  },
});
