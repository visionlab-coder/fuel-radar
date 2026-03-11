const els = {
  locationText: document.getElementById("locationText"),
  fuelSelect: document.getElementById("fuelSelect"),
  radiusInput: document.getElementById("radiusInput"),
  autoRefresh: document.getElementById("autoRefresh"),
  radarStatus: document.getElementById("radarStatus"),
  radarBlips: document.getElementById("radarBlips"),
  avgPrice: document.getElementById("avgPrice"),
  priceDelta: document.getElementById("priceDelta"),
  potentialSavings: document.getElementById("potentialSavings"),
  stationList: document.getElementById("stationList"),
  loadMoreBtn: document.getElementById("loadMoreBtn"),
  shareBtn: document.getElementById("shareBtn"),
  mapStatus: document.getElementById("mapStatus"),
};

const urlParams = new URLSearchParams(window.location.search);
const DEMO_MODE = urlParams.get("demo") === "1";

const state = {
  lat: null,
  lng: null,
  timerId: null,
  refreshing: false,
  isExpanded: false,
  lastStationsPayload: null,
  lastTrendPayload: null,
  map: null,
  userMarker: null,
  stationMarkers: []
};

/* --- Utilities --- */
function wonPerLiter(price) {
  if (price === null || price === undefined || Number.isNaN(price)) return "-";
  return Number(price).toLocaleString("ko-KR");
}

/* --- Realtime Map Logic --- */
function initMap(lat, lng) {
  if (state.map) return;
  const mapEl = document.getElementById("miniMap");
  if (!mapEl) return;

  state.map = L.map("miniMap", {
    center: [lat, lng],
    zoom: 14,
    zoomControl: false, // 터치 중심 UX를 위해 숨김
    attributionControl: false
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; CartoDB",
    subdomains: "abcd",
    maxZoom: 19
  }).addTo(state.map);

  const userIcon = L.divIcon({
    className: "",
    html: `<div class="pulse-dot" style="width:16px;height:16px;background:var(--neon-cyan);border:2px solid #fff;border-radius:50%;box-shadow:0 0 15px var(--neon-cyan);"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  });

  state.userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(state.map);
  setTimeout(() => state.map.invalidateSize(), 300);
}

function updateUserMarkerOnMap(lat, lng) {
  if (!state.map || !state.userMarker) return;
  state.userMarker.setLatLng([lat, lng]);
  state.map.setView([lat, lng], state.map.getZoom(), { animate: true, duration: 0.5 });
}

function updateStationMarkersOnMap(stations) {
  if (!state.map) return;
  state.stationMarkers.forEach(m => state.map.removeLayer(m));
  state.stationMarkers = [];

  stations.forEach((s, idx) => {
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return;
    const isTop = idx === 0;
    const icon = L.divIcon({
      className: "",
      html: `
        <div style="
          background: ${isTop ? "var(--neon-magenta)" : "var(--panel)"};
          color: #fff;
          padding: 4px 10px;
          border: 1px solid ${isTop ? "#fff" : "var(--neon-cyan)"};
          border-radius: 8px;
          font-weight: 900;
          font-size: 11px;
          box-shadow: 0 4px 12px ${isTop ? "rgba(244,114,182,0.5)" : "rgba(34,211,238,0.3)"};
          white-space: nowrap;
          transform: translate(-50%, -130%);
        ">${wonPerLiter(s.price)}</div>`,
      iconAnchor: [0, 0]
    });
    const marker = L.marker([s.lat, s.lng], { icon }).addTo(state.map);
    marker.bindPopup(`<strong>${s.name}</strong><br>${wonPerLiter(s.price)}원`);
    state.stationMarkers.push(marker);
  });
}

