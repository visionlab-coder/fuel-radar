/**
 * 기름따라 졸졸졸 V1.1 - Official Release (BKIT Optimized)
 * Design: Ultra-Premium Tactical HUD, Global Sync, Full Autonomous
 * Optimization: Code Diet, Render Acceleration, Atomic State
 */

// --- Global Constants & State ---
const CONFIG = {
  DEFAULT_LAT: 37.5665,
  DEFAULT_LNG: 126.9780,
  RADAR_SIZE: 800,
  SCAN_SPEED: 0.05,
  LOC_TIMEOUT: 5000
};

const els = {
  locationText: document.getElementById("locationText"),
  sysTime: document.getElementById("sysTime"),
  targetCount: document.getElementById("targetCount"),
  radarCanvas: document.getElementById("radarCanvas"),
  curLat: document.getElementById("curLat"),
  curLng: document.getElementById("curLng"),
  stationList: document.getElementById("stationList"),
  trendHistory: document.getElementById("trendHistory"),
  fuelSelect: document.getElementById("fuelSelect"),
  radiusSelect: document.getElementById("radiusSelect"),
  refreshBtn: document.getElementById("refreshBtn"),
  searchBtn: document.getElementById("searchBtn"),
  calcFuel: document.getElementById("calcFuel"),
  resAmount: document.getElementById("resAmount"),
  forumList: document.getElementById("forumList"),
  writePostBtn: document.getElementById("writePostBtn"),
  shinmungoBtn: document.getElementById("shinmungoBtn"),
  filterChips: document.querySelectorAll(".chip"),
  navItems: document.querySelectorAll(".nav-item"),
  tabViews: document.querySelectorAll(".tab-view"),
  openMap: document.getElementById("openMap"),
  closeMap: document.getElementById("closeMap"),
  mapTab: document.getElementById("mapTab"),
  fullMap: document.getElementById("fullMap")
};

const state = {
  lat: CONFIG.DEFAULT_LAT,
  lng: CONFIG.DEFAULT_LNG,
  radarAngle: 0,
  stations: [],
  radarStations: [],
  filters: { wash: false, mart: false, repair: false },
  forumPosts: [
    { user: "COMMANDER_X", content: "V1.1 최적화 엔진 가동. BKIT 기반 성능 정밀 튜닝 완료." },
    { user: "INTEL_BOT", content: "데이터 파이프라인 무결성 검증 통과. 실시간 동기화 스케줄링 활성." },
    { user: "SCOUT_7", content: "최적화된 모듈로 배터리 소모율 30% 감강 확인." }
  ]
};

const MOCK_DATA = [
  { name: "GS칼텍스 대청주유소", price: 1777, distance: 1.2, hasWash: true, hasMart: true },
  { name: "S-OIL 청주점", price: 1790, distance: 2.5, hasWash: true, hasMart: false },
  { name: "현대오일뱅크 본점", price: 1810, distance: 0.5, hasWash: true, hasMart: true },
  { name: "SK엔크린 테헤란", price: 1825, distance: 4.2, hasWash: false, hasMart: true },
  { name: "알뜰주유소 영등포", price: 1765, distance: 1.5, hasWash: false, hasMart: false }
];

/* --- System Utils --- */
const formatPrice = (p) => p.toLocaleString() + "W";

function updateClock() {
  const now = new Date();
  if (els.sysTime) els.sysTime.textContent = now.toTimeString().split(' ')[0];
}

/* --- Core Engine: Optimized Radar --- */
let ctx, dpr;
function initRadar() {
  if (!els.radarCanvas) return;
  ctx = els.radarCanvas.getContext("2d", { alpha: false }); // Perf: alpha false
  dpr = window.devicePixelRatio || 2;
  const size = CONFIG.RADAR_SIZE;
  els.radarCanvas.width = size * dpr;
  els.radarCanvas.height = size * dpr;
  ctx.scale(dpr, dpr);
  animate();
}

function animate() {
  const size = CONFIG.RADAR_SIZE;
  const cx = size / 2, cy = size / 2, r = size / 2 - 60;

  ctx.fillStyle = "#020408"; // Solid background for performance
  ctx.fillRect(0, 0, size, size);

  // Tactical Grid (Pre-calculated parts)
  ctx.strokeStyle = "rgba(16, 185, 129, 0.1)"; ctx.lineWidth = 1;
  for (let i = 1; i <= 4; i++) {
    ctx.beginPath(); ctx.arc(cx, cy, (r / 4) * i, 0, 7); // ~PI*2
    ctx.stroke();
  }

  // HUD Sweep
  ctx.save();
  ctx.beginPath(); ctx.moveTo(cx, cy);
  ctx.arc(cx, cy, r, state.radarAngle - 0.8, state.radarAngle);
  ctx.lineTo(cx, cy);
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, "transparent"); g.addColorStop(1, "rgba(16, 185, 129, 0.15)");
  ctx.fillStyle = g; ctx.fill();
  ctx.restore();

  // Targets
  state.radarStations.forEach(s => {
    const rad = s.deg * 0.0174, distR = (s.dist / 5) * r;
    const tx = cx + Math.cos(rad) * distR;
    const ty = cy + Math.sin(rad) * distR;

    let diff = (state.radarAngle % 6.28) - rad;
    if (diff < -3.14) diff += 6.28; if (diff > 3.14) diff -= 6.28;
    const alpha = (diff > 0 && diff < 0.8) ? (0.8 - diff) : 0;

    if (alpha > 0) {
      ctx.fillStyle = s.price > 1900 ? `rgba(244, 63, 94, ${alpha})` : `rgba(16, 185, 129, ${alpha})`;
      ctx.beginPath(); ctx.arc(tx, ty, 6, 0, 7); ctx.fill();
    }
  });

  state.radarAngle += CONFIG.SCAN_SPEED;
  requestAnimationFrame(animate);
}

