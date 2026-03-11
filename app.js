const els = {
  locationText: document.getElementById("locationText"),
  fuelSelect: document.getElementById("fuelSelect"),
  radiusInput: document.getElementById("radiusInput"),
  stationList: document.getElementById("stationList"),
  refreshBtn: document.getElementById("refreshBtn"),
  radarStatus: document.getElementById("radarStatus"),
  navItems: document.querySelectorAll(".nav-item"),
  tabPanes: document.querySelectorAll(".tab-pane"),
  forumList: document.getElementById("forumList"),
  radarCanvas: document.getElementById("radarCanvas")
};

const urlParams = new URLSearchParams(window.location.search);
const DEMO_MODE = urlParams.get("demo") === "1";

const state = {
  lat: null,
  lng: null,
  refreshing: false,
  map: null,
  fullMap: null,
  userMarker: null,
  stationMarkers: [],
  activeTab: "home",
  radarAngle: 0,
  radarStations: [],
  animationFrameId: null
};

/* --- Utilities --- */
function wonPerLiter(price) {
  if (price === null || price === undefined || Number.isNaN(price)) return "-";
  return Number(price).toLocaleString("ko-KR");
}
function getBrandEmoji(brand) {
  if (brand?.includes("SK")) return "🔴";
  if (brand?.includes("GS")) return "🔵";
  if (brand?.includes("S-OIL")) return "🟡";
  if (brand?.includes("현대")) return "⚪";
  return "⛽";
}

/* --- Radar Canvas Engine (v4.1) --- */
function initRadar() {
  if (!els.radarCanvas) return;
  const ctx = els.radarCanvas.getContext('2d');
  const size = els.radarCanvas.width; // 160 based on HTML attributes
  const centerX = size / 2;
  const centerY = size / 2;
  const radius = size / 2 - 10;

  function draw() {
    // 잔상 효과 (배경)
    ctx.fillStyle = 'rgba(0, 5, 0, 0.15)';
    ctx.fillRect(0, 0, size, size);

    // 원형 가이드
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 255, 150, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(centerX, centerY, radius * 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(0, 255, 150, 0.1)';
    ctx.stroke();

    // 1. 레이더 스윕 라인
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
    gradient.addColorStop(0, 'rgba(0, 255, 100, 0)');
    gradient.addColorStop(1, 'rgba(0, 255, 100, 0.15)');

    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, state.radarAngle, state.radarAngle + 0.3);
    ctx.lineTo(centerX, centerY);
    ctx.fillStyle = gradient;
    ctx.fill();

    // 스윕 메인 선
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(0, 255, 150, 0.8)';
    ctx.lineWidth = 1.5;
    ctx.moveTo(centerX, centerY);
    ctx.lineTo(
      centerX + Math.cos(state.radarAngle) * radius,
      centerY + Math.sin(state.radarAngle) * radius
    );
    ctx.stroke();

    // 2. 주유소 탐지 및 점
    state.radarStations.forEach(station => {
      const rad = station.deg * (Math.PI / 180);
      const distPx = (station.dist / Number(els.radiusInput.value)) * radius * 0.8;
      // diff 계산
      let diff = (state.radarAngle % (Math.PI * 2)) - rad;
      if (diff < -Math.PI) diff += Math.PI * 2;
      if (diff > Math.PI) diff -= Math.PI * 2;

      // 탐지 하이라이트
      let alpha = 0.3;
      if (diff > 0 && diff < 0.5) alpha = 1;

      const x = centerX + Math.cos(rad) * Math.max(10, Math.min(distPx, radius - 5));
      const y = centerY + Math.sin(rad) * Math.max(10, Math.min(distPx, radius - 5));

      // 얌채(비싼곳)는 빨간색, 싼곳은 형광색
      const isExpensive = station.price > 1650;
      const color = isExpensive ? `rgba(255, 34, 34, ${alpha})` : `rgba(0, 255, 204, ${alpha})`;

      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();

      // 텍스트는 너무 작아서 생략하거나 아주 심플하게만 (알파에 따라)
      if (alpha > 0.8) {
        ctx.fillStyle = isExpensive ? "#ff2222" : "#00ffcc";
        ctx.font = "8px Arial";
        ctx.fillText(station.price, x + 5, y + 3);
      }
    });

    state.radarAngle += 0.04;
    state.animationFrameId = requestAnimationFrame(draw);
  }

  // 기존 루프 캔슬 방지
  if (state.animationFrameId) cancelAnimationFrame(state.animationFrameId);
  draw();
}

