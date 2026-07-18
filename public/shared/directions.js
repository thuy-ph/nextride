export function getWalkingDirectionsUrl(recommendation) {
  const latitude = Number(recommendation?.location?.latitude);
  const longitude = Number(recommendation?.location?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;

  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", `${latitude},${longitude}`);
  url.searchParams.set("travelmode", "walking");
  url.searchParams.set("dir_action", "navigate");
  return url.toString();
}
