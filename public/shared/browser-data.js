import { PARKS, demoLiveData } from "./parks.js";
import { enrichAttraction } from "./normalise.js";

const API_BASE_URL = "https://api.themeparks.wiki/v1";
const CACHE_SECONDS = 300;
const CACHE_PREFIX = "nextride-live-snapshot-v1";

function cacheKey(parkId) {
  return `${CACHE_PREFIX}:${parkId}`;
}

function readCache(parkId) {
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey(parkId)) ?? "null");
    if (cached?.expiresAt > Date.now() && cached?.value) return cached.value;
  } catch {
    // Storage can be unavailable in private browsing. A memory-free fetch is fine.
  }
  return null;
}

function writeCache(parkId, value) {
  try {
    localStorage.setItem(cacheKey(parkId), JSON.stringify({
      expiresAt: Date.now() + CACHE_SECONDS * 1000,
      value
    }));
  } catch {
    // The live plan remains usable if browser storage is unavailable.
  }
}

async function fetchJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { accept: "application/json" }
  });
  if (!response.ok) throw new Error(`Live feed returned ${response.status}`);
  return response.json();
}

function snapshotFor(park, attractions, source, sourceLabel, integrationError) {
  return {
    park: { id: park.id, name: park.name, shortName: park.shortName, timezone: park.timezone, entrance: park.entrance },
    attractions,
    source,
    sourceLabel,
    fetchedAt: new Date().toISOString(),
    providerUrl: "https://api.themeparks.wiki/docs/v1/",
    ...(integrationError ? { integrationError } : {})
  };
}

export function getDemoParkSnapshot(parkId, integrationError) {
  const park = PARKS[parkId];
  if (!park) throw new Error(`Unsupported park: ${parkId}`);
  if (parkId !== "movieworld") return snapshotFor(park, [], "demo", "Demo data", integrationError);

  // Tiny movement keeps the offline demo feeling alive without claiming to be live.
  const shift = Math.floor(Date.now() / 120000) % 3;
  const attractions = demoLiveData.map((item) => enrichAttraction(park, {
    ...item,
    waitTime: item.waitTime == null ? null : Math.max(5, item.waitTime + shift * 5)
  }));
  return snapshotFor(park, attractions, integrationError ? "fallback" : "demo", integrationError ? "Fallback data — refresh shortly" : "Offline demo data", integrationError);
}

export async function getPublicParkSnapshot(parkId) {
  const park = PARKS[parkId];
  if (!park) throw new Error(`Unsupported park: ${parkId}`);

  const cached = readCache(parkId);
  if (cached) return cached;

  try {
    const [liveResponse, childrenResponse] = await Promise.all([
      fetchJson(`/entity/${park.providerParkId}/live`),
      // Location improves walking estimates; lack of it should not discard live waits.
      fetchJson(`/entity/${park.providerParkId}/children`).catch(() => ({ children: [] }))
    ]);
    const locations = new Map(
      (childrenResponse.children ?? []).map((child) => [child.id, child.location]).filter(([, value]) => value)
    );
    const attractions = (liveResponse.liveData ?? [])
      .filter((item) => item.entityType === "ATTRACTION")
      .map((item) => enrichAttraction(park, item, locations));
    const snapshot = snapshotFor(park, attractions, "live", "Public live feed");
    writeCache(parkId, snapshot);
    return snapshot;
  } catch (error) {
    return getDemoParkSnapshot(parkId, error.message);
  }
}
