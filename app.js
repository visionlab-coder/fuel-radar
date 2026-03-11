const els = {
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
  writePostBtn: document.getElementById("writePostBtn")
};

const urlParams = new URLSearchParams(window.location.search);
const DEMO_MODE = true; // Always enable demo for best visual experience in this stage

const state = {
  lat: 36.625, // Default near Cheongju area
  lng: 127.478,
  refreshing: false,
  radarAngle: 0,
  stations: [],
  radarStations: [],
  animationId: null,
  activeTab: "home",
  filters: {
    wash: false,
    mart: false,
    repair: false
  },
  forumPosts: [
    { user: "USER_7821", content: "모충동 GS주유소 세차장 시설 진짜 좋네요! 가격도 저렴합니다." },
    { user: "FUEL_KING_99", content: "오늘 경유 가격 전체적으로 10원 정도 오른 것 같아요. 참고하세요." },
    { user: "ANTIGRAVITY", content: "실시간 유가 센터 V6.0 가동 중입니다. 이상 가격은 즉시 제보 바랍니다." }
  ]
};

/* --- HiDPI Canvas Radar V6 (Ultra-Sharp & Noise-Free) --- */
function setupRadar() {
  if (!els.radarCanvas) return;
  const ctx = els.radarCanvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const size = 800; // Intrinsic resolution

  els.radarCanvas.width = size * dpr;
  els.radarCanvas.height = size * dpr;
  ctx.scale(dpr, dpr);

  function draw() {
    // Clear with tactical trail effect
    ctx.fillStyle = "rgba(0, 5, 0, 0.2)";
    ctx.fillRect(0, 0, size, size);

    const cx = size / 2;
    const cy = size / 2;
    const r = size / 2 - 60;

    // 1. Grid Rings
    ctx.strokeStyle = "rgba(34, 211, 238, 0.12)";
    ctx.lineWidth = 1;
    [0.2, 0.4, 0.6, 0.8, 1].forEach(m => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * m, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 2. Crosshair (Tactical Lines)
    ctx.beginPath();
    ctx.strokeStyle = "rgba(34, 211, 238, 0.2)";
    ctx.moveTo(cx - r - 20, cy); ctx.lineTo(cx + r + 20, cy);
    ctx.moveTo(cx, cy - r - 20); ctx.lineTo(cx, cy + r + 20);
    ctx.stroke();

    // 3. Scan Sweep Gradient
    const sweepWidth = 0.5;
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, "rgba(34, 211, 238, 0)");
    grad.addColorStop(1, "rgba(34, 211, 238, 0.15)");

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, state.radarAngle - sweepWidth, state.radarAngle);
    ctx.lineTo(cx, cy);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

    // Main Sweep Line
    ctx.beginPath();
    ctx.strokeStyle = "rgba(34, 211, 238, 1)";
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10; ctx.shadowColor = "var(--hud-accent)";
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.cos(state.radarAngle) * r, cy + Math.sin(state.radarAngle) * r);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 4. Targets (Noise-Free Logic)
    state.radarStations.forEach(s => {
      const distRatio = Math.min(s.dist / 5, 1);
      const targetR = distRatio * r;
      const targetRad = s.deg * (Math.PI / 180);

      const tx = cx + Math.cos(targetRad) * targetR;
      const ty = cy + Math.sin(targetRad) * targetR;

      // Scanning Logic: Target only lights up when sweep passes
      let diff = (state.radarAngle % (Math.PI * 2)) - targetRad;
      if (diff < -Math.PI) diff += Math.PI * 2;
      if (diff > Math.PI) diff -= Math.PI * 2;

      let alpha = 0; // Default invisible (No noise)
      if (diff > 0 && diff < 0.6) {
        alpha = (0.6 - diff) / 0.6; // Fade out effect as sweep passes
      }

      if (alpha > 0) {
        const color = s.price > 1850 ? `rgba(248, 113, 113, ${alpha})` : `rgba(34, 211, 238, ${alpha})`;

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(tx, ty, 10, 0, Math.PI * 2);
        ctx.fill();

        // Target HUD Label
        if (alpha > 0.7) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(tx, ty);
          ctx.lineTo(tx + 20, ty - 20);
          ctx.lineTo(tx + 60, ty - 20);
          ctx.stroke();

          ctx.fillStyle = color;
          ctx.font = "bold 18px var(--font-mono)";
          ctx.fillText(`ID_${s.id}: ${s.price}W`, tx + 25, ty - 25);
        }
      }
    });

    state.radarAngle += 0.04; // Slightly faster sweep
    state.animationId = requestAnimationFrame(draw);
  }
  if (state.animationId) cancelAnimationFrame(state.animationId);
  draw();
}

/* --- UI Rendering Functions --- */
function updateForum() {
  if (!els.forumList) return;
  els.forumList.innerHTML = state.forumPosts.map(p => `
    <div class="forum-card">
      <span class="forum-user">@${p.user}</span>
      <p class="forum-content">${p.content}</p>
    </div>
  `).join("");
}

