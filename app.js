/**
 * 기름따라 졸졸졸 V6.1 - Final Stability Patch
 * Fixed: Distance Filtering, Search Conflict, UI Overlap
 */

const els = {
  header: document.querySelector(".hud-header"),
  locationText: document.getElementById("locationText"),
  targetCount: document.getElementById("targetCount"),
  radarStatus: document.getElementById("radarStatus"),
  radarCanvas: document.getElementById("radarCanvas"),
  stationList: document.getElementById("stationList"),
  trendHistory: document.getElementById("trendHistory"),
  fuelSelect: document.getElementById("fuelSelect"),
  radiusSelect: document.getElementById("radiusSelect"),
  refreshBtn: document.getElementById("refreshBtn"),
  calcFuel: document.getElementById("calcFuel"),
  resAmount: document.getElementById("resAmount"),
  navBtns: document.querySelectorAll(".nav-btn"),
  tabPanes: document.querySelectorAll(".tab-pane"),
  filterChips: document.querySelectorAll(".filter-chip"),
  forumList: document.getElementById("forumList"),
  writePostBtn: document.getElementById("writePostBtn"),
  searchBtn: document.getElementById("searchBtn")
};

const state = {
  lat: 36.625,
  lng: 127.478,
  refreshing: false,
  radarAngle: 0,
  stations: [],
  radarStations: [],
  animationId: null,
  activeTab: "home",
  filters: { wash: false, mart: false, repair: false },
  forumPosts: [
    { user: "USER_7821", content: "모충동 GS주유소 세차장 시설 진짜 좋네요! 가격도 저렴합니다." },
    { user: "FUEL_KING_99", content: "오늘 경유 가격 전체적으로 10원 정도 오른 것 같아요. 참고하세요." },
    { user: "ANTIGRAVITY", content: "실시간 유가 센터 V6.1 패치 완료. 모든 기능 정상 작동 중." }
  ]
};

const DEMO_MODE = true;

// Base Mock Data (v6.1 Extended)
const MOCK_STATIONS = [
  { name: "GS칼텍스 대청주유소", price: 1777, distance: 2.5, hasWash: true, hasMart: true },
  { name: "얌채주유소", price: 1980, distance: 1.2, hasWash: false, hasMart: false },
  { name: "S-OIL 청주점", price: 1790, distance: 0.8, hasWash: true, hasMart: false },
  { name: "현대오일뱅크 모충", price: 1810, distance: 0.5, hasWash: true, hasMart: true },
  { name: "SK엔크린 산남", price: 1825, distance: 4.2, hasWash: false, hasMart: true },
  { name: "알뜰주유소 수곡", price: 1765, distance: 4.8, hasWash: false, hasMart: false }
];

/* --- HiDPI Radar Logic --- */
function setupRadar() {
  if (!els.radarCanvas) return;
  const ctx = els.radarCanvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const size = 800;
  els.radarCanvas.width = size * dpr; els.radarCanvas.height = size * dpr; ctx.scale(dpr, dpr);
  function draw() {
    ctx.fillStyle = "rgba(0, 5, 0, 0.2)"; ctx.fillRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2, r = size / 2 - 60;
    ctx.strokeStyle = "rgba(34, 211, 238, 0.12)"; ctx.lineWidth = 1;
    [0.2, 0.4, 0.6, 0.8, 1].forEach(m => { ctx.beginPath(); ctx.arc(cx, cy, r * m, 0, Math.PI * 2); ctx.stroke(); });
    const sweepWidth = 0.5; ctx.save(); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, state.radarAngle - sweepWidth, state.radarAngle);
    ctx.lineTo(cx, cy); ctx.fillStyle = "rgba(34, 211, 238, 0.1)"; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.strokeStyle = "rgba(34, 211, 238, 1)"; ctx.lineWidth = 3;
    ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(state.radarAngle) * r, cy + Math.sin(state.radarAngle) * r); ctx.stroke();
    state.radarStations.forEach(s => {
      const targetRad = s.deg * (Math.PI / 180), targetR = (s.dist / 5) * r;
      const tx = cx + Math.cos(targetRad) * targetR, ty = cy + Math.sin(targetRad) * targetR;
      let diff = (state.radarAngle % (Math.PI * 2)) - targetRad;
      if (diff < -Math.PI) diff += Math.PI * 2; if (diff > Math.PI) diff -= Math.PI * 2;
      let alpha = (diff > 0 && diff < 0.6) ? (0.6 - diff) / 0.6 : 0;
      if (alpha > 0) {
        ctx.fillStyle = s.price > 1850 ? `rgba(248, 113, 113, ${alpha})` : `rgba(34, 211, 238, ${alpha})`;
        ctx.beginPath(); ctx.arc(tx, ty, 10, 0, Math.PI * 2); ctx.fill();
        if (alpha > 0.8) { ctx.font = "bold 18px var(--font-mono)"; ctx.fillText(`ID_${s.id}: ${s.price}W`, tx + 20, ty - 20); }
      }
    });
    state.radarAngle += 0.04; state.animationId = requestAnimationFrame(draw);
  }
  if (state.animationId) cancelAnimationFrame(state.animationId); draw();
}

