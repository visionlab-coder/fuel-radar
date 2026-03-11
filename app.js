/**
 * 기름따라 졸졸졸 V7.0 - Autonomous Branding Engine
 * Features: Pass Skill (Zero Confirm), YouTube High-Visibility Style, Integrated Reporting
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
  searchBtn: document.getElementById("searchBtn"),
  lastScanTime: document.getElementById("lastScanTime")
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
    { user: "PASS_AGENT", content: "V7.0 자율 브랜딩 시스템 가동. 모든 시스템 정상 확인." }
  ]
};

const MOCK_STATIONS = [
  { name: "GS칼텍스 대청주유소", price: 1777, distance: 2.5, hasWash: true, hasMart: true },
  { name: "얌채주유소", price: 1980, distance: 1.2, hasWash: false, hasMart: false },
  { name: "S-OIL 청주점", price: 1790, distance: 0.8, hasWash: true, hasMart: false },
  { name: "현대오일뱅크 모충", price: 1810, distance: 0.5, hasWash: true, hasMart: true },
  { name: "SK엔크린 산남", price: 1825, distance: 4.2, hasWash: false, hasMart: true },
  { name: "알뜰주유소 수곡", price: 1765, distance: 4.8, hasWash: false, hasMart: false }
];

/* --- Radar V7 (Platinum Fluid Animation) --- */
function setupRadar() {
  if (!els.radarCanvas) return;
  const ctx = els.radarCanvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const size = 800;
  els.radarCanvas.width = size * dpr; els.radarCanvas.height = size * dpr; ctx.scale(dpr, dpr);
  function draw() {
    ctx.fillStyle = "rgba(4, 6, 11, 0.25)"; ctx.fillRect(0, 0, size, size);
    const cx = size / 2, cy = size / 2, r = size / 2 - 80;

    // Grid Lines (Elegant Emerald)
    ctx.strokeStyle = "rgba(52, 211, 153, 0.15)"; ctx.lineWidth = 1;
    [0.2, 0.4, 0.6, 0.8, 1.0].forEach(m => { ctx.beginPath(); ctx.arc(cx, cy, r * m, 0, Math.PI * 2); ctx.stroke(); });

    // Sweep Line (High Intensity)
    const sweepWidth = 0.6; ctx.save(); ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, state.radarAngle - sweepWidth, state.radarAngle);
    ctx.lineTo(cx, cy);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, "rgba(52, 211, 153, 0)"); grad.addColorStop(1, "rgba(52, 211, 153, 0.2)");
    ctx.fillStyle = grad; ctx.fill(); ctx.restore();

    ctx.beginPath(); ctx.strokeStyle = "var(--hud-accent)"; ctx.lineWidth = 3;
    ctx.shadowBlur = 10; ctx.shadowColor = "var(--hud-accent)";
    ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(state.radarAngle) * r, cy + Math.sin(state.radarAngle) * r); ctx.stroke();
    ctx.shadowBlur = 0;

    // Targets (V7 Noise-Zero)
    state.radarStations.forEach(s => {
      const targetRad = s.deg * (Math.PI / 180), targetR = (s.dist / 5) * r;
      const tx = cx + Math.cos(targetRad) * targetR, ty = cy + Math.sin(targetRad) * targetR;
      let diff = (state.radarAngle % (Math.PI * 2)) - targetRad;
      if (diff < -Math.PI) diff += Math.PI * 2; if (diff > Math.PI) diff -= Math.PI * 2;
      let alpha = (diff > 0 && diff < 0.6) ? (0.6 - diff) / 0.6 : 0;
      if (alpha > 0) {
        const color = s.price > 1850 ? `rgba(248, 113, 113, ${alpha})` : `rgba(52, 211, 153, ${alpha})`;
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(tx, ty, 12, 0, Math.PI * 2); ctx.fill();
        if (alpha > 0.8) {
          ctx.fillStyle = color; ctx.font = "bold 20px var(--font-mono)";
          ctx.fillText(`UNIT_${s.id}: ${s.price}W`, tx + 20, ty - 20);
        }
      }
    });
    state.radarAngle += 0.045; state.animationId = requestAnimationFrame(draw);
  }
  if (state.animationId) cancelAnimationFrame(state.animationId); draw();
}

/* --- UI Logic --- */
function renderHUD(stations) {
  const maxRadius = parseFloat(els.radiusSelect?.value || 3);
  let filtered = stations.filter(s => {
    if (s.distance > maxRadius) return false;
    if (state.filters.wash && !s.hasWash) return false;
    if (state.filters.mart && !s.hasMart) return false;
    return true;
  });

  state.stations = filtered.sort((a, b) => a.price - b.price);
  state.radarStations = state.stations.map((s, i) => {
    const existing = state.radarStations.find(rs => rs.name === s.name);
    return { id: i + 1, dist: s.distance, deg: existing ? existing.deg : Math.floor(Math.random() * 360), price: s.price, name: s.name };
  });

  els.targetCount.textContent = `${state.stations.length} UNITS`;
  els.lastScanTime.textContent = new Date().toLocaleTimeString();

  els.stationList.innerHTML = state.stations.map((s, i) => `
    <div class="hud-item ${i === 0 ? 'cheapest' : ''}">
      <div class="st-info">
        <span class="st-rank">RANK_#${i + 1}</span>
        <span class="st-name">${s.name}</span>
        <div class="price-progress"><div class="progress-bar" style="width:${Math.max(20, 100 - (s.price - 1500) / 5)}%"></div></div>
        <span class="st-detail">${s.price.toLocaleString()} KRW</span>
        <div style="font-size:0.8rem; color:#94a3b8; font-weight:700; margin-top:6px;">
          DIST: ${s.distance.toFixed(1)}KM | ${s.hasWash ? '🧼' : ''} ${s.hasMart ? '🏪' : ''}
        </div>
      </div>
      <button class="hud-btn-icon" onclick="alert('TARGET_LOCKED: ${s.name}')">LOCK</button>
    </div>
  `).join("") || `<div style="padding:4rem; text-align:center; color:#475569; font-weight:700;">범위 내 감지된 유닛이 없습니다.</div>`;

  updateForum();
}

