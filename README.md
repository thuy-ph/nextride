# NextRide

Mobile-first PWA prototype for choosing a family’s next best move at a Gold Coast theme park.

## Run it

```bash
cd outputs/nextride
node server.mjs
```

Then open [http://localhost:4173](http://localhost:4173).

`npm run dev` is an equivalent shortcut if you prefer npm scripts; the project has no package installation step.

When run locally, the app uses a small Node proxy for the public [ThemeParks.wiki V1 API](https://api.themeparks.wiki/docs/v1/), with a five-minute server cache and an offline demo fallback.

## GitHub Pages

The repository includes a GitHub Actions workflow that publishes `public/` as a static PWA. In that deployment, NextRide calls the public live feed directly from the browser and keeps each browser's live snapshot for five minutes before requesting another one. This keeps the live feed within the provider's requested polling interval while still recalculating instantly after a ride is marked done.

The Pages build has no server-side API secret or shared cache. Before a commercial launch, move the provider integration to a Worker/server with a shared cache, and confirm commercial-use, attribution, rate-limit, and cache requirements with the data provider.

## What works

- Live queue/status fetch through `/api/parks/movieworld/live` locally, or the public feed directly on GitHub Pages.
- Family-aware recommendation through `/api/recommendations` locally, or the same route engine in the static Pages build.
- “Mark as done” records progress locally and recalculates the next ride.
- Tapping the recommended ride opens a high-contrast in-park map without leaving NextRide.
- The route starts at the park entrance or the last ride marked done, then follows a curated pedestrian graph.
- A distilled one-screen mobile interface with wait time, walking time and one primary action.
- Installable PWA with offline shell caching.

## Integrating additional parks

`server.mjs` contains a normalized `PARKS` registry and a `ThemeParksWikiAdapter`. Add an entry with the park entity ID plus attraction metadata (suitability, duration and optional priority). The route engine will then use the same API endpoint and recommendation path.

The current public feed is a prototype integration, not an official Village Roadshow partnership.

## Park map data

The Movie World route view is an original NextRide schematic based on OpenStreetMap pedestrian data and curated ride anchors. It does not copy or embed the operator's park-map artwork. Routes are approximate, carry visible OpenStreetMap attribution, and always tell guests to follow official signs and staff directions.

## Safety

The eligibility data in this prototype is a planning aid only. NextRide always tells guests to verify official height, health, and rider requirements at the attraction.
