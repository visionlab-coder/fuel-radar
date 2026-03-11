const els = {
  locationText: document.getElementById("locationText"),
  fuelSelect: document.getElementById("fuelSelect"),
  radiusInput: document.getElementById("radiusInput"),
  stationList: document.getElementById("stationList"),
  refreshBtn: document.getElementById("refreshBtn"),
  avgPrice: document.getElementById("avgPrice"),
  priceDelta: document.getElementById("priceDelta"),
  potentialSavings: document.getElementById("potentialSavings"),
  navItems: document.querySelectorAll(".nav-item"),
  tabPanes: document.querySelectorAll(".tab-pane"),
};

const urlParams = new URLSearchParams(window.location.search);
const DEMO_MODE = urlParams.get("demo") === "1";

const state = {
  lat: null,
  lng: null,
  refreshing: false,
  lastStationsPayload: null,
  map: null,
  userMarker: null,
  stationMarkers: [],
  activeTab: "home"
};

/* --- Utilities --- */
function wonPerLiter(price) {
  if (price === null || price === undefined || Number.isNaN(price)) return "-";
  return Number(price).toLocaleString("ko-KR");
}

/* --- Map v4 Logic --- */
function initMap(lat, lng) {
  if (state.map) return;
  const mapEl = document.getElementById("miniMap");
  if (!mapEl) return;

  state.map = L.map("miniMap", {
    center: [lat, lng],
    zoom: 15,
    zoomControl: false,
    attributionControl: false
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 19
  }).addTo(state.map);

  const userIcon = L.divIcon({
    className: "",
    html: `<div style="width:14px;height:14px;background:var(--neon-magenta);border:2px solid #fff;border-radius:50%;box-shadow:0 0 10px var(--neon-magenta);"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7]
  });

  state.userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(state.map);
  setTimeout(() => state.map.invalidateSize(), 300);
}

function updateStationMarkersOnMap(stations) {
  if (!state.map) return;
  state.stationMarkers.forEach(m => state.map.removeLayer(m));
  state.stationMarkers = [];

  stations.forEach((s) => {
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return;
    const icon = L.divIcon({
      className: "",
      html: `<div style="width:10px;height:10px;background:var(--neon-cyan);border:2px solid #fff;border-radius:50%;box-shadow:0 0 8px var(--neon-cyan);"></div>`,
      iconSize: [10, 10],
      iconAnchor: [5, 5]
    });
    const marker = L.marker([s.lat, s.lng], { icon }).addTo(state.map);
    state.stationMarkers.push(marker);
  });
}

/* --- High-End Rendering (v4) --- */
function renderStations(stations) {
  const displayStations = Array.isArray(stations) ? [...stations].sort((a, b) => a.price - b.price).slice(0, 5) : [];
  els.stationList.innerHTML = "";

  if (displayStations.length === 0) {
    els.stationList.innerHTML = `<div style="text-align:center; padding:2rem; opacity:0.5;">검색된 주유소가 없습니다.</div>`;
    return;
  }

  els.stationList.innerHTML = displayStations.map((s, idx) => `
    <div class="v4-item" style="animation: fadeUp 0.5s ${idx * 0.1}s backwards">
      <div class="st-left">
        <div class="st-logo-v4">${getBrandEmoji(s.brand)}</div>
        <div class="st-meta">
          <span class="st-name-v4">${s.name}</span>
          <span class="st-price-row">${els.fuelSelect.value === 'diesel' ? '디젤' : '휘발유'}: <span class="st-price-v4">${Number(s.price).toLocaleString()}원</span> | ${s.distance.toFixed(1)}km</span>
        </div>
      </div>
      <button class="v4-btn" onclick="window.miniMap.setView([${s.lat}, ${s.lng}], 16)">지도보기</button>
    </div>
  `).join("");

  updateStationMarkersOnMap(displayStations);
}

function getBrandEmoji(brand) {
  if (brand?.includes("SK")) return "🔴";
  if (brand?.includes("GS")) return "🔵";
  if (brand?.includes("S-OIL")) return "🟡";
  if (brand?.includes("현대")) return "⚪";
  return "⛽";
}

function renderStats(stationsPayload, trendPayload) {
  const cheapest = stationsPayload?.cheapest;
  const delta = trendPayload?.delta || -15;

  if (cheapest) {
    els.avgPrice.textContent = Number(cheapest.price).toLocaleString();
  }

  els.priceDelta.textContent = delta < 0 ? `지난주 대비 ${Math.abs(delta)}원 하락 📉` : `지난주 대비 ${delta}원 상승 📈`;
  els.priceDelta.style.color = delta < 0 ? "#4ade80" : "#fb7185";

  const savings = Math.abs(delta) * 120 || 18500;
  els.potentialSavings.textContent = Math.round(savings).toLocaleString();
}

/* --- Navigation --- */
function initNav() {
  els.navItems.forEach(item => {
    item.addEventListener("click", () => {
      const tab = item.getAttribute("data-tab");
      state.activeTab = tab;

      // Update UI
      els.navItems.forEach(btn => btn.classList.remove("active"));
      item.classList.add("active");

      els.tabPanes.forEach(pane => {
        pane.classList.remove("active");
        if (pane.id === `${tab}Tab`) pane.classList.add("active");
      });

      if (tab === "home" && state.map) {
        setTimeout(() => state.map.invalidateSize(), 100);
      }
    });
  });
}

/* --- Data Logic --- */
async function fetchData() {
  if (state.refreshing) return;
  if (!state.lat) return;

  state.refreshing = true;
  const fuel = els.fuelSelect.value;
  const radiusKm = Number(els.radiusInput.value);

  try {
    let stationsPayload;
    let trendPayload;

    if (DEMO_MODE) {
      stationsPayload = {
        cheapest: { price: 1648 },
        stations: [
          { name: "GS칼텍스 대치동점", price: 1648, distance: 1.2, lat: state.lat + 0.003, lng: state.lng + 0.002, brand: "GS" },
          { name: "SK에너지 논현점", price: 1655, distance: 0.8, lat: state.lat - 0.002, lng: state.lng + 0.004, brand: "SK" },
          { name: "S-OIL 역삼점", price: 1662, distance: 2.1, lat: state.lat + 0.005, lng: state.lng - 0.003, brand: "S-OIL" }
        ]
      };
      trendPayload = { delta: -25 };
    } else {
      const nonce = Date.now();
      const [res1, res2] = await Promise.all([
        fetch(`/api/stations?lat=${state.lat}&lng=${state.lng}&radiusKm=${radiusKm}&fuel=${fuel}&_t=${nonce}`),
        fetch(`/api/trend?fuel=${fuel}&days=14&_t=${nonce}`)
      ]);
      stationsPayload = await res1.json();
      trendPayload = await res2.json();
    }

    renderStations(stationsPayload.stations);
    renderStats(stationsPayload, trendPayload);
    initMap(state.lat, state.lng);
  } catch (err) {
    console.error(err);
  } finally {
    state.refreshing = false;
  }
}

/* --- Init --- */
async function init() {
  initNav();

  els.fuelSelect.addEventListener("change", fetchData);
  els.radiusInput.addEventListener("change", fetchData);
  els.refreshBtn.addEventListener("click", fetchData);

  if ("geolocation" in navigator) {
    navigator.geolocation.getCurrentPosition(async (pos) => {
      state.lat = pos.coords.latitude;
      state.lng = pos.coords.longitude;
      els.locationText.textContent = "현 위치 완벽 매칭";
      await fetchData();
    }, () => {
      if (DEMO_MODE) {
        state.lat = 37.5665; state.lng = 126.978;
        els.locationText.textContent = "서울 시청 (데모)";
        fetchData();
      }
    });
  }
}

init();
