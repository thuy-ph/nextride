import { canonicalRideName } from "./normalise.js";

const MOVIE_WORLD_NODES = {
  entrance: { x: 179, y: 52, latitude: -27.90645, longitude: 153.31178 },
  kidsHub: { x: 118, y: 52, latitude: -27.90628, longitude: 153.31095 },
  kidsWest: { x: 82, y: 66, latitude: -27.90631, longitude: 153.31065 },
  mainNorth: { x: 177, y: 91, latitude: -27.90687, longitude: 153.31175 },
  mainSquare: { x: 154, y: 123, latitude: -27.90714, longitude: 153.31143 },
  westJunction: { x: 128, y: 153, latitude: -27.9075, longitude: 153.3111 },
  countyFair: { x: 80, y: 176, latitude: -27.90778, longitude: 153.31042 },
  westernTown: { x: 54, y: 211, latitude: -27.90817, longitude: 153.31003 },
  wildWest: { x: 36, y: 258, latitude: -27.90872, longitude: 153.30971 },
  southJunction: { x: 174, y: 178, latitude: -27.9078, longitude: 153.31168 },
  ozGate: { x: 174, y: 213, latitude: -27.90815, longitude: 153.31168 },
  ozRides: { x: 174, y: 263, latitude: -27.9088, longitude: 153.31168 },
  dcFront: { x: 262, y: 91, latitude: -27.90695, longitude: 153.313 },
  dcMid: { x: 282, y: 128, latitude: -27.90735, longitude: 153.3132 },
  eastHub: { x: 254, y: 171, latitude: -27.9077, longitude: 153.31285 },
  dcRivals: { x: 304, y: 213, latitude: -27.90808, longitude: 153.3135 }
};

const MOVIE_WORLD_EDGES = [
  ["entrance", "mainNorth", 1],
  ["entrance", "kidsHub", 2],
  ["kidsHub", "kidsWest", 1],
  ["kidsHub", "mainNorth", 1],
  ["entrance", "dcFront", 2],
  ["mainNorth", "mainSquare", 1],
  ["mainSquare", "westJunction", 1],
  ["westJunction", "countyFair", 1],
  ["countyFair", "westernTown", 1],
  ["westernTown", "wildWest", 2],
  ["mainSquare", "southJunction", 1],
  ["westJunction", "southJunction", 1],
  ["southJunction", "ozGate", 1],
  ["ozGate", "ozRides", 2],
  ["dcFront", "dcMid", 1],
  ["dcMid", "eastHub", 1],
  ["eastHub", "dcRivals", 2],
  ["mainSquare", "eastHub", 2]
];

const MOVIE_WORLD_RIDE_ANCHORS = new Map(Object.entries({
  "Action Zone Arcade": "mainNorth",
  "Road Runner Rollercoaster": "kidsHub",
  "Junior Driving School": "kidsHub",
  "Looney Tunes Carousel": "kidsHub",
  "Looney Tunes Splash Zone": "kidsHub",
  "Speedy Gonzales’ Tijuana Taxis": "kidsHub",
  "Sylvester And Tweety Cages": "kidsWest",
  "Marvin The Martian: Cosmic Boom": "kidsWest",
  "Yosemite Sam Railroad": "kidsWest",
  "SCOOBY-DOO! Spooky Coaster": "westJunction",
  "County Fair Fun N Games": "countyFair",
  "Wild West Falls Adventure Ride": "wildWest",
  "Superman Escape": "southJunction",
  "The Wizard Of Oz Precinct": "ozGate",
  "Kansas Twister": "ozRides",
  "Flight of the Wicked Witch": "ozRides",
  "Green Lantern Coaster": "dcMid",
  "Batwing Spaceshot": "eastHub",
  "The Flash Speed Force": "eastHub",
  "Justice League 3D - The Ride": "eastHub",
  "DC Rivals HyperCoaster": "dcRivals",
  "Ride It Backwards DC Rivals Hypercoaster": "dcRivals"
}).map(([name, nodeId]) => [canonicalRideName(name), nodeId]));

const PARK_MAPS = {
  movieworld: {
    nodes: MOVIE_WORLD_NODES,
    edges: MOVIE_WORLD_EDGES,
    anchors: MOVIE_WORLD_RIDE_ANCHORS,
    entranceNode: "entrance"
  }
};

function validLocation(location) {
  return location?.latitude != null
    && location?.longitude != null
    && Number.isFinite(Number(location.latitude))
    && Number.isFinite(Number(location.longitude));
}

function nearestNode(nodes, location) {
  if (!validLocation(location)) return null;
  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  let nearest = null;
  let nearestDistance = Infinity;

  for (const [id, node] of Object.entries(nodes)) {
    const latitudeDistance = node.latitude - latitude;
    const longitudeDistance = (node.longitude - longitude) * Math.cos((latitude * Math.PI) / 180);
    const distance = latitudeDistance ** 2 + longitudeDistance ** 2;
    if (distance < nearestDistance) {
      nearest = id;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function anchorFor(map, place, fallbackNode = null) {
  const nameAnchor = place?.name ? map.anchors.get(canonicalRideName(place.name)) : null;
  return nameAnchor ?? nearestNode(map.nodes, place?.location) ?? fallbackNode;
}

function shortestPath(map, startId, destinationId) {
  const distances = new Map(Object.keys(map.nodes).map((id) => [id, Infinity]));
  const previous = new Map();
  const unvisited = new Set(Object.keys(map.nodes));
  distances.set(startId, 0);

  while (unvisited.size) {
    let current = null;
    let currentDistance = Infinity;
    for (const id of unvisited) {
      if (distances.get(id) < currentDistance) {
        current = id;
        currentDistance = distances.get(id);
      }
    }
    if (current === null || currentDistance === Infinity) break;
    unvisited.delete(current);
    if (current === destinationId) break;

    for (const [from, to, minutes] of map.edges) {
      const neighbour = from === current ? to : to === current ? from : null;
      if (!neighbour || !unvisited.has(neighbour)) continue;
      const candidate = currentDistance + minutes;
      if (candidate < distances.get(neighbour)) {
        distances.set(neighbour, candidate);
        previous.set(neighbour, current);
      }
    }
  }

  if (!Number.isFinite(distances.get(destinationId))) return null;
  const ids = [destinationId];
  while (ids[0] !== startId) {
    const prior = previous.get(ids[0]);
    if (!prior) return null;
    ids.unshift(prior);
  }
  return { ids, minutes: distances.get(destinationId) };
}

export function getParkRoute({ parkId, from, fromName, to }) {
  const map = PARK_MAPS[parkId];
  if (!map) return { available: false, reason: "coming-soon" };

  const startId = anchorFor(map, { name: fromName, location: from }, map.entranceNode);
  const destinationId = anchorFor(map, to);
  if (!startId || !destinationId) return { available: false, reason: "route-unavailable" };

  const shortest = shortestPath(map, startId, destinationId);
  if (!shortest) return { available: false, reason: "route-unavailable" };

  return {
    available: true,
    approximate: true,
    startId,
    destinationId,
    fromLabel: fromName || "Park entrance",
    toLabel: to?.name || "Next ride",
    zone: to?.zone || "Park area",
    routeMinutes: shortest.minutes,
    path: shortest.ids.map((id) => ({ id, ...map.nodes[id] })),
    nodes: map.nodes,
    edges: map.edges
  };
}

export function getParkWalkingMinutes({ parkId, from, to }) {
  const route = getParkRoute({ parkId, from, to });
  return route.available ? Math.max(1, route.routeMinutes) : null;
}
