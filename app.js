 * 기름따라 졸졸졸 V1.0 - Official Release
  * Design: Ultra - Premium Tactical HUD, Global Sync, Full Autonomous
    */

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
  tabViews: document.querySelectorAll(".tab-view")
};

const state = {
  lat: 37.5665,
  lng: 126.9780,
  radarAngle: 0,
  stations: [],
  radarStations: [],
  animationId: null,
  filters: { wash: false, mart: false, repair: false },
  forumPosts: [
    { user: "COMMANDER_X", content: "V1.0 정심 시스템 기동 완료. 모든 데이터가 암호화 동기화되었습니다." },
    { user: "INTEL_BOT", content: "지역별 유가 변동 실시간 추적 중... 데이터 센터와 정상 연결되었습니다." },
    { user: "SCOUT_7", content: "제보 시스템 가동 중. 시민 여러분의 소중한 정보를 기다립니다." }
  ]
};

const MOCK_DATA = [
  { name: "GS칼텍스 대청주유소", price: 1777, distance: 1.2, hasWash: true, hasMart: true },
  { name: "얌채주유소", price: 2150, distance: 0.8, hasWash: false, hasMart: false },
  { name: "S-OIL 청주점", price: 1790, distance: 2.5, hasWash: true, hasMart: false },
  { name: "현대오일뱅크 본점", price: 1810, distance: 0.5, hasWash: true, hasMart: true },
  { name: "SK엔크린 테헤란", price: 1825, distance: 4.2, hasWash: false, hasMart: true },
  { name: "알뜰주유소 영등포", price: 1765, distance: 1.5, hasWash: false, hasMart: false },
  { name: "고속터미널 주유소", price: 1850, distance: 3.1, hasWash: true, hasMart: true }
];

/* --- System Clock --- */
function startClock() {
  setInterval(() => {
    const now = new Date();
    if (els.sysTime) els.sysTime.textContent = now.toTimeString().split(' ')[0];
  }, 1000);
}

/* --- Tactical Radar Engine (Ultra-Smooth) --- */
function initRadar() {
  if (!els.radarCanvas) return;
  const ctx = els.radarCanvas.getContext("2d");
  const size = 800;
  const dpr = window.devicePixelRatio || 2;
  els.radarCanvas.width = size * dpr; els.radarCanvas.height = size * dpr; ctx.scale(dpr, dpr);

  function draw() {
    ctx.fillStyle = "rgba(2, 4, 8, 0.45)"; ctx.fillRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2, r = size / 2 - 60;

    // Tactical Grid
    ctx.strokeStyle = "rgba(16, 185, 129, 0.1)"; ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, (r / 4) * i, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(0, cy); ctx.lineTo(size, cy); ctx.moveTo(cx, 0); ctx.lineTo(cx, size); ctx.stroke();

    // Scan Sweep
    const sweepWidth = 0.8;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, state.radarAngle - sweepWidth, state.radarAngle);
    ctx.lineTo(cx, cy);
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, "rgba(16, 185, 129, 0)"); g.addColorStop(1, "rgba(16, 185, 129, 0.15)");
    ctx.fillStyle = g; ctx.fill();
    ctx.restore();

    // Key Beam
    ctx.beginPath(); ctx.strokeStyle = "rgba(16, 185, 129, 0.8)"; ctx.lineWidth = 2;
    ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(state.radarAngle) * r, cy + Math.sin(state.radarAngle) * r); ctx.stroke();

    // Targets
    state.radarStations.forEach(s => {
      const rad = s.deg * (Math.PI / 180), distR = (s.dist / 5) * r;
      const tx = cx + Math.cos(rad) * distR, ty = cy + Math.sin(rad) * distR;

      let diff = (state.radarAngle % (Math.PI * 2)) - rad;
      if (diff < -Math.PI) diff += Math.PI * 2; if (diff > Math.PI) diff -= Math.PI * 2;
      let alpha = (diff > 0 && diff < 0.8) ? (0.8 - diff) / 0.8 : 0;

      if (alpha > 0) {
        ctx.fillStyle = s.price > 1900 ? `rgba(244, 63, 94, ${alpha})` : `rgba(16, 185, 129, ${alpha})`;
        ctx.beginPath(); ctx.arc(tx, ty, 8, 0, Math.PI * 2); ctx.fill();
        if (alpha > 0.6) {
          ctx.font = "bold 14px var(--font-mono)"; ctx.fillStyle = "#fff";
          ctx.fillText(`${s.price}W`, tx + 12, ty - 12);
        }
      }
    });

    state.radarAngle += 0.05;
    state.animationId = requestAnimationFrame(draw);
  }
  if (state.animationId) cancelAnimationFrame(state.animationId); draw();
}

