import assert from "node:assert/strict";
import { getWalkingDirectionsUrl } from "../public/shared/directions.js";
import { enrichAttraction } from "../public/shared/normalise.js";
import { PARKS } from "../public/shared/parks.js";

const url = new URL(getWalkingDirectionsUrl({
  location: { latitude: -27.90712, longitude: 153.3124 }
}));

assert.equal(url.origin, "https://www.google.com");
assert.equal(url.pathname, "/maps/dir/");
assert.equal(url.searchParams.get("destination"), "-27.90712,153.3124");
assert.equal(url.searchParams.get("travelmode"), "walking");
assert.equal(url.searchParams.get("dir_action"), "navigate");
assert.equal(getWalkingDirectionsUrl({ location: null }), null);
assert.equal(getWalkingDirectionsUrl({ location: { latitude: 120, longitude: 1 } }), null);

const fallbackRide = enrichAttraction(PARKS.movieworld, {
  id: "demo-justice-league",
  name: "Justice League 3D - The Ride",
  status: "OPERATING",
  waitTime: 10,
  latitude: -27.90712,
  longitude: 153.3124
});
assert.deepEqual(fallbackRide.location, { latitude: -27.90712, longitude: 153.3124 });

console.log("✓ builds safe walking directions and preserves fallback coordinates");
