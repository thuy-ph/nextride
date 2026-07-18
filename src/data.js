import { PARKS, demoLiveData } from "./parks.js";
import https from "node:https";

const DEFAULT_BASE_URL = "https://api.themeparks.wiki/v1";

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function numericWait(item) {
  const waitTime = item?.queue?.STANDBY?.waitTime ?? item?.waitTime;
  return Number.isFinite(waitTime) ? waitTime : null;
}

function canonicalRideName(name = "") {
  return name
    .toLocaleLowerCase("en-AU")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/and/g, "and");
}

function lookupMetadata(park, providerName) {
  const entry = Object.entries(park.attractions).find(([name]) => canonicalRideName(name) === canonicalRideName(providerName));
  return entry ? { displayName: entry[0], ...entry[1] } : null;
}

function enrichAttraction(park, item, locations = new Map()) {
  const metadata = lookupMetadata(park, item.name) ?? {};
  const location = item.location ?? locations.get(item.id) ?? null;

  return {
    id: item.id,
    name: metadata.displayName ?? item.name,
    status: item.status ?? "UNKNOWN",
    waitTime: numericWait(item),
    lastUpdated: item.lastUpdated ?? new Date().toISOString(),
    location: location
      ? { latitude: location.latitude, longitude: location.longitude }
      : null,
    minHeightCm: metadata.minHeightCm ?? null,
    durationMinutes: metadata.durationMinutes ?? 4,
    familyScore: metadata.familyScore ?? 5,
    zone: metadata.zone ?? "Park area",
    reason: metadata.reason ?? "a currently operating attraction",
    suitabilityKnown: Boolean(metadata.displayName)
  };
}

export class ThemeParksWikiAdapter {
  constructor({ baseUrl = process.env.THEMEPARKS_API_BASE ?? DEFAULT_BASE_URL, cacheSeconds = Number(process.env.LIVE_CACHE_SECONDS ?? 300) } = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    // ThemeParks.wiki asks public API consumers not to poll more often than
    // five minutes. Re-plan instantly from the latest snapshot instead.
    this.cacheMilliseconds = Math.max(cacheSeconds, 300) * 1000;
    this.cache = new Map();
  }

  async fetchJson(path) {
    // Use node:https rather than global fetch so the app also runs on the
    // older Node runtimes that commonly ship with local PWA test setups.
    return new Promise((resolve, reject) => {
      const request = https.get(`${this.baseUrl}${path}`, {
        headers: { accept: "application/json", "user-agent": "NextRide-MVP/0.1" },
        timeout: 8000
      }, (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => { body += chunk; });
        response.on("end", () => {
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`Provider returned ${response.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch {
            reject(new Error("Provider returned invalid JSON"));
          }
        });
      });
      request.on("timeout", () => request.destroy(new Error("Provider request timed out")));
      request.on("error", reject);
    });
  }

  async getParkSnapshot(parkId) {
    const park = PARKS[parkId];
    if (!park) throw new Error(`Unsupported park: ${parkId}`);

    const cached = this.cache.get(parkId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const [liveResponse, childrenResponse] = await Promise.all([
      this.fetchJson(`/entity/${park.providerParkId}/live`),
      this.fetchJson(`/entity/${park.providerParkId}/children`)
    ]);

    const locations = new Map(
      (childrenResponse.children ?? []).map((child) => [child.id, child.location]).filter(([, value]) => value)
    );
    const attractions = (liveResponse.liveData ?? [])
      .filter((item) => item.entityType === "ATTRACTION")
      .map((item) => enrichAttraction(park, item, locations));

    const value = {
      park: { id: park.id, name: park.name, shortName: park.shortName, timezone: park.timezone, entrance: park.entrance },
      attractions,
      source: "live",
      sourceLabel: "Public live feed",
      fetchedAt: new Date().toISOString(),
      providerUrl: "https://api.themeparks.wiki/docs/v1/"
    };
    this.cache.set(parkId, { expiresAt: Date.now() + this.cacheMilliseconds, value });
    return value;
  }
}

export class DemoParkAdapter {
  async getParkSnapshot(parkId) {
    const park = PARKS[parkId];
    if (!park) throw new Error(`Unsupported park: ${parkId}`);
    if (parkId !== "movieworld") {
      return {
        park: { id: park.id, name: park.name, shortName: park.shortName, timezone: park.timezone, entrance: park.entrance },
        attractions: [],
        source: "demo",
        sourceLabel: "Demo data",
        fetchedAt: new Date().toISOString(),
        providerUrl: null
      };
    }

    // Tiny movement keeps the offline demo feeling alive without claiming to be live.
    const shift = Math.floor(Date.now() / 120000) % 3;
    return {
      park: { id: park.id, name: park.name, shortName: park.shortName, timezone: park.timezone, entrance: park.entrance },
      attractions: demoLiveData.map((item) => enrichAttraction(park, { ...item, waitTime: item.waitTime == null ? null : Math.max(5, item.waitTime + shift * 5) })),
      source: "demo",
      sourceLabel: "Offline demo data",
      fetchedAt: new Date().toISOString(),
      providerUrl: null
    };
  }
}

export class ParkDataService {
  constructor() {
    this.mode = process.env.PARK_DATA_MODE ?? "live";
    this.liveAdapter = new ThemeParksWikiAdapter();
    this.demoAdapter = new DemoParkAdapter();
  }

  async getParkSnapshot(parkId) {
    if (this.mode === "demo") return this.demoAdapter.getParkSnapshot(parkId);
    try {
      return await this.liveAdapter.getParkSnapshot(parkId);
    } catch (error) {
      // A resilient day-planner is still useful when a public provider is down.
      const fallback = await this.demoAdapter.getParkSnapshot(parkId);
      return { ...fallback, source: "fallback", sourceLabel: "Fallback data — refresh shortly", integrationError: error.message };
    }
  }

  async warm(parkId) {
    try {
      await this.getParkSnapshot(parkId);
    } catch {
      await wait(0);
    }
  }
}
