import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ParkDataService } from "./src/data.js";
import { createRecommendation } from "./src/optimizer.js";
import { PARKS } from "./src/parks.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const publicDir = resolve(__dirname, "public");
const dataService = new ParkDataService();
const port = Number(process.env.PORT ?? 4173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function sendJson(response, status, data) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store"
  });
  response.end(JSON.stringify(data));
}

function sendError(response, status, message) {
  sendJson(response, status, { error: message });
}

async function readRequestBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 100_000) throw new Error("Request body is too large");
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function serveStatic(response, pathname) {
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const filePath = resolve(publicDir, `.${normalize(requestedPath)}`);
  if (!filePath.startsWith(`${publicDir}/`) && filePath !== join(publicDir, "index.html")) {
    return sendError(response, 403, "Forbidden");
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) return sendError(response, 404, "Not found");
    const file = await readFile(filePath);
    response.writeHead(200, {
      "content-type": mimeTypes[extname(filePath)] ?? "application/octet-stream",
      "cache-control": pathname === "/sw.js" ? "no-cache" : "public, max-age=3600"
    });
    response.end(file);
  } catch {
    sendError(response, 404, "Not found");
  }
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host ?? "localhost"}`);
  const pathname = url.pathname;

  try {
    if (request.method === "GET" && pathname === "/api/health") {
      return sendJson(response, 200, { ok: true, mode: dataService.mode, now: new Date().toISOString() });
    }

    if (request.method === "GET" && pathname === "/api/parks") {
      return sendJson(response, 200, {
        parks: Object.values(PARKS).map(({ id, name, shortName }) => ({ id, name, shortName }))
      });
    }

    const liveMatch = pathname.match(/^\/api\/parks\/([a-z0-9-]+)\/live$/);
    if (request.method === "GET" && liveMatch) {
      const snapshot = await dataService.getParkSnapshot(liveMatch[1]);
      return sendJson(response, 200, snapshot);
    }

    if (request.method === "POST" && pathname === "/api/recommendations") {
      const input = await readRequestBody(request);
      const parkId = input.parkId ?? "movieworld";
      const snapshot = await dataService.getParkSnapshot(parkId);
      const plan = createRecommendation({ snapshot, ...input });
      return sendJson(response, 200, { ...plan, source: snapshot.source, sourceLabel: snapshot.sourceLabel, fetchedAt: snapshot.fetchedAt });
    }

    if (request.method === "GET") return serveStatic(response, pathname);
    return sendError(response, 405, "Method not allowed");
  } catch (error) {
    console.error(error);
    return sendError(response, 500, error.message || "Unexpected server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`NextRide is ready at http://localhost:${port}`);
  dataService.warm("movieworld");
});
