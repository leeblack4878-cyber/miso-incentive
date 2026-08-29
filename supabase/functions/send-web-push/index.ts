import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const suppliedHook = req.headers.get("x-push-hook") || "";
    const { data: configRows, error: configError } = await admin.from("push_config").select("key,value").in("key", ["hook_secret", "vapid_public", "vapid_private"]);
    if (configError) throw configError;
    const config = Object.fromEntries((configRows || []).map((row) => [row.key, row.value]));
    if (!suppliedHook || suppliedHook !== config.hook_secret) return new Response("Unauthorized", { status: 401 });
    const { notification_id } = await req.json();
    if (!notification_id) return new Response("Missing notification_id", { status: 400 });
    const { data: notification, error: notificationError } = await admin.from("notifications").select("id,recipient_id,type,title,message,payload").eq("id", notification_id).single();
    if (notificationError || !notification) return new Response("Notification not found", { status: 404 });
    const { data: subscriptions, error: subscriptionError } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", notification.recipient_id).eq("enabled", true);
    if (subscriptionError) throw subscriptionError;
    if (!subscriptions?.length) return Response.json({ sent: 0 });
    webpush.setVapidDetails("mailto:admin@misomobile.co.kr", config.vapid_public, config.vapid_private);
    const payload = JSON.stringify({
      title: notification.title || "미소페이",
      body: notification.message || "새 알림이 도착했어요.",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      tag: `miso-${notification.id}`,
      data: { url: "/?open=notifications", notificationId: notification.id, ...(notification.payload || {}) },
    });
    let sent = 0;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, payload, { TTL: 86400, urgency: "high" });
        sent += 1;
        await admin.from("push_delivery_log").insert({ notification_id: notification.id, recipient_id: notification.recipient_id, endpoint_hash: sub.id, status: "sent" });
      } catch (error) {
        const status = Number(error?.statusCode || 0);
        if (status === 404 || status === 410) await admin.from("push_subscriptions").update({ enabled: false, updated_at: new Date().toISOString() }).eq("id", sub.id);
        await admin.from("push_delivery_log").insert({ notification_id: notification.id, recipient_id: notification.recipient_id, endpoint_hash: sub.id, status: "failed", detail: String(error?.message || error).slice(0, 500) });
      }
    }
    return Response.json({ sent });
  } catch (error) {
    console.error(error);
    return Response.json({ error: String(error?.message || error) }, { status: 500 });
  }
});