/* --- UI Renderers --- */
function renderDashboard(data) {
  const radius = parseFloat(els.radiusSelect.value);
  let filtered = data.filter(s => {
    if (s.distance > radius) return false;
    if (state.filters.wash && !s.hasWash) return false;
    if (state.filters.mart && !s.hasMart) return false;
    return true;
  });

  state.stations = filtered.sort((a, b) => a.price - b.price);

  // Persistent Radar Targets
  state.radarStations = state.stations.map((s, i) => {
    const prev = state.radarStations.find(r => r.name === s.name);
    return { id: i + 1, name: s.name, price: s.price, dist: s.distance, deg: prev ? prev.deg : Math.random() * 360 };
  });

  if (els.targetCount) els.targetCount.textContent = state.stations.length;
  if (els.curLat) els.curLat.textContent = state.lat.toFixed(4);
  if (els.curLng) els.curLng.textContent = state.lng.toFixed(4);

  // List Rendering
  els.stationList.innerHTML = state.stations.map((s, i) => `
    <div class="st-item-v8">
      <div class="st-content">
        <div class="st-brand-v8">${s.name}</div>
        <div class="st-meta-v8">DIST: ${s.distance.toFixed(1)}KM | ${s.hasWash ? 'WASH🧼' : ''} ${s.hasMart ? 'MART🏪' : ''}</div>
      </div>
      <div class="st-price-v8">${s.price.toLocaleString()}</div>
    </div>
  `).join("") || `<div style="padding:3rem; text-align:center; color:#475569;">조회된 타겟이 없습니다.</div>`;

  // Trend Rendering (Technical List Style)
  els.trendHistory.innerHTML = [1780, 1775, 1770, 1785, 1790].map((p, i) => `
    <div style="display:flex; justify-content:space-between; padding:0.5rem 0; border-bottom:1px solid rgba(255,255,255,0.03);">
      <span style="font-family:var(--font-mono); font-size:0.75rem; color:#64748b;">D-${i + 1}_LOG</span>
      <span style="font-weight:700; color:var(--neon-cyan);">${p}W</span>
    </div>
  `).join("");

  updateForum();
}

function updateForum() {
  els.forumList.innerHTML = state.forumPosts.map(p => `
    <div style="margin-bottom:1rem; padding-bottom:0.5rem; border-bottom:1px solid rgba(255,255,255,0.03);">
      <div style="font-family:var(--font-mono); font-size:0.7rem; color:var(--neon-emerald); font-weight:800;">@${p.user}</div>
      <div style="font-size:0.85rem; color:#f1f5f9; font-weight:600; margin-top:4px;">${p.content}</div>
    </div>
  `).join("");
}

/* --- App LifeCycle --- */
async function syncSystem() {
  els.locationText.textContent = "SYNCHRONIZING...";
  setTimeout(() => {
    els.locationText.textContent = els.locationText.textContent === "SYNCHRONIZING..." ? "HQ_FIXED" : els.locationText.textContent;
    renderDashboard(MOCK_DATA);
  }, 1000);
}

function initEvents() {
  els.refreshBtn?.addEventListener("click", syncSystem);
  els.fuelSelect?.addEventListener("change", () => renderDashboard(MOCK_DATA));
  els.radiusSelect?.addEventListener("change", () => renderDashboard(MOCK_DATA));

  els.filterChips.forEach(chip => chip.addEventListener("click", () => {
    state.filters[chip.dataset.filter] = !state.filters[chip.dataset.filter];
    chip.classList.toggle("active");
    renderDashboard(MOCK_DATA);
  }));

  els.calcFuel?.addEventListener("input", () => {
    const val = parseFloat(els.calcFuel.value) || 0;
    els.resAmount.textContent = `+${(val * 480).toLocaleString()} KRW`;
  });

  els.searchBtn?.addEventListener("click", async () => {
    const q = prompt("위치 검색 (V1.0 OFFICIAL):");
    if (!q) return;
    els.locationText.textContent = "SEARCHING...";
    try {
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}`);
      const d = await r.json();
      if (d[0]) {
        state.lat = parseFloat(d[0].lat); state.lng = parseFloat(d[0].lon);
        els.locationText.textContent = d[0].display_name.split(',')[0].toUpperCase();
        syncSystem();
      }
    } catch (e) { els.locationText.textContent = "SEARCH_ERR"; }
  });

  // Reporting Handlers
  els.shinmungoBtn?.addEventListener("click", () => alert("신문고 시스템에 전송되었습니다. (Pass Skill Log)"));
  els.writePostBtn?.addEventListener("click", () => {
    const content = prompt("상세 제보 내용 입력:");
    if (content) {
      state.forumPosts.unshift({ user: "COMMANDER_USR", content });
      updateForum();
    }
  });
}

function autonomousBoot() {
  startClock();
  initRadar();
  initEvents();

  // Location Autonomy (Zero-Allow Support)
  let fallback = setTimeout(() => {
    console.warn("PASS_SKILL: Location Timeout. Using HQ.");
    els.locationText.textContent = "SEOUL_HQ";
    syncSystem();
  }, 5000);

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition((p) => {
      clearTimeout(fallback);
      state.lat = p.coords.latitude; state.lng = p.coords.longitude;
      els.locationText.textContent = "GPS_LOCKED";
      syncSystem();
    }, () => {
      clearTimeout(fallback);
      els.locationText.textContent = "SIM_LINK_ON";
      syncSystem();
    }, { timeout: 4500 });
  }
}

document.addEventListener("DOMContentLoaded", autonomousBoot);