/* --- Premium Rendering Logic --- */
function renderStations(stations) {
  const displayStations = Array.isArray(stations) ? [...stations].sort((a, b) => a.price - b.price) : [];
  els.stationList.innerHTML = "";

  if (displayStations.length === 0) {
    els.stationList.innerHTML = `<div style="text-align:center; padding:3rem; opacity:0.5; font-weight:700;">주변에 탐지된 주유소가 없습니다.</div>`;
    els.loadMoreBtn.classList.add("hidden");
    updateStationMarkersOnMap([]);
    return;
  }

  const visibleStations = state.isExpanded ? displayStations : displayStations.slice(0, 5);

  els.stationList.innerHTML = visibleStations.map((s, idx) => `
    <div class="station-item" onclick="window.miniMap.setView([${s.lat}, ${s.lng}], 16)" style="animation-delay: ${idx * 0.1}s">
      <div class="station-info">
        <span class="st-brand">${s.brand || "기타"}</span>
        <span class="st-name">${s.name}</span>
        <span class="st-addr">${s.address || "주소 정보 확인 중..."}</span>
      </div>
      <div class="station-price-area">
        <span class="st-price">${Number(s.price).toLocaleString()}</span>
        <span class="st-dist">${s.distance ? s.distance.toFixed(1) + "km" : ""}</span>
      </div>
    </div>
  `).join("");

  if (displayStations.length > 5 && !state.isExpanded) {
    els.loadMoreBtn.classList.remove("hidden");
  } else {
    els.loadMoreBtn.classList.add("hidden");
  }

  renderRadarBlips(displayStations, Number(els.radiusInput.value));
  setRadarState(`반경 ${els.radiusInput.value}km 내 ${displayStations.length}개 탐미 완료`, true);
  updateStationMarkersOnMap(visibleStations);
}

function renderStats(stationsPayload, trendPayload) {
  const cheapest = stationsPayload?.cheapest;
  const delta = trendPayload?.delta || 0;

  if (cheapest) {
    els.avgPrice.textContent = Number(cheapest.price).toLocaleString();
    const fuelLabel = els.fuelSelect.value === "diesel" ? "경유" : "휘발유";
    const labelEl = document.querySelector(".stat-label");
    if (labelEl) labelEl.textContent = `실시간 추천 ${fuelLabel}`;
  }

  const deltaText = delta === 0 ? "가격 보합" : delta > 0 ? `▲ ${delta}원 급등` : `▼ ${Math.abs(delta)}원 하락`;
  els.priceDelta.textContent = deltaText;
  els.priceDelta.style.color = delta > 0 ? "var(--danger)" : "var(--success)";

  // 초프리미엄 감성의 절약액 계산 (매달 1500km 주행, 연비 12km/L 가정 시 리터당 delta만큼의 차이)
  const monthlyLiters = 125; // 1500 / 12
  const savings = Math.max(5000, Math.abs(delta) * monthlyLiters);
  els.potentialSavings.textContent = Math.round(savings).toLocaleString();
}

function renderRadarBlips(stations, radiusKm) {
  if (!els.radarBlips) return;
  els.radarBlips.innerHTML = "";
  stations.slice(0, 12).forEach((s, i) => {
    const angle = i * (360 / Math.min(stations.length, 12)) + Math.random() * 20;
    const distFactor = Math.min(0.9, (s.distance / radiusKm) * 0.8 + 0.1);
    const distPx = distFactor * 110;

    const blip = document.createElement("div");
    blip.className = "radar-blip";
    blip.style.position = "absolute";
    blip.style.width = "6px";
    blip.style.height = "6px";
    blip.style.background = "var(--neon-cyan)";
    blip.style.borderRadius = "50%";
    blip.style.boxShadow = "0 0 10px var(--neon-cyan)";
    blip.style.left = `calc(50% + ${Math.cos(angle * Math.PI / 180) * distPx}px)`;
    blip.style.top = `calc(50% + ${Math.sin(angle * Math.PI / 180) * distPx}px)`;
    blip.style.animation = `pulse 2s infinite ${Math.random() * 2}s`;

    els.radarBlips.appendChild(blip);
  });
}

function setRadarState(text, active) {
  if (els.radarStatus) {
    els.radarStatus.textContent = text;
    els.radarStatus.style.opacity = active ? "1" : "0.5";
  }
}

