import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function deleteGroup(supabase: any, groupId: string): Promise<void> {
  const { error } = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId);

  if (error) {
    console.error(`Failed to delete group ${groupId}:`, error);
    throw error;
  }
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

    const groupsToDelete: string[] = [];
    const groupsChecked = new Set<string>();

    if (orphanedGroups) {
      for (const group of orphanedGroups) {
        if (groupsChecked.has(group.id)) continue;
        groupsChecked.add(group.id);

        const { data: members } = await supabaseClient
          .from("group_members")
          .select("connected_user_id")
          .eq("group_id", group.id);

        if (members && members.length > 0) {
          const hasConnectedMember = members.some(m => m.connected_user_id !== null);
          if (!hasConnectedMember) {
            groupsToDelete.push(group.id);
          }
        } else {
          groupsToDelete.push(group.id);
        }
      }
    }

    let deletedCount = 0;
    for (const groupId of groupsToDelete) {
      await deleteGroup(supabaseClient, groupId);
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