/* --- Map Logic --- */
function initMap(lat, lng) {
  if (!state.map && document.getElementById("miniMap")) {
    state.map = L.map("miniMap", { center: [lat, lng], zoom: 14, zoomControl: false, attributionControl: false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 19 }).addTo(state.map);
  }
  if (!state.fullMap && document.getElementById("fullMap")) {
    state.fullMap = L.map("fullMap", { center: [lat, lng], zoom: 14, zoomControl: true, attributionControl: false });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { subdomains: "abcd", maxZoom: 19 }).addTo(state.fullMap);
  }

  const userIcon = L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;background:var(--neon-magenta);border:2px solid #fff;border-radius:50%;box-shadow:0 0 10px var(--neon-magenta);"></div>`,
    iconSize: [14, 14], iconAnchor: [7, 7]
  });

  if (state.map && !state.userMarker) {
    state.userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(state.map);
    L.marker([lat, lng], { icon: userIcon }).addTo(state.fullMap);
  }

  setTimeout(() => { if (state.map) state.map.invalidateSize(); }, 300);
}

function updateStationMarkersOnMap(stations) {
  if (!state.map) return;
  state.stationMarkers.forEach(m => {
    state.map.removeLayer(m);
    if (state.fullMap) state.fullMap.removeLayer(m);
  });
  state.stationMarkers = [];

  stations.forEach((s) => {
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return;
    const icon = L.divIcon({
      className: "",
      html: `<div style="width:10px;height:10px;background:var(--neon-cyan);border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px var(--neon-cyan);"></div>`,
      iconSize: [10, 10], iconAnchor: [5, 5]
    });

    const m1 = L.marker([s.lat, s.lng], { icon }).addTo(state.map);
    state.stationMarkers.push(m1);

    if (state.fullMap) {
      const m2 = L.marker([s.lat, s.lng], { icon }).bindPopup(`<b>${s.name}</b><br/>${s.price}원`).addTo(state.fullMap);
      state.stationMarkers.push(m2);
    }
  });
}

/* --- Render Data --- */
function renderStations(stations) {
  const displayStations = Array.isArray(stations) ? [...stations].sort((a, b) => a.price - b.price).slice(0, 10) : [];
  els.stationList.innerHTML = "";

  if (displayStations.length === 0) {
    els.stationList.innerHTML = `<div style="text-align:center; padding:2rem; opacity:0.5;">검색된 주유소가 없습니다.</div>`;
    return;
  }

  els.stationList.innerHTML = displayStations.map((s, idx) => `
    <div class="v4-item" style="animation: fadeUp 0.5s ${Math.min(idx, 5) * 0.1}s backwards">
      <div class="st-left">
        <div class="st-logo-v4">${getBrandEmoji(s.brand)}</div>
        <div class="st-meta">
          <span class="st-name-v4">${s.name}</span>
          <span class="st-price-row">${els.fuelSelect.value === 'diesel' ? '디젤' : '휘발유'} 
            <span class="st-price-v4" style="color:${s.price > 1650 ? '#ff2222' : 'var(--neon-cyan)'}">${Number(s.price).toLocaleString()}원</span> | ${s.distance.toFixed(1)}km
          </span>
        </div>
      </div>
      <button class="v4-btn" onclick="window.miniMap.setView([${s.lat}, ${s.lng}], 16)">지도보기</button>
    </div>
  `).join("");

  updateStationMarkersOnMap(displayStations);

  // 레이더 데이터 세팅 (방향은 랜덤 부여)
  state.radarStations = displayStations.map(s => ({
    dist: s.distance,
    deg: Math.floor(Math.random() * 360),
    price: s.price,
    name: s.name
  }));
}

/* --- Community Data (Mock) --- */
function loadCommunityData() {
  if (!els.forumList) return;
  const posts = [
    { author: "주유맨", title: "어제 얌채주유소 신고건 결과", time: "10분 전", up: 12 },
    { author: "절약왕", title: "강남역 부근 진짜 싼 곳 발견!", time: "45분 전", up: 32 },
    { author: "운전병출신", title: "요즘 유가 상승세 장난아니네요", time: "2시간 전", up: 5 },
    { author: "졸졸졸", title: "공지: 신고 기능 앱 내 가이드", time: "1일 전", up: 99 }
  ];

  els.forumList.innerHTML = posts.map(p => `
    <div style="background:var(--glass-v4); border:1px solid var(--glass-border-v4); border-radius:12px; padding:1.2rem; margin:0 1rem 0.8rem;">
      <div style="display:flex; justify-content:space-between; margin-bottom:0.5rem;">
        <span style="font-weight:800; font-size:1rem;">${p.title}</span>
        <span style="color:var(--neon-cyan); font-size:0.8rem;">👍 ${p.up}</span>
      </div>
      <div style="color:var(--ink-soft); font-size:0.8rem; display:flex; justify-content:space-between;">
        <span>👤 ${p.author}</span>
        <span>${p.time}</span>
      </div>
    </div>
  `).join("");
}

