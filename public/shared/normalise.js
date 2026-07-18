export function numericWait(item) {
  const waitTime = item?.queue?.STANDBY?.waitTime ?? item?.waitTime;
  return Number.isFinite(waitTime) ? waitTime : null;
}

export function canonicalRideName(name = "") {
  return name
    .toLocaleLowerCase("en-AU")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/and/g, "and");
}

export function lookupMetadata(park, providerName) {
  const entry = Object.entries(park.attractions).find(([name]) => canonicalRideName(name) === canonicalRideName(providerName));
  return entry ? { displayName: entry[0], ...entry[1] } : null;
}

export function enrichAttraction(park, item, locations = new Map()) {
  const metadata = lookupMetadata(park, item.name) ?? {};
  const inlineLocation = Number.isFinite(item.latitude) && Number.isFinite(item.longitude)
    ? { latitude: item.latitude, longitude: item.longitude }
    : null;
  const location = item.location ?? locations.get(item.id) ?? inlineLocation;

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
