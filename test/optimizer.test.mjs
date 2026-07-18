import assert from "node:assert/strict";
import { createRecommendation } from "../src/optimizer.js";

const snapshot = {
  park: {
    id: "movieworld",
    entrance: { latitude: -27.90645, longitude: 153.31178 }
  },
  attractions: [
    {
      id: "safe-family-ride",
      name: "Justice League 3D - The Ride",
      status: "OPERATING",
      waitTime: 12,
      minHeightCm: 0,
      durationMinutes: 6,
      familyScore: 10,
      location: { latitude: -27.90712, longitude: 153.3124 },
      reason: "an all-weather family ride",
      suitabilityKnown: true
    },
    {
      id: "safe-second-ride",
      name: "Looney Tunes Carousel",
      status: "OPERATING",
      waitTime: 8,
      minHeightCm: 0,
      durationMinutes: 4,
      familyScore: 8,
      location: { latitude: -27.9064, longitude: 153.31083 },
      reason: "an easy all-ages win",
      suitabilityKnown: true
    },
    {
      id: "unknown-ride",
      name: "Unmapped attraction",
      status: "OPERATING",
      waitTime: 1,
      minHeightCm: null,
      durationMinutes: 3,
      familyScore: 10,
      location: { latitude: -27.9065, longitude: 153.3117 },
      reason: "a currently operating attraction",
      suitabilityKnown: false
    },
    {
      id: "tall-ride",
      name: "DC Rivals HyperCoaster",
      status: "OPERATING",
      waitTime: 3,
      minHeightCm: 130,
      durationMinutes: 4,
      familyScore: 4,
      location: { latitude: -27.9081, longitude: 153.31355 },
      reason: "a major thrill ride",
      suitabilityKnown: true
    }
  ]
};

const tests = [];
function test(name, run) {
  tests.push({ name, run });
}

test("only ranks curated, group-eligible rides for families", () => {
  const plan = createRecommendation({
    snapshot,
    party: { adults: 2, children: [118, 96] }
  });

  assert.equal(plan.recommendation.id, "safe-family-ride");
  assert.deepEqual(plan.alternatives.map((ride) => ride.id), ["safe-second-ride"]);
});

test("recalculates to the next eligible ride after completion", () => {
  const plan = createRecommendation({
    snapshot,
    party: { adults: 2, children: [118, 96] },
    completedIds: ["safe-family-ride"]
  });

  assert.equal(plan.recommendation.id, "safe-second-ride");
});

test("returns a family food stop when the family asks for food", () => {
  const plan = createRecommendation({
    snapshot,
    party: { adults: 2, children: [118, 96] },
    intent: "food"
  });

  assert.equal(plan.recommendation.kind, "food");
  assert.equal(plan.recommendation.name, "Main Street food stop");
});

let failed = 0;
for (const { name, run } of tests) {
  try {
    run();
    console.log(`✓ ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`✗ ${name}`);
    console.error(error);
  }
}
if (failed) process.exitCode = 1;