/* --- Core UI Rendering --- */
function renderHUD(stations) {
  // Strict Radius & Feature Filter Logic (V6.1 FIX)
  const maxRadius = parseFloat(els.radiusSelect?.value || 3);

  let filtered = stations.filter(s => {
    const d = parseFloat(s.distance);
    if (d > maxRadius) return false; // Strict distance filter
    if (state.filters.wash && !s.hasWash) return false;
    if (state.filters.mart && !s.hasMart) return false;
    return true;
  });

  state.stations = filtered.sort((a, b) => a.price - b.price);

  // Update Radar Targets with persistent degrees
  state.radarStations = state.stations.map((s, i) => {
    const existing = state.radarStations.find(rs => rs.name === s.name);
    return { id: i + 1, dist: s.distance, deg: existing ? existing.deg : Math.floor(Math.random() * 360), price: s.price, name: s.name };
  });

  els.targetCount.textContent = `${state.stations.length} UNITS`;

  els.stationList.innerHTML = state.stations.slice(0, 8).map((s, i) => `
    <div class="hud-item ${i === 0 ? 'cheapest' : ''}">
      <div class="st-info">
        <span class="st-rank">RANK_#${i + 1}</span>
        <span class="st-name">${s.name}</span>
        <div class="price-progress"><div class="progress-bar" style="width:${Math.max(20, 100 - (s.price - 1500) / 5)}%"></div></div>
        <span class="st-detail">${s.price.toLocaleString()} KRW</span>
        <div style="font-size:0.75rem; color:#94a3b8; font-weight:700; margin-top:4px;">
          DIST: ${s.distance.toFixed(1)}KM | ${s.hasWash ? '🧼 WASH' : ''} ${s.hasMart ? '🏪 MART' : ''}
        </div>
      </div>
      <button class="hud-btn-icon" onclick="alert('TARGET_LOCKED: ${s.name}')">LOCK</button>
    </div>
  `).join("") || `<div style="padding:2rem; text-align:center; color:#64748b;">범위 내 탐지된 주유소가 없습니다.</div>`;

  updateForum();
}

async function fetchData() {
  state.refreshing = true;
  els.radarStatus.textContent = "COMM_LINK_SYNCING...";
  try {
    // In demo mode, we always use our mock set and rely on renderHUD's strict filter
    renderHUD(MOCK_STATIONS);
    els.radarStatus.textContent = "SYSTEM_SYNC_OK";
  } catch (e) {
    els.radarStatus.textContent = "SCAN_ERR_OVERRIDE";
  } finally { state.refreshing = false; }
}

function updateForum() {
  if (!els.forumList) return;
  els.forumList.innerHTML = state.forumPosts.map(p => `
    <div class="forum-card"><span class="forum-user">@${p.user}</span><p class="forum-content">${p.content}</p></div>
  `).join("");
}

async function handleSearch() {
  const query = prompt("검색할 지역명을 입력하세요 (예: 청주시 모충동):");
  if (!query) return;
  els.locationText.textContent = "SEARCHING...";
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data.length > 0) {
      state.lat = parseFloat(data[0].lat); state.lng = parseFloat(data[0].lon);
      els.locationText.textContent = data[0].display_name.split(',')[0];
      fetchData();
    } else { alert("검색 결과를 찾을 수 없습니다."); }
  } catch (e) { alert("검색 중 오류가 발생했습니다."); }
}

/* --- Initialization (V6.1) --- */
function init() {
  setupRadar();
  fetchData();

  // Tab Switching FIX (Strict display control)
  els.navBtns.forEach(btn => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const tab = btn.dataset.tab;
    els.navBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    els.tabPanes.forEach(p => {
      p.classList.toggle("active", p.id === `${tab}Tab`);
      p.style.display = (p.id === `${tab}Tab`) ? "block" : "none";
    });
    if (tab === "map") initFullMap();
    window.scrollTo(0, 0);
  }));

  els.filterChips.forEach(chip => chip.addEventListener("click", () => {
    state.filters[chip.dataset.filter] = !state.filters[chip.dataset.filter];
    chip.classList.toggle("active");
    fetchData();
  }));

  // Explicit handlers ensuring no conflict
  els.fuelSelect?.addEventListener("change", fetchData);
  els.radiusSelect?.addEventListener("change", fetchData);
  els.refreshBtn?.addEventListener("click", fetchData);

  // SEARCH specifically targeted (ID based)
  document.getElementById("searchBtn")?.addEventListener("click", (e) => {
    e.preventDefault();
    handleSearch();
  });

  els.writePostBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    const content = prompt("커뮤니티에 공유할 내용을 입력하세요:");
    if (content) {
      state.forumPosts.unshift({ user: "ME_" + Math.floor(Math.random() * 999), content });
      updateForum();
    }
  });

  els.calcFuel?.addEventListener("input", () => {
    const val = parseFloat(els.calcFuel.value) || 0;
    els.resAmount.textContent = `+${(val * 450).toLocaleString()} KRW`;
  });
}

function initFullMap() {
  const mapEl = document.getElementById("fullMap");
  if (!mapEl || mapEl._leaflet_id) return;
  const map = L.map('fullMap').setView([state.lat, state.lng], 14);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
  L.marker([state.lat, state.lng]).addTo(map).bindPopup("MY_POITION").openPopup();
  MOCK_STATIONS.forEach(s => {
    const lat = state.lat + (Math.random() - 0.5) * 0.02, lng = state.lng + (Math.random() - 0.5) * 0.02;
    L.circleMarker([lat, lng], { color: 'var(--hud-accent)', radius: 8 }).addTo(map).bindPopup(`<b>${s.name}</b><br>${s.price}W`);
  });
}

document.addEventListener("DOMContentLoaded", init);