function renderHUD(stations) {
  // Apply filtering logic
  let filtered = stations.filter(s => {
    if (state.filters.wash && !s.hasWash) return false;
    if (state.filters.mart && !s.hasMart) return false;
    return true;
  });

  state.stations = filtered.sort((a, b) => a.price - b.price);

  // Assign PERSISTENT degrees if not already set (Fixes noise/jumping)
  state.radarStations = state.stations.map((s, i) => {
    const existing = state.radarStations.find(rs => rs.name === s.name);
    return {
      id: i + 1,
      dist: s.distance,
      deg: existing ? existing.deg : Math.floor(Math.random() * 360),
      price: s.price,
      name: s.name
    };
  });

  els.targetCount.textContent = `${state.stations.length} UNITS`;

  // Tactical Station List
  els.stationList.innerHTML = state.stations.slice(0, 8).map((s, i) => `
    <div class="hud-item ${i === 0 ? 'cheapest' : ''}">
      <div class="st-info">
        <span class="st-rank">RANK_#${i + 1}</span>
        <span class="st-name">${s.name}</span>
        <div class="price-progress">
          <div class="progress-bar" style="width: ${Math.max(20, 100 - (s.price - 1500) / 5)}%"></div>
        </div>
        <span class="st-detail">${s.price.toLocaleString()} KRW</span>
        <div style="font-size:0.7rem; color:#94a3b8; font-family:var(--font-mono); margin-top:4px;">
          DIST: ${s.distance.toFixed(1)}KM | ${s.hasWash ? '🧼' : ''} ${s.hasMart ? '🏪' : ''}
        </div>
      </div>
      <button class="hud-btn-icon" onclick="alert('TARGET_LOCKED: ${s.name}')">LOCK</button>
    </div>
  `).join("");

  // Trend List
  const trendData = [
    { d: "03-11", v: "+4.28" }, { d: "03-10", v: "+7.35" }, { d: "03-09", v: "+5.92" }, { d: "03-08", v: "-1.22" }
  ];
  els.trendHistory.innerHTML = trendData.map(t => `
    <div class="trend-item">
      <span>${t.d}</span>
      <span style="color:${t.v.startsWith('+') ? 'var(--hud-danger)' : 'var(--hud-success)'}">${t.v} KRW</span>
    </div>
  `).join("");
}

/* --- Core Logic & API --- */
async function fetchData() {
  state.refreshing = true;
  els.radarStatus.textContent = "SYNCHRONIZING_DATA...";

  try {
    let stats;
    // Mocking real-world features like wash/mart availability
    const mockData = [
      { name: "GS칼텍스 대청주유소", price: 1777, distance: 2.5, hasWash: true, hasMart: true },
      { name: "얌채주유소", price: 1980, distance: 1.2, hasWash: false, hasMart: false },
      { name: "S-OIL 청주점", price: 1790, distance: 3.1, hasWash: true, hasMart: false },
      { name: "현대오일뱅크 모충", price: 1810, distance: 0.8, hasWash: true, hasMart: true },
      { name: "SK엔크린 산남", price: 1825, distance: 4.2, hasWash: false, hasMart: true },
      { name: "알뜰주유소 수곡", price: 1765, distance: 4.8, hasWash: false, hasMart: false }
    ];

    if (DEMO_MODE) {
      stats = { stations: mockData };
    } else {
      const fuel = els.fuelSelect.value;
      const radius = els.radiusSelect.value;
      const res = await fetch(`/api/stations?lat=${state.lat}&lng=${state.lng}&radiusKm=${radius}&fuel=${fuel}`);
      stats = await res.json();
    }
    renderHUD(stats.stations);
    els.radarStatus.textContent = "SYSTEM_SYNC_COMPLETE";
  } catch (e) {
    els.radarStatus.textContent = "COMM_LINK_ERROR_MODEOVERRIDE";
  } finally {
    state.refreshing = false;
  }
}

/* --- Initialization --- */
function init() {
  setupRadar();
  updateForum();

  // Initial Data Sync
  fetchData();

  // Event Listeners
  els.navBtns.forEach(btn => btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    els.navBtns.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    els.tabPanes.forEach(p => p.classList.toggle("active", p.id === `${tab}Tab`));
    if (tab === "map") initFullMap();
  }));

  els.filterChips.forEach(chip => chip.addEventListener("click", () => {
    const filter = chip.dataset.filter;
    state.filters[filter] = !state.filters[filter];
    chip.classList.toggle("active");
    fetchData();
  }));

  els.fuelSelect?.addEventListener("change", fetchData);
  els.radiusSelect?.addEventListener("change", fetchData);
  els.refreshBtn?.addEventListener("click", fetchData);

  els.writePostBtn?.addEventListener("click", () => {
    const content = prompt("커뮤니티에 공유할 내용을 입력하세요:");
    if (content) {
      state.forumPosts.unshift({ user: "ME_612", content });
      updateForum();
      alert("게시글이 성공적으로 등록되었습니다.");
    }
  });

  els.calcFuel?.addEventListener("input", () => {
    const val = els.calcFuel.value;
    els.resAmount.textContent = `+${(val * 450).toLocaleString()} KRW`;
  });
}

function initFullMap() {
  const mapEl = document.getElementById("fullMap");
  if (!mapEl || mapEl._leaflet_id) return;
  const map = L.map('fullMap').setView([state.lat, state.lng], 14);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
  L.marker([state.lat, state.lng]).addTo(map).bindPopup("MY_COMMAND_POST").openPopup();

  state.stations.forEach(s => {
    // Offset for mock positions
    const lat = state.lat + (Math.random() - 0.5) * 0.02;
    const lng = state.lng + (Math.random() - 0.5) * 0.02;
    L.circleMarker([lat, lng], { color: 'var(--hud-accent)', radius: 8 }).addTo(map).bindPopup(`<b>${s.name}</b><br>${s.price}W`);
  });
}

document.addEventListener("DOMContentLoaded", init);