async function fetchData() {
  state.refreshing = true;
  els.radarStatus.textContent = "SYNCHRONIZING_PLATINUM_LINK...";
  try {
    renderHUD(MOCK_STATIONS);
    els.radarStatus.textContent = "SYSTEM_OPTIMIZED";
  } catch (e) {
    els.radarStatus.textContent = "SCAN_FAIL_RETRYING...";
  } finally { state.refreshing = false; }
}

function updateForum() {
  if (!els.forumList) return;
  els.forumList.innerHTML = state.forumPosts.map(p => `
    <div class="forum-card"><span class="forum-user">@${p.user}</span><p class="forum-content">${p.content}</p></div>
  `).join("");
}

async function handleSearch() {
  const query = prompt("검색할 지역명을 입력하세요 (V7 Autonomous):");
  if (!query) return;
  els.locationText.textContent = "SEARCHING...";
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    if (data.length > 0) {
      state.lat = parseFloat(data[0].lat); state.lng = parseFloat(data[0].lon);
      els.locationText.textContent = data[0].display_name.split(',')[0];
      fetchData();
    }
  } catch (e) { console.error("Search Error", e); }
}

/* --- Pass Skill: Auto-Location Fallback --- */
function autonomousInit() {
  setupRadar();

  // No-Confirm Geolocation Timeout (V7 Logic)
  let geoTimeout = setTimeout(() => {
    console.warn("PASS_SKILL: Geo Timeout. Auto-loading HQ coordinates.");
    els.locationText.textContent = "HQ_SYNC (DEFAULT)";
    fetchData();
  }, 5000);

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition((pos) => {
      clearTimeout(geoTimeout);
      state.lat = pos.coords.latitude; state.lng = pos.coords.longitude;
      els.locationText.textContent = "GLOBAL_SYNC_OK";
      fetchData();
    }, () => {
      clearTimeout(geoTimeout);
      els.locationText.textContent = "DEMO_LINK_ON";
      fetchData();
    }, { timeout: 4500 });
  }

  // Event Listeners V7
  els.navBtns.forEach(btn => btn.addEventListener("click", (e) => {
    const tab = btn.dataset.tab;
    els.navBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    els.tabPanes.forEach(p => {
      p.classList.toggle("active", p.id === `${tab}Tab`);
      p.style.display = (p.id === `${tab}Tab`) ? "block" : "none";
    });
    if (tab === "map") initFullMap();
  }));

  els.filterChips.forEach(chip => chip.addEventListener("click", () => {
    state.filters[chip.dataset.filter] = !state.filters[chip.dataset.filter];
    chip.classList.toggle("active");
    fetchData();
  }));

  els.fuelSelect?.addEventListener("change", fetchData);
  els.radiusSelect?.addEventListener("change", fetchData);
  els.refreshBtn?.addEventListener("click", fetchData);
  els.searchBtn?.addEventListener("click", handleSearch);

  els.writePostBtn?.addEventListener("click", () => {
    const content = prompt("커뮤니티 상세 제보를 입력하세요:");
    if (content) {
      state.forumPosts.unshift({ user: "USER_" + Math.floor(Math.random() * 999), content });
      updateForum();
    }
  });

  els.calcFuel?.addEventListener("input", () => {
    const val = parseFloat(els.calcFuel.value) || 0;
    els.resAmount.textContent = `+${(val * 480).toLocaleString()} KRW`;
  });
}

function initFullMap() {
  const mapEl = document.getElementById("fullMap");
  if (!mapEl || mapEl._leaflet_id) return;
  const map = L.map('fullMap', { attributionControl: false }).setView([state.lat, state.lng], 14);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
  L.marker([state.lat, state.lng], { icon: L.divIcon({ className: 'my-loc', html: '🛰️' }) }).addTo(map);
  MOCK_STATIONS.forEach(s => {
    const lat = state.lat + (Math.random() - 0.5) * 0.02, lng = state.lng + (Math.random() - 0.5) * 0.02;
    L.circleMarker([lat, lng], { color: 'var(--hud-accent)', radius: 8, fillOpacity: 0.8 }).addTo(map).bindPopup(`${s.name}: ${s.price}W`);
  });
}

document.addEventListener("DOMContentLoaded", autonomousInit);
