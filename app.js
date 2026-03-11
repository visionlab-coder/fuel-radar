const els = {
  locationText: document.getElementById("locationText"),
  targetCount: document.getElementById("targetCount"),
  radarStatus: document.getElementById("radarStatus"),
  radarCanvas: document.getElementById("radarCanvas"),
  stationList: document.getElementById("stationList"),
  trendHistory: document.getElementById("trendHistory"),
  fuelSelect: document.getElementById("fuelSelect"),
  refreshBtn: document.getElementById("refreshBtn"),
  calcFuel: document.getElementById("calcFuel"),
  resAmount: document.getElementById("resAmount"),
  navBtns: document.querySelectorAll(".nav-btn"),
  tabPanes: document.querySelectorAll(".tab-pane")
};

const urlParams = new URLSearchParams(window.location.search);
const DEMO_MODE = urlParams.get("demo") === "1" || true; // Force demo for visual check initially

const state = {
  lat: 37.5665,
  lng: 126.978,
  refreshing: false,
  radarAngle: 0,
  stations: [],
  radarStations: [],
  animationId: null,
  activeTab: "home"
};

/* --- HiDPI Canvas Logic --- */
function setupRadar() {
  if (!els.radarCanvas) return;
  const ctx = els.radarCanvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const size = 800; // Original resolution

  els.radarCanvas.width = size * dpr;
  els.radarCanvas.height = size * dpr;
  ctx.scale(dpr, dpr);

  function draw() {
    ctx.fillStyle = "rgba(0, 5, 0, 0.15)"; // Tactical Afterglow
    ctx.fillRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 40;

    // 1. Grid Rings
    ctx.strokeStyle = "rgba(34, 211, 238, 0.15)";
    ctx.lineWidth = 1.5;
    [0.2, 0.4, 0.6, 0.8, 1].forEach(m => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * m, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 2. Crosshair
    ctx.beginPath();
    ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
    ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
    ctx.stroke();

    // 3. Scan Sweep
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, "rgba(34, 211, 238, 0)");
    grad.addColorStop(1, "rgba(34, 211, 238, 0.1)");

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, state.radarAngle, state.radarAngle + 0.3);
    ctx.lineTo(cx, cy);
    ctx.fillStyle = grad;
    ctx.fill();

    // Sweep Line
    ctx.beginPath();
    ctx.strokeStyle = "rgba(34, 211, 238, 0.8)";
    ctx.lineWidth = 3;
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(state.radarAngle) * r, cy + Math.sin(state.radarAngle) * r);
    ctx.stroke();

    // 4. Targets
    state.radarStations.forEach(s => {
      const distRatio = Math.min(s.dist / 5, 1); // Max 5km
      const targetR = distRatio * r;
      const targetRad = s.deg * (Math.PI / 180);

      const tx = cx + Math.cos(targetRad) * targetR;
      const ty = cy + Math.sin(targetRad) * targetR;

      let diff = (state.radarAngle % (Math.PI * 2)) - targetRad;
      if (diff < -Math.PI) diff += Math.PI * 2;
      if (diff > Math.PI) diff -= Math.PI * 2;

      let alpha = 0.2;
      if (diff > 0 && diff < 0.6) alpha = 1.0;

      const color = s.price > 1700 ? `rgba(251, 146, 60, ${alpha})` : `rgba(34, 211, 238, ${alpha})`;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(tx, ty, 8, 0, Math.PI * 2);
      ctx.fill();

      if (alpha > 0.8) {
        ctx.shadowBlur = 15; ctx.shadowColor = color;
        ctx.font = "bold 20px 'Space Grotesk', monospace";
        ctx.fillText(`▶ UNIT_${s.id}`, tx + 15, ty - 10);
        ctx.fillText(`COST: ${s.price}W`, tx + 15, ty + 15);
        ctx.shadowBlur = 0;
      }
    });

    state.radarAngle += 0.035;
    state.animationId = requestAnimationFrame(draw);
  }
  if (state.animationId) cancelAnimationFrame(state.animationId);
  draw();
}

