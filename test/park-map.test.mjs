import assert from "node:assert/strict";
import { getParkRoute, getParkWalkingMinutes } from "../public/shared/park-map.js";

const entrance = { latitude: -27.90645, longitude: 153.31178 };

const entranceToRoadRunner = getParkRoute({
  parkId: "movieworld",
  from: entrance,
  to: { name: "Road Runner Rollercoaster", zone: "Kids’ WB! Fun Zone" }
});
assert.equal(entranceToRoadRunner.available, true);
assert.equal(entranceToRoadRunner.startId, "entrance");
assert.equal(entranceToRoadRunner.destinationId, "kidsHub");
assert.deepEqual(entranceToRoadRunner.path.map(({ id }) => id), ["entrance", "kidsHub"]);
assert.equal(entranceToRoadRunner.routeMinutes, 2);

const roadRunnerToJusticeLeague = getParkRoute({
  parkId: "movieworld",
  fromName: "Road Runner Rollercoaster",
  to: { name: "Justice League 3D – The Ride", zone: "Metropolis" }
});
assert.equal(roadRunnerToJusticeLeague.startId, "kidsHub");
assert.equal(roadRunnerToJusticeLeague.destinationId, "eastHub");
assert.equal(roadRunnerToJusticeLeague.path.at(-1).id, "eastHub");

const justiceLeagueToRivals = getParkRoute({
  parkId: "movieworld",
  fromName: "Justice League 3D - The Ride",
  to: { name: "DC Rivals HyperCoaster" }
});
assert.deepEqual(justiceLeagueToRivals.path.map(({ id }) => id), ["eastHub", "dcRivals"]);

const unknownWithCoordinates = getParkRoute({
  parkId: "movieworld",
  from: entrance,
  to: { name: "New attraction", location: { latitude: -27.9087, longitude: 153.30972 } }
});
assert.equal(unknownWithCoordinates.destinationId, "wildWest");

const sameArea = getParkRoute({
  parkId: "movieworld",
  fromName: "Looney Tunes Carousel",
  to: { name: "Road Runner Rollercoaster" }
});
assert.equal(sameArea.routeMinutes, 0);
assert.equal(getParkWalkingMinutes({ parkId: "movieworld", from: entrance, to: { name: "Road Runner Rollercoaster" } }), 2);

assert.deepEqual(getParkRoute({ parkId: "seaworld", from: entrance, to: { name: "Any ride" } }), { available: false, reason: "coming-soon" });
assert.deepEqual(getParkRoute({ parkId: "movieworld", from: entrance, to: {} }), { available: false, reason: "route-unavailable" });
assert.equal(entranceToRoadRunner.edges.every(([, , minutes]) => minutes > 0), true);

console.log("✓ builds accessible in-park routes from the entrance and completed rides");
