const DEFAULT_BASE = "http://www.opinet.co.kr/api";
const CACHE_MAX = 500;
const responseCache = globalThis.__fuelRadarOpinetCache || new Map();
globalThis.__fuelRadarOpinetCache = responseCache;

function parseNumber(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[^0-9.-]/g, "");
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isFinite(num) ? num : null;
}

function pick(obj, keys) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null && obj[key] !== "") {
      return obj[key];
    }
  }
  return null;
}

function fuelToProdcd(fuel) {
  const normalized = String(fuel || "gasoline").toLowerCase();
  if (normalized === "diesel" || normalized === "경유") return "D047";
  return "B027";
}

function parseDate(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  if (/^\d{8}$/.test(str)) {
    const y = Number(str.slice(0, 4));
    const m = Number(str.slice(4, 6)) - 1;
    const d = Number(str.slice(6, 8));
    const dt = new Date(Date.UTC(y, m, d));
    return Number.isNaN(dt.getTime()) ? null : dt;
  }
  const dt = new Date(str);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

async function fetchOpinet(path, query = {}, options = {}) {
  const cacheTtlSec = Number(options.cacheTtlSec || 0);
  const apiKey = process.env.OPINET_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPINET_API_KEY");
  }
  const base = process.env.OPINET_BASE_URL || DEFAULT_BASE;
  const url = new URL(`${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`);
  url.searchParams.set("code", apiKey);
  url.searchParams.set("out", "json");
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }
  const cacheKey = url.toString();
  if (cacheTtlSec > 0) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.rows;
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Opinet error ${response.status}`);
    }
    const text = await response.text();
    const json = JSON.parse(text);
    const rows = Array.isArray(json?.RESULT?.OIL) ? json.RESULT.OIL : [];
    const normalizedRows = rows.filter((row) => row && typeof row === "object");
    if (cacheTtlSec > 0) {
      responseCache.set(cacheKey, {
        rows: normalizedRows,
        expiresAt: Date.now() + cacheTtlSec * 1000
      });
      if (responseCache.size > CACHE_MAX) {
        let removed = 0;
        for (const [key, value] of responseCache.entries()) {
          if (value.expiresAt <= Date.now() || removed < Math.floor(CACHE_MAX * 0.2)) {
            responseCache.delete(key);
            removed += 1;
          }
          if (responseCache.size <= CACHE_MAX * 0.8) break;
        }
      }
    }
    return normalizedRows;
  } finally {
    clearTimeout(timeout);
  }
}

// --- 좌표 변환 로직 (WGS84 <-> KATEC) ---
const KATEC_PARAMS = {
  RE: 6378137.0,
  FE: 400000.0,
  FN: 600000.0,
  LON0: 128.0 * (Math.PI / 180),
  LAT0: 38.0 * (Math.PI / 180),
  SCALE: 1.0,
  E2: 0.00669437999014132
};

function wgs84ToKatec(lat, lng) {
  const { RE, FE, FN, LON0, LAT0, SCALE, E2 } = KATEC_PARAMS;
  const phi = lat * (Math.PI / 180);
  const lam = lng * (Math.PI / 180);

  const m0 = RE * ((1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 * E2 * E2 / 256) * LAT0 - (3 * E2 / 8 + 3 * E2 * E2 / 32 + 45 * E2 * E2 * E2 / 1024) * Math.sin(2 * LAT0) + (15 * E2 * E2 / 256 + 45 * E2 * E2 * E2 / 1024) * Math.sin(4 * LAT0) - (35 * E2 * E2 * E2 / 3072) * Math.sin(6 * LAT0));
  const m = RE * ((1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 * E2 * E2 / 256) * phi - (3 * E2 / 8 + 3 * E2 * E2 / 32 + 45 * E2 * E2 * E2 / 1024) * Math.sin(2 * phi) + (15 * E2 * E2 / 256 + 45 * E2 * E2 * E2 / 1024) * Math.sin(4 * phi) - (35 * E2 * E2 * E2 / 3072) * Math.sin(6 * phi));

  const ep2 = E2 / (1 - E2);
  const n = RE / Math.sqrt(1 - E2 * Math.sin(phi) * Math.sin(phi));
  const t = Math.tan(phi) * Math.tan(phi);
  const c = ep2 * Math.cos(phi) * Math.cos(phi);
  const a = (lam - LON0) * Math.cos(phi);

  const x = FE + SCALE * n * (a + (1 - t + c) * a * a * a / 6 + (5 - 18 * t + t * t + 72 * c - 58 * ep2) * a * a * a * a * a / 120);
  const y = FN + SCALE * (m - m0 + n * Math.tan(phi) * (a * a / 2 + (5 - t + 9 * c + 4 * c * c) * a * a * a * a / 24 + (61 - 58 * t + t * t + 600 * c - 330 * ep2) * a * a * a * a * a * a / 720));

  return { x: Math.round(x), y: Math.round(y) };
}

function katecToWgs84(kx, ky) {
  const { RE, FE, FN, LON0, LAT0, SCALE, E2 } = KATEC_PARAMS;
  const e1 = (1 - Math.sqrt(1 - E2)) / (1 + Math.sqrt(1 - E2));
  const m0 = RE * ((1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 * E2 * E2 / 256) * LAT0 - (3 * E2 / 8 + 3 * E2 * E2 / 32 + 45 * E2 * E2 * E2 / 1024) * Math.sin(2 * LAT0) + (15 * E2 * E2 / 256 + 45 * E2 * E2 * E2 / 1024) * Math.sin(4 * LAT0) - (35 * E2 * E2 * E2 / 3072) * Math.sin(6 * LAT0));

  const m = m0 + (ky - FN) / SCALE;
  const mu = m / (RE * (1 - E2 / 4 - 3 * E2 * E2 / 64 - 5 * E2 * E2 * E2 / 256));

  const phi1 = mu + (3 * e1 / 2 - 27 * e1 * e1 * e1 / 32) * Math.sin(2 * mu) + (21 * e1 * e1 / 16 - 55 * e1 * e1 * e1 * e1 / 32) * Math.sin(4 * mu) + (151 * e1 * e1 * e1 / 96) * Math.sin(6 * mu) + (1097 * e1 * e1 * e1 * e1 / 512) * Math.sin(8 * mu);

  const ep2 = E2 / (1 - E2);
  const c1 = ep2 * Math.cos(phi1) * Math.cos(phi1);
  const t1 = Math.tan(phi1) * Math.tan(phi1);
  const n1 = RE / Math.sqrt(1 - E2 * Math.sin(phi1) * Math.sin(phi1));
  const r1 = RE * (1 - E2) / Math.pow(1 - E2 * Math.sin(phi1) * Math.sin(phi1), 1.5);
  const d = (kx - FE) / (n1 * SCALE);

  const lat = phi1 - (n1 * Math.tan(phi1) / r1) * (d * d / 2 - (5 + 3 * t1 + 10 * c1 - 4 * c1 * c1 - 9 * ep2) * d * d * d * d / 24 + (61 + 90 * t1 + 298 * c1 + 45 * t1 * t1 - 252 * ep2 - 3 * c1 * c1) * d * d * d * d * d * d / 720);
  const lng = LON0 + (d - (1 + 2 * t1 + c1) * d * d * d / 6 + (5 - 2 * c1 + 28 * t1 - 3 * c1 * c1 + 8 * ep2 + 24 * t1 * t1) * d * d * d * d * d / 120) / Math.cos(phi1);

  return { lat: Number((lat * 180 / Math.PI).toFixed(6)), lng: Number((lng * 180 / Math.PI).toFixed(6)) };
}

function haversineKm(aLat, aLng, bLat, bLng) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const sa =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
  return R * c;
}

module.exports = {
  fetchOpinet,
  fuelToProdcd,
  haversineKm,
  parseDate,
  parseNumber,
  pick,
  wgs84ToKatec,
  katecToWgs84
};