/* --- Render HUD Data --- */
function renderHUD(stations) {
  state.stations = stations.sort((a, b) => a.price - b.price);
  state.radarStations = state.stations.map((s, i) => ({
    id: i + 1,
    dist: s.distance,
    deg: Math.floor(Math.random() * 360),
    price: s.price,
    name: s.name
  }));

  els.targetCount.textContent = `${state.stations.length} UNITS`;

  // Station List
  els.stationList.innerHTML = state.stations.slice(0, 10).map((s, i) => `
    <div class="hud-item ${i === 0 ? 'cheapest' : ''}" style="animation: fadeUp 0.5s ${i * 0.05}s backwards">
      <div class="st-info">
        <span class="st-rank">RANK_#${i + 1}</span>
        <span class="st-name">${s.name}</span>
        <div class="price-progress">
          <div class="progress-bar" style="width: ${Math.max(30, 100 - (s.price - 1500) / 5)}%"></div>
        </div>
        <span class="st-detail">${s.distance.toFixed(1)}KM | ${s.price.toLocaleString()} KRW</span>
      </div>
      <button class="hud-btn-icon" onclick="alert('TARGET_LOCKED: ${s.name}')">LOCK</button>
    </div>
  `).join("");

  // Trend
  const dates = ["03-11", "03-10", "03-09", "03-08", "03-07"];
  els.trendHistory.innerHTML = dates.map(d => `
    <div class="trend-item">
      <span>2026-${d}</span>
      <span style="color:${Math.random() > 0.5 ? '#4ade80' : '#fb7185'}">${(Math.random() * 10).toFixed(2)} KRW</span>
    </div>
  `).join("");
}

/* --- Core Fetch & Safety Fallback --- */
async function fetchData() {
  state.refreshing = true;
  els.radarStatus.textContent = "SCANNING_AIRSPACE...";

  try {
    let stats;
    if (DEMO_MODE) {
      stats = {
        stations: [
          { name: "GS칼텍스 대청주유소", price: 1777, distance: 2.5, brand: "GS" },
          { name: "얌채주유소", price: 1980, distance: 1.2, brand: "ETC" },
          { name: "S-OIL 청주점", price: 1790, distance: 3.1, brand: "S-OIL" },
          { name: "현대오일뱅크 모충", price: 1810, distance: 0.8, brand: "현대" }
        ]
      };
    } else {
      const res = await fetch(`/api/stations?lat=${state.lat}&lng=${state.lng}&radiusKm=3&fuel=gasoline`);
      stats = await res.json();
    }
    renderHUD(stats.stations);
    els.radarStatus.textContent = "SCAN_COMPLETE_SUCCESS";
  } catch (e) {
    els.radarStatus.textContent = "SCAN_FAILED_OVERRIDE";
  } finally {
    state.refreshing = false;
  }
}

/* --- Init with Timeout Safety --- */
function init() {
  setupRadar();

  // Geolocation Timeout Safety (5 seconds)
  let geoTimeout = setTimeout(() => {
    console.warn("GEO_TIMEOUT: Falling back to SEOUL_HQ");
    els.locationText.textContent = "HQ_OVERRIDE (SEOUL)";
    fetchData();
  }, 5000);

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition((pos) => {
      clearTimeout(geoTimeout);
      state.lat = pos.coords.latitude;
      state.lng = pos.coords.longitude;
      els.locationText.textContent = "GPS_SYNC_OK";
      fetchData();
    }, () => {
      clearTimeout(geoTimeout);
      els.locationText.textContent = "HQ_DEMO_ACTIVE";
      fetchData();
    }, { timeout: 4500 });
  }

  // Interactions
  els.navBtns.forEach(btn => btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    els.navBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    els.tabPanes.forEach(p => p.classList.toggle("active", p.id === `${tab}Tab`));
  }));
}

document.addEventListener("DOMContentLoaded", init);
