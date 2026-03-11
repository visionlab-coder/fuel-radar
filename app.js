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

/* 유틸리티 */
function wonPerLiter(price) {
  if (price === null || price === undefined || Number.isNaN(price)) return "-";
  return Number(price).toLocaleString("ko-KR");
}

/* 실시간 미니맵 */
function initMap(lat, lng) {
  if (state.map) return;
  const mapEl = document.getElementById("miniMap");
  if (!mapEl) return;

  state.map = L.map("miniMap", {
    center: [lat, lng],
    zoom: 14,
    zoomControl: true,
    attributionControl: false
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: "&copy; CartoDB",
    subdomains: "abcd",
    maxZoom: 19
  }).addTo(state.map);

  const userIcon = L.divIcon({
    className: "",
    html: `<div style="width:20px;height:20px;background:var(--neon-cyan);border:3px solid #fff;border-radius:50%;box-shadow:0 0 15px var(--neon-cyan);"></div>`,
    iconSize: [20, 20],
    iconAnchor: [10, 10]
  });

  state.userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(state.map);
  setTimeout(() => state.map.invalidateSize(), 200);
  if (els.mapStatus) els.mapStatus.textContent = "LIVE";
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
          padding: 4px 8px;
          border: 1px solid ${isTop ? "#fff" : "var(--neon-cyan)"};
          border-radius: 6px;
          font-weight: 800;
          font-size: 11px;
          box-shadow: 0 0 10px ${isTop ? "rgba(255,0,255,0.5)" : "rgba(0,243,255,0.3)"};
          white-space: nowrap;
          transform: translate(-50%, -120%);
        ">${wonPerLiter(s.price)}</div>`,
      iconAnchor: [0, 0]
    });
    const marker = L.marker([s.lat, s.lng], { icon }).addTo(state.map);
    marker.bindPopup(`<strong>${s.name}</strong><br>${wonPerLiter(s.price)}원/L`);
    state.stationMarkers.push(marker);
  });
}

