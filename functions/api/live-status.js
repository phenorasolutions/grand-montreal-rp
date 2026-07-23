const ENDPOINTS = [
  "https://frontend.cfx-services.net/api/servers/single/k7oxyd",
  "https://servers-frontend.fivem.net/api/servers/single/k7oxyd"
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "public, max-age=30, stale-while-revalidate=30"
    }
  });
}

export async function onRequestGet() {
  for (const endpoint of ENDPOINTS) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4500);

      const response = await fetch(endpoint, {
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "Grand-Montreal-RP-Website"
        }
      });

      clearTimeout(timeout);

      if (!response.ok) continue;

      const payload = await response.json();
      const data = payload?.Data;

      if (!data) continue;

      const players =
        data.clients ??
        data.selfReportedClients ??
        (Array.isArray(data.players) ? data.players.length : null);

      const capacity =
        data.sv_maxclients ??
        data.vars?.sv_maxClients ??
        data.vars?.sv_maxclients ??
        null;

      const name =
        data.vars?.sv_projectName ||
        data.hostname ||
        "Grand Montréal RP";

      return json({
        success: true,
        online: true,
        name,
        players,
        capacity,
        joinUrl: "https://cfx.re/join/k7oxyd",
        checkedAt: new Date().toISOString()
      });
    } catch {
      // Essaie le prochain endpoint.
    }
  }

  return json({
    success: true,
    online: false,
    name: "Grand Montréal RP",
    players: null,
    capacity: null,
    joinUrl: "https://cfx.re/join/k7oxyd",
    checkedAt: new Date().toISOString()
  });
}
