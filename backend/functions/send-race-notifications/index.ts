const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

interface Profile {
  id: string;
  push_token: string | null;
}

interface Prediction {
  user_id: string;
  race_id: string;
}

interface NotificationLog {
  race_id: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const adminAuth = `Bearer ${serviceRoleKey}`;

    const db = {
      async query<T>(path: string): Promise<T[]> {
        const url = `${supabaseUrl}/rest/v1/${path}`;
        const res = await fetch(url, {
          headers: {
            apikey: serviceRoleKey,
            authorization: adminAuth,
          },
        });
        if (!res.ok) {
          console.error(`Query ${path} failed:`, res.status, await res.text());
          return [];
        }
        return res.json();
      },

      async insert(table: string, rows: Record<string, unknown>[]): Promise<void> {
        const url = `${supabaseUrl}/rest/v1/${table}`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            apikey: serviceRoleKey,
            authorization: adminAuth,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify(rows),
        });
        if (!res.ok) {
          console.error(`Insert into ${table} failed:`, res.status, await res.text());
        }
      },
    };

    // 1. Find races that completed recently (within the last 30 minutes)
    //    and have NOT been notified yet
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    // Fetch completed races
    const completedRaces = await db.query<{ id: string; name: string; country_flag: string }>(
      `races?status=eq.completed&select=id,name,country_flag`
    );

    if (completedRaces.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "No completed races found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch notification log to see which races were already notified
    const notifiedLogs = await db.query<NotificationLog>(
      `notification_log?select=race_id`
    );
    const notifiedRaceIds = new Set(notifiedLogs.map((l) => l.race_id));

    // Filter to only races not yet notified
    const racesToNotify = completedRaces.filter((r) => !notifiedRaceIds.has(r.id));

    if (racesToNotify.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "All completed races already notified" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalSent = 0;

    for (const race of racesToNotify) {
      // 2. Find users who have predictions for this race
      const predictions = await db.query<Prediction>(
        `user_predictions?race_id=eq.${encodeURIComponent(race.id)}&select=user_id,race_id`
      );

      if (predictions.length === 0) continue;

      const userIds = [...new Set(predictions.map((p) => p.user_id))];

      // 3. Get push tokens for those users
      let profiles: Profile[] = [];
      // Query in batches to avoid URL length issues
      for (let i = 0; i < userIds.length; i += 20) {
        const batch = userIds.slice(i, i + 20);
        const filter = batch.map((id) => `id=eq.${encodeURIComponent(id)}`).join(",");
        const batchProfiles = await db.query<Profile>(
          `profiles?or=(${filter})&select=id,push_token&push_token=not.is.null`
        );
        profiles.push(...batchProfiles);
      }

      const tokens = profiles
        .map((p) => p.push_token)
        .filter((t): t is string => !!t && t.startsWith("ExponentPushToken["));

      if (tokens.length === 0) continue;

      // 4. Send Expo push notifications
      const flag = race.country_flag || "🏁";
      const messages = tokens.map((token) => ({
        to: token,
        sound: "default",
        title: `${flag} ${race.name} Results Are In!`,
        body: "The race has finished. Tap to see the results and your score.",
        data: { raceId: race.id, type: "race_results" },
      }));

      // Expo accepts up to 100 messages per request; chunk if needed
      for (let i = 0; i < messages.length; i += 100) {
        const chunk = messages.slice(i, i + 100);
        try {
          const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify(chunk),
          });

          if (!expoRes.ok) {
            console.error(`Expo push failed for race ${race.id}:`, expoRes.status, await expoRes.text());
          } else {
            console.log(`Sent ${chunk.length} notifications for race ${race.id}`);
          }
        } catch (e) {
          console.error(`Expo push error for race ${race.id}:`, e);
        }
      }

      // 5. Log the notification
      await db.insert("notification_log", [
        { race_id: race.id, recipient_count: tokens.length },
      ]);

      totalSent += tokens.length;
    }

    return new Response(JSON.stringify({ sent: totalSent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-race-notifications error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
