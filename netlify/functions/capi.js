// Meta Conversions API proxy.
// Reads META_PIXEL_ID and META_CAPI_TOKEN from env; no-ops if either is missing.
// Optional META_TEST_EVENT_CODE forwards events to the Test Events panel.

const GRAPH_VERSION = "v19.0";

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  const pixelId = process.env.META_PIXEL_ID;
  const token = process.env.META_CAPI_TOKEN;
  const testCode = process.env.META_TEST_EVENT_CODE;

  if (!pixelId || !token) {
    return { statusCode: 204, body: "" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || "{}");
  } catch {
    return { statusCode: 400, body: "Bad JSON" };
  }

  const {
    event_name,
    event_id,
    event_source_url,
    user_data = {},
    custom_data = {}
  } = payload;

  if (!event_name || !event_id) {
    return { statusCode: 400, body: "Missing event_name or event_id" };
  }

  const ip =
    (event.headers["x-nf-client-connection-ip"]) ||
    (event.headers["client-ip"]) ||
    (event.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
    undefined;

  const ua = event.headers["user-agent"] || user_data.client_user_agent;

  const body = {
    data: [
      {
        event_name,
        event_time: Math.floor(Date.now() / 1000),
        event_id,
        event_source_url,
        action_source: "website",
        user_data: {
          client_ip_address: ip,
          client_user_agent: ua,
          fbp: user_data.fbp || undefined,
          fbc: user_data.fbc || undefined
        },
        custom_data
      }
    ]
  };

  if (testCode) body.test_event_code = testCode;

  const url = `https://graph.facebook.com/${GRAPH_VERSION}/${pixelId}/events?access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const text = await res.text();
    return {
      statusCode: res.ok ? 200 : 502,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ok: res.ok, status: res.status, response: safeJson(text) })
    };
  } catch (err) {
    return { statusCode: 502, body: JSON.stringify({ ok: false, error: String(err) }) };
  }
};

function safeJson(s) {
  try { return JSON.parse(s); } catch { return s; }
}