/* 렌더링 로직 */
function renderStations(stations) {
  const displayStations = Array.isArray(stations) ? [...stations].sort((a, b) => a.price - b.price) : [];
  els.stationList.innerHTML = "";

  if (displayStations.length === 0) {
    els.stationList.innerHTML = `<div style="text-align:center; padding:2rem; grid-column:1/-1; opacity:0.6;">주변 주유소 정보를 찾을 수 없습니다.</div>`;
    els.loadMoreBtn.classList.add("hidden");
    updateStationMarkersOnMap([]);
    return;
  }

  const visibleStations = state.isExpanded ? displayStations : displayStations.slice(0, 5);
  els.stationList.innerHTML = visibleStations.map((s, idx) => `
    <div class="station-item" onclick="window.miniMap.setView([${s.lat}, ${s.lng}], 16)" style="animation-delay: ${idx * 0.05}s">
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
  } else if (state.isExpanded) {
    els.loadMoreBtn.classList.add("hidden");
  } else {
    els.loadMoreBtn.classList.add("hidden");
  }

  renderRadarBlips(displayStations, Number(els.radiusInput.value));
  setRadarState(`반경 ${els.radiusInput.value}km 내 ${displayStations.length}개 탐지`, true);
  updateStationMarkersOnMap(visibleStations);
}

function renderStats(stationsPayload, trendPayload) {
  const cheapest = stationsPayload?.cheapest;
  const delta = trendPayload?.delta || 0;

  if (cheapest) {
    els.avgPrice.textContent = Number(cheapest.price).toLocaleString();
    const fuelLabel = els.fuelSelect.value === "diesel" ? "경유" : "휘발유";
    const labelEl = document.querySelector(".stat-label");
    if (labelEl) labelEl.textContent = `${fuelLabel} 최저가`;
  }

  const deltaText = delta === 0 ? "보합" : delta > 0 ? `▲ ${delta}원` : `▼ ${Math.abs(delta)}원`;
  els.priceDelta.textContent = deltaText;
  els.priceDelta.style.color = delta > 0 ? "var(--danger)" : "var(--success)";

  const savings = Math.abs(delta) * 10 * 30 || 15400;
  els.potentialSavings.textContent = savings.toLocaleString();
}

function renderRadarBlips(stations, radiusKm) {
  if (!els.radarBlips) return;
  els.radarBlips.innerHTML = "";
  stations.slice(0, 15).forEach(s => {
    const angle = Math.random() * 360;
    const distFactor = Math.min(1, s.distance / radiusKm);
    const distPx = distFactor * 100; // 레이더 중심에서 100px이 최대
    const blip = document.createElement("div");
    blip.className = "radar-blip";
    blip.style.left = `calc(50% + ${Math.cos(angle) * distPx}px)`;
    blip.style.top = `calc(50% + ${Math.sin(angle) * distPx}px)`;
    els.radarBlips.appendChild(blip);
  });
}

function setRadarState(text, active) {
  if (els.radarStatus) {
    els.radarStatus.textContent = text;
    els.radarStatus.style.opacity = active ? "1" : "0.5";
  }
}

/* 데이터 호출 */
async function fetchData(manual = false) {
  if (state.refreshing) return;
  if (!state.lat || !state.lng) return;

  state.refreshing = true;
  setRadarState("실시간 스캔 중...", true);

  const fuel = els.fuelSelect.value;
  const radiusKm = Number(els.radiusInput.value);
  const nonce = Date.now();

  try {
    let stationsPayload;
    let trendPayload;

    if (DEMO_MODE) {
      stationsPayload = {
        updatedAt: new Date().toISOString(),
        fuel,
        radiusKm,
        total: 5,
        cheapest: { name: "강남 최저가 주유소", price: 1540, distance: 0.8, lat: state.lat + 0.005, lng: state.lng + 0.005, brand: "SK" },
        stations: [
          { name: "강남 최저가 주유소", price: 1540, distance: 0.8, lat: state.lat + 0.005, lng: state.lng + 0.005, brand: "SK", address: "서울 강남구 테헤란로 123" },
          { name: "역삼 오일스테이션", price: 1565, distance: 1.2, lat: state.lat - 0.004, lng: state.lng + 0.008, brand: "GS", address: "서울 강남구 역삼로 456" },
          { name: "서초 하이웨이", price: 1590, distance: 2.5, lat: state.lat + 0.012, lng: state.lng - 0.003, brand: "S-OIL", address: "서울 서초구 반포로 789" }
        ]
      };
      trendPayload = { delta: -15, deltaPct: -1.2, compareDays: 14 };
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
    setRadarState("데이터 요청 실패", false);
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

/* 초기화 */
async function init() {
  // 이벤트 리스너
  els.fuelSelect.addEventListener("change", () => fetchData(true));
  els.radiusInput.addEventListener("change", () => fetchData(true));
  els.autoRefresh.addEventListener("change", resetAutoRefresh);

  els.loadMoreBtn.addEventListener("click", () => {
    state.isExpanded = true;
    renderStations(state.lastStationsPayload?.stations);
  });

  els.shareBtn.addEventListener("click", async () => {
    const text = `[기름따라 졸졸졸] 오늘의 절약 정보\n최저가: ${els.avgPrice.textContent}원\n예상 절약액: ${els.potentialSavings.textContent}원\n지금 바로 지도를 확인하세요!`;
    if (navigator.share) {
      await navigator.share({ title: "기름따라 졸졸졸", text });
    } else {
      alert("공유 기능이 지원되지 않는 브라우저입니다.\n\n" + text);
    }
  });

  // 위치 추적
  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      state.lat = Number(pos.coords.latitude.toFixed(6));
      state.lng = Number(pos.coords.longitude.toFixed(6));
      els.locationText.textContent = "현재 위치 동기화 완료";
      await fetchData(true);

      navigator.geolocation.watchPosition((p) => {
        state.lat = Number(p.coords.latitude.toFixed(6));
        state.lng = Number(p.coords.longitude.toFixed(6));
        updateUserMarkerOnMap(state.lat, state.lng);
      });
    }, () => {
      if (DEMO_MODE) {
        state.lat = 37.5665;
        state.lng = 126.978;
        els.locationText.textContent = "데모 활성: 서울 시청";
        fetchData(true);
      } else {
        els.locationText.textContent = "위치 권한 대기 중...";
        setRadarState("위치 권한 허용이 필요합니다.", false);
      }
    });
  }
}

init();
