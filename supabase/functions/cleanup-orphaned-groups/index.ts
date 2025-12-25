import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function deleteGroup(supabase, groupId: string): void {
  const { data: expenses, error: expenseError } = await supabase
    .from('expenses')
    .select('id')
    .eq('group_id', groupId);

  if (expenseError) throw expenseError;

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
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Find all groups that have no connected members
    const { data: orphanedGroups, error: fetchError } = await supabaseClient
      .from("groups")
      .select("id");

    if (fetchError) {
      console.error("Failed to fetch groups:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch groups", details: fetchError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Filter groups where ALL members have null connected_user_id
    const groupsToDelete: string[] = [];
    const groupsChecked = new Set<string>();

    if (orphanedGroups) {
      for (const group of orphanedGroups) {
        if (groupsChecked.has(group.id)) continue;
        groupsChecked.add(group.id);

        // Get all members for this group
        const { data: members } = await supabaseClient
          .from("group_members")
          .select("connected_user_id")
          .eq("group_id", group.id);

        // If all members have null connected_user_id, mark for deletion
        if (members && members.length > 0) {
          const hasConnectedMember = members.some(m => m.connected_user_id !== null);
          if (!hasConnectedMember) {
            groupsToDelete.push(group.id);
          }
        } else {
          // No members at all, delete the group
          groupsToDelete.push(group.id);
        }
      }
    }

    // Delete the orphaned groups
    let deletedCount = 0;
    for (const groupId of groupsToDelete) {
      deleteGroup(supabaseClient, groupId);
      ++deletedCount;
    }

    return new Response(
      JSON.stringify({
        success: true,
        deletedCount,
        message: `Successfully cleaned up ${deletedCount} orphaned group(s)`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in cleanup-orphaned-groups function:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