/* --- Data Fetching --- */
async function fetchData(manual = false) {
  if (state.refreshing) return;
  if (!state.lat || !state.lng) return;

  state.refreshing = true;
  setRadarState("Deep Scanning...", true);

  const fuel = els.fuelSelect.value;
  const radiusKm = Number(els.radiusInput.value);
  const nonce = Date.now();

  try {
    let stationsPayload;
    let trendPayload;

    if (DEMO_MODE) {
      // Premium Demo Data
      stationsPayload = {
        cheapest: { name: "강남 프리미엄 주유소", price: 1542, distance: 0.7, lat: state.lat + 0.004, lng: state.lng + 0.003, brand: "SK" },
        stations: [
          { name: "강남 프리미엄 주유소", price: 1542, distance: 0.7, lat: state.lat + 0.004, lng: state.lng + 0.003, brand: "SK", address: "서울 강남구 테헤란로 123" },
          { name: "네온 오일뱅크", price: 1568, distance: 1.1, lat: state.lat - 0.005, lng: state.lng + 0.006, brand: "GS", address: "서울 강남구 역삼동 456" },
          { name: "사이버 에스오일", price: 1585, distance: 2.3, lat: state.lat + 0.011, lng: state.lng - 0.004, brand: "S-OIL", address: "서울 서초구 서초대로 789" },
          { name: "미래형 주유소", price: 1610, distance: 3.5, lat: state.lat - 0.015, lng: state.lng - 0.012, brand: "현대", address: "서울 강남구 도곡로 321" },
          { name: "졸졸졸 스테이션", price: 1625, distance: 4.8, lat: state.lat + 0.02, lng: state.lng + 0.015, brand: "기타", address: "서울 강남구 압구정로 654" }
        ]
      };
      trendPayload = { delta: -22, deltaPct: -1.4 };
    } else {
      const [res1, res2] = await Promise.all([
        fetch(`/api/stations?lat=${state.lat}&lng=${state.lng}&radiusKm=${radiusKm}&fuel=${fuel}&_t=${nonce}`),
        fetch(`/api/trend?fuel=${fuel}&days=14&_t=${nonce}`)
      ]);
      stationsPayload = await res1.json();
      trendPayload = await res2.json();
    }

    state.lastStationsPayload = stationsPayload;
    state.lastTrendPayload = trendPayload;

    renderStations(stationsPayload.stations);
    renderStats(stationsPayload, trendPayload);
    initMap(state.lat, state.lng);
  } catch (err) {
    console.error(err);
    setRadarState("통신 환경이 불안정합니다.", false);
  } finally {
    state.refreshing = false;
  }
}

function resetAutoRefresh() {
  if (state.timerId) clearInterval(state.timerId);
  if (els.autoRefresh.checked) {
    state.timerId = setInterval(() => fetchData(false), 60000);
  }
}

/* --- Initialization --- */
async function init() {
  window.miniMap = null; // Leaflet 접근용 전역 노출 가능성 대비

  els.fuelSelect.addEventListener("change", () => {
    state.isExpanded = false;
    fetchData(true);
  });

  els.radiusInput.addEventListener("change", () => {
    state.isExpanded = false;
    fetchData(true);
  });

  els.autoRefresh.addEventListener("change", resetAutoRefresh);

  els.loadMoreBtn.addEventListener("click", () => {
    state.isExpanded = true;
    renderStations(state.lastStationsPayload?.stations);
  });

  els.shareBtn.addEventListener("click", async () => {
    const text = `[기름따라 졸졸졸] 초정밀 유가 분석 결과\n⛽ 현재 최저가: ${els.avgPrice.textContent}원\n💎 예상 절약: ${els.potentialSavings.textContent}원\n지금 바로 지도를 확인하세요!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "기름따라 졸졸졸", text });
      } catch (e) { console.log("Share cancelled"); }
    } else {
      alert("공유 문구가 복사되었습니다:\n\n" + text);
    }
  });

  // Geolocation Logic
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      state.lat = Number(pos.coords.latitude.toFixed(6));
      state.lng = Number(pos.coords.longitude.toFixed(6));
      els.locationText.textContent = "GPS Connected";
      await fetchData(true);

      navigator.geolocation.watchPosition((p) => {
        state.lat = Number(p.coords.latitude.toFixed(6));
        state.lng = Number(p.coords.longitude.toFixed(6));
        updateUserMarkerOnMap(state.lat, state.lng);
      }, null, { enableHighAccuracy: true });
    }, () => {
      if (DEMO_MODE) {
        state.lat = 37.5665;
        state.lng = 126.978;
        els.locationText.textContent = "Demo Mode: Seoul";
        fetchData(true);
      } else {
        els.locationText.textContent = "Waiting for GPS...";
        setRadarState("위치 권한을 허용해 주세요.", false);
      }
    });
  }
}

init();
