import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const webhookUrl = Deno.env.get("DISCORD_WEBHOOK_URL");
  if (!webhookUrl) {
    return json({ error: "Discord webhook is not configured" }, 500);
  }

  let payload: { title?: string; content?: string; maxCapacity?: number; imageUrl?: string };
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const title = String(payload.title || "").trim();
  const content = String(payload.content || "").trim();
  const maxCapacity = Number(payload.maxCapacity);
  const imageUrl = String(payload.imageUrl || "").trim();

  if (!title || !content) {
    return json({ error: "title and content are required" }, 400);
  }

  const capacityLine = Number.isFinite(maxCapacity)
    ? `\nCapacity: ${maxCapacity}`
    : "";

  const embed: Record<string, unknown> = {
    title,
    description: `${content}${capacityLine}`,
    color: 0x2b4c7e
  };

  if (/^https?:\/\//i.test(imageUrl)) {
    embed.image = { url: imageUrl };
  }

  const discordResponse = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: "WHITE LION REGIMENT",
      embeds: [embed]
    })
  });

  if (!discordResponse.ok) {
    return json({ error: "Discord notification failed" }, 502);
  }

  return json({ ok: true });
});