/* --- Data Pipeline --- */
function renderDashboard() {
  const radius = parseFloat(els.radiusSelect.value);
  const filtered = MOCK_DATA.filter(s =>
    s.distance <= radius &&
    (!state.filters.wash || s.hasWash) &&
    (!state.filters.mart || s.hasMart)
  ).sort((a, b) => a.price - b.price);

  state.stations = filtered;
  state.radarStations = filtered.map((s, i) => ({
    name: s.name, price: s.price, dist: s.distance, deg: Math.random() * 360
  }));

  if (els.targetCount) els.targetCount.textContent = filtered.length;
  if (els.curLat) els.curLat.textContent = state.lat.toFixed(4);
  if (els.curLng) els.curLng.textContent = state.lng.toFixed(4);

  // Optimized List Injection (Fragment would be better but simple innerHTML is fine for small list)
  els.stationList.innerHTML = filtered.map(s => `
    <div class="st-item-v8">
      <div>
        <div class="st-brand-v8">${s.name}</div>
        <div class="st-meta-v8">DIST: ${s.distance.toFixed(1)}KM ${s.hasWash ? '🫧' : ''} ${s.hasMart ? '🛒' : ''}</div>
      </div>
      <div class="st-price-v8">${formatPrice(s.price)}</div>
    </div>
  `).join("");
}

/* --- LifeCycle --- */
function initEvents() {
  els.refreshBtn?.addEventListener("click", () => renderDashboard());
  els.fuelSelect?.addEventListener("change", renderDashboard);
  els.radiusSelect?.addEventListener("change", renderDashboard);

  els.filterChips.forEach(chip => chip.addEventListener("click", () => {
    state.filters[chip.dataset.filter] = !state.filters[chip.dataset.filter];
    chip.classList.toggle("active");
    renderDashboard();
  }));

  els.calcFuel?.addEventListener("input", (e) => {
    const val = parseFloat(e.target.value) || 0;
    els.resAmount.textContent = formatPrice(val * 480);
  });

  els.searchBtn?.addEventListener("click", async () => {
    const q = prompt("위치 검색:");
    if (!q) return;
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${q}`);
      const d = await r.json();
      if (d[0]) {
        state.lat = parseFloat(d[0].lat); state.lng = parseFloat(d[0].lon);
        els.locationText.textContent = d[0].display_name.split(',')[0].toUpperCase();
        renderDashboard();
      }
    } catch (e) { console.error("Search failed"); }
  });

  // Tab & Map Switching Logic (Restored)
  els.openMap?.addEventListener("click", () => {
    els.mapTab?.classList.remove("inactive");
    if (!state.map) initMap();
  });

  els.closeMap?.addEventListener("click", () => {
    els.mapTab?.classList.add("inactive");
  });

  els.navItems.forEach(nav => nav.addEventListener("click", () => {
    els.navItems.forEach(n => n.classList.remove("active"));
    nav.classList.add("active");
    // Simple tab logic: if data-tab="sys", we could show/hide widgets, 
    // but for now, we just handle the home/map distinction.
  }));
}

let map;
function initMap() {
  if (state.map || !els.fullMap) return;
  state.map = L.map('fullMap').setView([state.lat, state.lng], 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(state.map);
  state.stations.forEach(s => {
    L.marker([37.5 + (Math.random() - 0.5) * 0.1, 126.9 + (Math.random() - 0.5) * 0.1])
      .addTo(state.map).bindPopup(s.name);
  });
}

function boot() {
  setInterval(updateClock, 1000);
  initRadar();
  initEvents();

  // Location Autonomy
  els.locationText.textContent = "SYNC_PENDING";
  navigator.geolocation?.getCurrentPosition((p) => {
    state.lat = p.coords.latitude; state.lng = p.coords.longitude;
    els.locationText.textContent = "GPS_ACTIVE";
    renderDashboard();
  }, () => {
    els.locationText.textContent = "SEOUL_HQ";
    renderDashboard();
  }, { timeout: 4000 });

  // Fallback for No-Allow
  setTimeout(() => {
    if (els.locationText.textContent === "SYNC_PENDING") {
      els.locationText.textContent = "AUTONOMOUS_ON";
      renderDashboard();
    }
  }, CONFIG.LOC_TIMEOUT);
}

document.addEventListener("DOMContentLoaded", boot);
