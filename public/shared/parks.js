export const PARKS = {
  movieworld: {
    id: "movieworld",
    name: "Warner Bros. Movie World",
    shortName: "Movie World",
    providerParkId: "306b4975-5828-4a28-8ab0-ee7241c53f81",
    timezone: "Australia/Brisbane",
    entrance: { latitude: -27.90645, longitude: 153.31178 },
    foodStop: {
      id: "main-street-food",
      name: "Main Street food stop",
      subtitle: "Choose a family-friendly meal before the midday rush",
      location: { latitude: -27.90715, longitude: 153.31125 }
    },
    restStop: {
      id: "kids-wb-rest",
      name: "Taz Rest Stop",
      subtitle: "A shaded family reset near Kids’ WB! Fun Zone",
      location: { latitude: -27.90635, longitude: 153.31095 }
    },
    // Keep this deliberately small for the MVP. Verify every rule against
    // the operator's current signage before treating it as production data.
    attractions: {
      "Road Runner Rollercoaster": { minHeightCm: 105, durationMinutes: 3, familyScore: 9, zone: "Kids’ WB! Fun Zone", reason: "a strong whole-family choice" },
      "Justice League 3D - The Ride": { minHeightCm: 0, durationMinutes: 6, familyScore: 10, zone: "Metropolis", reason: "an all-weather family ride" },
      "Looney Tunes Carousel": { minHeightCm: 0, durationMinutes: 4, familyScore: 8, zone: "Kids’ WB! Fun Zone", reason: "an easy all-ages win" },
      "Yosemite Sam Railroad": { minHeightCm: 0, durationMinutes: 8, familyScore: 8, zone: "Kids’ WB! Fun Zone", reason: "a seated family reset" },
      "Speedy Gonzales’ Tijuana Taxis": { minHeightCm: 0, durationMinutes: 3, familyScore: 8, zone: "Kids’ WB! Fun Zone", reason: "a short ride for younger children" },
      "Marvin The Martian: Cosmic Boom": { minHeightCm: 105, durationMinutes: 3, familyScore: 7, zone: "Kids’ WB! Fun Zone", reason: "a compact family thrill" },
      "Wild West Falls Adventure Ride": { minHeightCm: 120, durationMinutes: 5, familyScore: 7, zone: "Wild West", reason: "a high-value splash ride" },
      "Flight of the Wicked Witch": { minHeightCm: 100, durationMinutes: 3, familyScore: 8, zone: "The Wizard of Oz", reason: "a new family-friendly coaster" },
      "Kansas Twister": { minHeightCm: 100, durationMinutes: 3, familyScore: 8, zone: "The Wizard of Oz", reason: "a fast family coaster" },
      "SCOOBY-DOO! Spooky Coaster": { minHeightCm: 110, durationMinutes: 4, familyScore: 7, zone: "Wild West", reason: "a popular indoor family coaster" },
      "DC Rivals HyperCoaster": { minHeightCm: 130, durationMinutes: 4, familyScore: 4, zone: "DC Super-Villains Unleashed", reason: "a major thrill ride" },
      "Superman Escape": { minHeightCm: 130, durationMinutes: 3, familyScore: 4, zone: "Metropolis", reason: "a major thrill ride" },
      "Green Lantern Coaster": { minHeightCm: 130, durationMinutes: 3, familyScore: 4, zone: "DC Super-Villains Unleashed", reason: "a compact thrill coaster" }
    }
  },
  seaworld: {
    id: "seaworld",
    name: "Sea World Gold Coast",
    shortName: "Sea World",
    providerParkId: "6a10a44e-8902-49dc-959b-f2648292b089",
    timezone: "Australia/Brisbane",
    entrance: { latitude: -27.95597, longitude: 153.41815 },
    attractions: {}
  },
  wetnwild: {
    id: "wetnwild",
    name: "Wet’n’Wild",
    shortName: "Wet’n’Wild",
    providerParkId: "ee018a72-f99c-4a37-b436-966b94aa7aa5",
    timezone: "Australia/Brisbane",
    entrance: { latitude: -27.90287, longitude: 153.31148 },
    attractions: {}
  }
};

export const demoLiveData = [
  { id: "demo-road-runner", name: "Road Runner Rollercoaster", status: "OPERATING", waitTime: 10, latitude: -27.90616, longitude: 153.31151 },
  { id: "demo-justice-league", name: "Justice League 3D - The Ride", status: "OPERATING", waitTime: 15, latitude: -27.90712, longitude: 153.3124 },
  { id: "demo-carousel", name: "Looney Tunes Carousel", status: "OPERATING", waitTime: 5, latitude: -27.9064, longitude: 153.31083 },
  { id: "demo-yosemite", name: "Yosemite Sam Railroad", status: "OPERATING", waitTime: 10, latitude: -27.90595, longitude: 153.31061 },
  { id: "demo-speedy", name: "Speedy Gonzales’ Tijuana Taxis", status: "OPERATING", waitTime: 10, latitude: -27.90609, longitude: 153.31112 },
  { id: "demo-marvin", name: "Marvin The Martian: Cosmic Boom", status: "OPERATING", waitTime: 15, latitude: -27.90612, longitude: 153.31042 },
  { id: "demo-wild-west", name: "Wild West Falls Adventure Ride", status: "OPERATING", waitTime: 30, latitude: -27.90872, longitude: 153.30971 },
  { id: "demo-witch", name: "Flight of the Wicked Witch", status: "OPERATING", waitTime: 10, latitude: -27.90737, longitude: 153.31014 },
  { id: "demo-kansas", name: "Kansas Twister", status: "OPERATING", waitTime: 10, latitude: -27.90706, longitude: 153.31002 },
  { id: "demo-scooby", name: "SCOOBY-DOO! Spooky Coaster", status: "OPERATING", waitTime: 35, latitude: -27.9081, longitude: 153.31022 },
  { id: "demo-dc-rivals", name: "DC Rivals HyperCoaster", status: "OPERATING", waitTime: 45, latitude: -27.9081, longitude: 153.31355 },
  { id: "demo-superman", name: "Superman Escape", status: "OPERATING", waitTime: 35, latitude: -27.9073, longitude: 153.31295 },
  { id: "demo-green-lantern", name: "Green Lantern Coaster", status: "CLOSED", waitTime: null, latitude: -27.90835, longitude: 153.3131 }
];