/* --- Interactions --- */
function initInteractions() {
  els.navItems.forEach(item => {
    item.addEventListener("click", () => {
      const tab = item.getAttribute("data-tab");
      state.activeTab = tab;

      els.navItems.forEach(btn => btn.classList.remove("active"));
      item.classList.add("active");

      els.tabPanes.forEach(pane => {
        pane.classList.remove("active");
        if (pane.id === \`\${tab}Tab\`) pane.classList.add("active");
      });

      if (tab === "home" && state.map) {
        setTimeout(() => state.map.invalidateSize(), 100);
      }
      if (tab === "map" && state.fullMap) {
        setTimeout(() => state.fullMap.invalidateSize(), 150);
      }
    });
  });

  const reportBtn = document.getElementById("reportLink");
  if(reportBtn) reportBtn.addEventListener("click", () => alert("신문고 시스템에 연결합니다.\n(허위 정보 등록 시 불이익이 있을 수 있습니다)"));

  const trendBtn = document.getElementById("trendLink");
  if(trendBtn) trendBtn.addEventListener("click", () => alert("14일 유가 트렌드 차트는 준비 중입니다.\n이번 주 평균 유가는 지난주 대비 -15원 감소세입니다."));
}

/* --- Data Fetching --- */
async function fetchData() {
  if (state.refreshing) return;
  if (!state.lat) return;

  state.refreshing = true;
  if(els.radarStatus) els.radarStatus.textContent = "최저가 타겟 탐색 중...";
  
  const fuel = els.fuelSelect.value;
  const radiusKm = Number(els.radiusInput.value);

  try {
    let stationsPayload;

    if (DEMO_MODE) {
      stationsPayload = {
        stations: [
          { name: "GS칼텍스 대치동점", price: 1648, distance: 1.2, lat: state.lat + 0.003, lng: state.lng + 0.002, brand: "GS" },
          { name: "SK에너지 논현점", price: 1655, distance: 0.8, lat: state.lat - 0.002, lng: state.lng + 0.004, brand: "SK" },
          { name: "S-OIL 역삼점", price: 1662, distance: 2.1, lat: state.lat + 0.005, lng: state.lng - 0.003, brand: "S-OIL" },
          { name: "현대 양재직영점", price: 1720, distance: 3.5, lat: state.lat - 0.015, lng: state.lng - 0.012, brand: "현대" },
          { name: "강남 얌채주유소", price: 1980, distance: 2.8, lat: state.lat + 0.010, lng: state.lng + 0.015, brand: "기타" }
        ]
      };
    } else {
      const nonce = Date.now();
      const res = await fetch(\`/api/stations?lat=\${state.lat}&lng=\${state.lng}&radiusKm=\${radiusKm}&fuel=\${fuel}&_t=\${nonce}\`);
      stationsPayload = await res.json();
    }

    initMap(state.lat, state.lng);
    renderStations(stationsPayload.stations);
    if(els.radarStatus) els.radarStatus.textContent = \`반경 \${radiusKm}km 내 \${stationsPayload.stations.length}개 탐지 완료\`;
    
  } catch (err) {
    console.error(err);
    if(els.radarStatus) els.radarStatus.textContent = "탐색 오류";
  } finally {
    state.refreshing = false;
  }
}

/* --- Boot --- */
async function init() {
  initInteractions();
  initRadar(); // Canvas 레이더 구동 시작
  loadCommunityData();

  els.fuelSelect.addEventListener("change", fetchData);
  els.radiusInput.addEventListener("change", fetchData);
  els.refreshBtn.addEventListener("click", fetchData);

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      state.lat = pos.coords.latitude;
      state.lng = pos.coords.longitude;
      els.locationText.textContent = "고정밀 GPS 매칭";
      await fetchData();
    }, () => {
      if (DEMO_MODE) {
        state.lat = 37.5665; state.lng = 126.978;
        els.locationText.textContent = "서울 시청 (방위각 데모)";
        fetchData();
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
