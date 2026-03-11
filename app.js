const els = {
  locationText: document.getElementById("locationText"),
  fuelSelect: document.getElementById("fuelSelect"),
  compareSelect: document.getElementById("compareSelect"),
  sortModeSelect: document.getElementById("sortModeSelect"),
  radiusInput: document.getElementById("radiusInput"),
  radiusLabel: document.getElementById("radiusLabel"),
  refreshSecSelect: document.getElementById("refreshSecSelect"),
  autoRefreshCheck: document.getElementById("autoRefreshCheck"),
  refreshBtn: document.getElementById("refreshBtn"),
  radarPanel: document.getElementById("radarPanel"),
  radarStatus: document.getElementById("radarStatus"),
  radarBlips: document.getElementById("radarBlips"),
  quickReportBtn: document.getElementById("quickReportBtn"),
  locationSearchInput: document.getElementById("locationSearchInput"),
  locationSearchBtn: document.getElementById("locationSearchBtn"),
  useCurrentLocationBtn: document.getElementById("useCurrentLocationBtn"),
  locationSearchStatus: document.getElementById("locationSearchStatus"),
  trendTitle: document.getElementById("trendTitle"),
  cheapestName: document.getElementById("cheapestName"),
  cheapestPrice: document.getElementById("cheapestPrice"),
  cheapestMeta: document.getElementById("cheapestMeta"),
  trendCurrent: document.getElementById("trendCurrent"),
  trendPast: document.getElementById("trendPast"),
  trendDelta: document.getElementById("trendDelta"),
  dailyDiffList: document.getElementById("dailyDiffList"),
  fillLitersInput: document.getElementById("fillLitersInput"),
  efficiencyInput: document.getElementById("efficiencyInput"),
  smartModeText: document.getElementById("smartModeText"),
  smartBestName: document.getElementById("smartBestName"),
  smartNetSave: document.getElementById("smartNetSave"),
  smartDesc: document.getElementById("smartDesc"),
  smartBarFill: document.getElementById("smartBarFill"),
  shareHeadline: document.getElementById("shareHeadline"),
  shareBody: document.getElementById("shareBody"),
  shareCardBtn: document.getElementById("shareCardBtn"),
  shareStatusText: document.getElementById("shareStatusText"),
  surgeBadge: document.getElementById("surgeBadge"),
  surgeText: document.getElementById("surgeText"),
  communityScoreText: document.getElementById("communityScoreText"),
  listTitle: document.getElementById("listTitle"),
  listCount: document.getElementById("listCount"),
  list: document.getElementById("list"),
  statusText: document.getElementById("statusText"),
  reportStationSelect: document.getElementById("reportStationSelect"),
  reportPriceInput: document.getElementById("reportPriceInput"),
  reportMemoInput: document.getElementById("reportMemoInput"),
  reportPhotoInput: document.getElementById("reportPhotoInput"),
  reportPreview: document.getElementById("reportPreview"),
  reportSubmitBtn: document.getElementById("reportSubmitBtn"),
  sinmungoLink: document.getElementById("sinmungoLink"),
  reportDraftText: document.getElementById("reportDraftText"),
  reportStatusText: document.getElementById("reportStatusText"),
  reportPanel: document.querySelector(".report-panel"),
  showMoreContainer: document.getElementById("showMoreContainer"),
  showMoreBtn: document.getElementById("showMoreBtn")
};

const urlParams = new URLSearchParams(window.location.search);
const DEMO_MODE = urlParams.get("demo") === "1";

const state = {
  lat: null,
  lng: null,
  timerId: null,
  refreshing: false,
  lastStations: [],
  reportPhotoDataUrl: null,
  lastStationsPayload: null,
  lastTrendPayload: null,
  lastShareText: "",
  reportCount: Number(localStorage.getItem("fuelRadarReportCount") || 0),
  shareCount: Number(localStorage.getItem("fuelRadarShareCount") || 0),
  // 맵 관련 상태
  map: null,
  userMarker: null,
  stationMarkers: []
};

function wonPerLiter(price) {
  if (price === null || price === undefined || Number.isNaN(price)) return "-";
  return `${Number(price).toLocaleString("ko-KR")}원/L`;
}

/* ========= 실시간 미니맵 관련 함수 ========= */
function initMap(lat, lng) {
  if (state.map) return; // 이미 초기화될 경우
  const mapEl = document.getElementById("miniMap");
  if (!mapEl) return;

  state.map = L.map("miniMap", {
    center: [lat, lng],
    zoom: 14,
    zoomControl: true,
    attributionControl: false
  });

  // OpenStreetMap 타일 - 무료, 인증 키 불필요
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: ""
  }).addTo(state.map);

  // 내 위치 마커 (파란 폄인트)
  const userIcon = L.divIcon({
    className: "",
    html: `
      <div style="
        width: 22px; height: 22px;
        background: rgba(59, 130, 246, 0.9);
        border: 3px solid #fff;
        border-radius: 50%;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.3), 0 2px 8px rgba(0,0,0,0.4);
      "></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  state.userMarker = L.marker([lat, lng], { icon: userIcon }).addTo(state.map);
  state.userMarker.bindPopup("📍 내 현재 위치").openPopup();

  // 맵 사이즈 재조정 (판넥 크기에 맞춰)
  setTimeout(() => state.map.invalidateSize(), 200);
  if (document.getElementById("mapStatusBadge"))
    document.getElementById("mapStatusBadge").textContent = "실시간 추적 중";
}

function updateUserMarkerOnMap(lat, lng) {
  if (!state.map || !state.userMarker) return;
  state.userMarker.setLatLng([lat, lng]);
  state.map.setView([lat, lng], state.map.getZoom(), { animate: true, duration: 0.5 });
}

function updateStationMarkersOnMap(stations) {
  if (!state.map) return;
  // 기존 주유소 마커 모두 제거
  state.stationMarkers.forEach(m => state.map.removeLayer(m));
  state.stationMarkers = [];

  if (!Array.isArray(stations)) return;

  stations.forEach((s, idx) => {
    if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) return;
    const priceLabel = Number(s.price).toLocaleString("ko-KR");
    const isTop = idx === 0;
    const icon = L.divIcon({
      className: "",
      html: `
        <div style="
          background: ${isTop ? "rgba(45,212,191,0.95)" : "rgba(30,41,59,0.92)"};
          color: ${isTop ? "#000" : "#e2e8f0"};
          border: 2px solid ${isTop ? "#2dd4bf" : "rgba(255,255,255,0.2)"};
          border-radius: 8px;
          padding: 4px 8px;
          font-size: 11px;
          font-weight: 700;
          white-space: nowrap;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          font-family: Pretendard, sans-serif;
        ">${priceLabel}<br><span style="font-size:9px;opacity:.7">${s.name.length > 7 ? s.name.slice(0, 7) + "…" : s.name}</span></div>`,
      iconSize: [80, 38],
      iconAnchor: [40, 38]
    });

    const marker = L.marker([s.lat, s.lng], { icon }).addTo(state.map);
    marker.bindPopup(`
      <b>${s.name}</b><br>
      💰 ${priceLabel}원/L<br>
      📍 ${s.address || "주소 확인 중"}<br>
      🚗 ${Number.isFinite(s.distanceKm) ? s.distanceKm.toFixed(2) + "km" : "-"}
    `, { maxWidth: 220 });
    state.stationMarkers.push(marker);
  });

  // 지도를 모든 마커가 보이도록 자동 패닝
  if (state.stationMarkers.length > 0 && state.userMarker) {
    const group = L.featureGroup([state.userMarker, ...state.stationMarkers]);
    state.map.fitBounds(group.getBounds().pad(0.1));
  }
}

function setStatus(text) {
  els.statusText.textContent = text;
}

function setRadarState(text, active = true) {
  if (els.radarStatus) {
    els.radarStatus.textContent = text;
  }
  if (els.radarPanel) {
    els.radarPanel.classList.toggle("is-active", Boolean(active));
  }
}

function setLocationSearchStatus(text) {
  if (els.locationSearchStatus) {
    els.locationSearchStatus.textContent = text;
  }
}

function formatDistance(km) {
  if (!Number.isFinite(km)) return "-";
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(2)}km`;
}

function formatSignedWon(delta) {
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toLocaleString("ko-KR")}원`;
}

function hashToAngle(value) {
  const str = String(value || "radar");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = (hash * 31 + str.charCodeAt(i)) % 360;
  }
  return (hash * Math.PI) / 180;
}

function toNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getPlannerInputs() {
  const liters = clamp(toNumber(els.fillLitersInput.value, 40), 5, 120);
  const efficiency = clamp(toNumber(els.efficiencyInput.value, 12), 3, 30);
  els.fillLitersInput.value = String(liters);
  els.efficiencyInput.value = String(efficiency);
  return { liters, efficiency };
}

function getMedianPrice(stations) {
  const prices = stations
    .map((s) => Number(s.price))
    .filter((v) => Number.isFinite(v))
    .sort((a, b) => a - b);
  if (prices.length === 0) return null;
  const half = Math.floor(prices.length / 2);
  if (prices.length % 2 === 1) return prices[half];
  return (prices[half - 1] + prices[half]) / 2;
}

function enrichStations(stations, liters, efficiency) {
  const medianPrice = getMedianPrice(stations);
  const trendLatestPrice = state.lastTrendPayload?.latest?.price;

  const enriched = stations.map((s) => {
    // 1순위: 전국 평균가, 2순위: 주변 중앙값, 3순위: 자기 자신
    const baseline = Number.isFinite(trendLatestPrice)
      ? trendLatestPrice
      : (Number.isFinite(medianPrice) ? medianPrice : s.price);

    const grossSave = (baseline - s.price) * liters;
    const detourCost = ((s.distanceKm * 2) / efficiency) * s.price;
    const netSave = grossSave - detourCost;
    return {
      ...s,
      grossSave,
      detourCost,
      netSave,
      baselineUsed: baseline
    };
  });
  return { enriched, medianPrice, trendLatestPrice };
}

function renderSmartPanel(bestSmart, medianPrice, liters, efficiency, trendLatestPrice) {
  if (!bestSmart) {
    els.smartModeText.textContent = "거리+연비 반영";
    els.smartBestName.textContent = "-";
    els.smartNetSave.textContent = "-";
    els.smartDesc.textContent = "주유소 데이터가 없어요.";
    els.smartBarFill.style.width = "0%";
    return;
  }
  els.smartModeText.textContent = els.sortModeSelect.value === "smart" ? "실질절약순 활성화" : "거리+연비 반영";
  els.smartBestName.textContent = bestSmart.name;
  els.smartNetSave.textContent = `실질 ${formatSignedWon(Math.round(bestSmart.netSave))} 예상`;
  els.smartNetSave.classList.remove("up", "down");
  els.smartNetSave.classList.add(bestSmart.netSave >= 0 ? "up" : "down");

  const baselineValue = bestSmart.baselineUsed || trendLatestPrice || medianPrice;
  const baselineLabel = Number.isFinite(trendLatestPrice) ? "전국평균" : "내 주변평균";
  const baselineText = Number.isFinite(baselineValue) ? wonPerLiter(Number(baselineValue.toFixed(2))) : "-";

  els.smartDesc.textContent = `${baselineLabel} ${baselineText} 대비 · ${liters}L 주유 · 연비 ${efficiency}km/L 가정`;
  const gross = Math.max(1, Math.abs(bestSmart.grossSave));
  const fillPct = clamp((bestSmart.netSave / gross) * 100, 0, 100);
  els.smartBarFill.style.width = `${fillPct}%`;
}

function rerenderCached() {
  if (state.lastStationsPayload) {
    renderStations(state.lastStationsPayload);
  }
  if (state.lastTrendPayload) {
    renderTrend(state.lastTrendPayload);
  }
  renderGrowthPanels(state.lastStationsPayload, state.lastTrendPayload);
}

function renderRadarBlips(stations, radiusKm) {
  if (!els.radarBlips) return;
  els.radarBlips.innerHTML = "";
  const source = Array.isArray(stations) ? stations.slice(0, 12) : [];
  for (let idx = 0; idx < source.length; idx += 1) {
    const s = source[idx];
    const hasGeo =
      Number.isFinite(state.lat) && Number.isFinite(state.lng) && Number.isFinite(s.lat) && Number.isFinite(s.lng);
    const angle = hasGeo ? Math.atan2(s.lat - state.lat, s.lng - state.lng) : hashToAngle(s.id || s.name || idx);
    const ratio = clamp((s.distanceKm || 0) / Math.max(1, radiusKm || 10), 0.08, 0.95);
    const r = ratio * 42;
    const x = 50 + Math.cos(angle) * r;
    const y = 50 - Math.sin(angle) * r;
    const blip = document.createElement("span");
    blip.className = "radar-blip";
    blip.style.left = `${x}%`;
    blip.style.top = `${y}%`;
    blip.style.animationDelay = `${idx * 0.14}s`;
    els.radarBlips.appendChild(blip);
  }
}

function generateMockStations(lat, lng, radiusKm, fuel) {
  const basePrice = fuel === "diesel" ? 1892 : 1878;
  const names = [
    "한강셀프주유소",
    "스마트에너지주유소",
    "그린오일스테이션",
    "서울대로주유소",
    "강변에코주유소",
    "도심24주유소",
    "라이트오일센터",
    "파워에너지주유소"
  ];
  const stations = names.map((name, idx) => {
    const distanceKm = Number((0.6 + idx * 0.85).toFixed(2));
    const price = basePrice + idx * 7 + (idx % 2 === 0 ? 0 : 3);
    return {
      id: `demo-${idx + 1}`,
      name,
      price,
      brand: idx % 2 === 0 ? "S-OIL" : "SK",
      address: `서울시 데모구 데모로 ${idx + 10}`,
      distanceKm,
      lat: Number((lat + 0.001 * idx).toFixed(6)),
      lng: Number((lng + 0.0012 * idx).toFixed(6))
    };
  });
  return stations.filter((s) => s.distanceKm <= radiusKm + 0.05);
}

function generateMockTrend(compareDays, fuel) {
  const today = new Date();
  const base = fuel === "diesel" ? 1894 : 1880;
  const series = [];
  for (let i = 14; i >= 0; i -= 1) {
    const day = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const y = day.getFullYear();
    const m = `${day.getMonth() + 1}`.padStart(2, "0");
    const d = `${day.getDate()}`.padStart(2, "0");
    const price = Number((base + (14 - i) * 1.6 + (i % 3 === 0 ? 1.2 : 0)).toFixed(2));
    series.push({ date: `${y}-${m}-${d}`, price });
  }
  const latest = series[series.length - 1];
  const prevIndex = Math.max(0, series.length - 1 - compareDays);
  const previous = series[prevIndex];
  const delta = Number((latest.price - previous.price).toFixed(2));
  const deltaPct = previous.price > 0 ? Number((((latest.price - previous.price) / previous.price) * 100).toFixed(2)) : null;
  return {
    updatedAt: new Date().toISOString(),
    fuel,
    compareDays,
    latest,
    previous,
    series,
    delta,
    deltaPct
  };
}

function getDemoPayload(fuel, compareDays, radiusKm) {
  const lat = Number.isFinite(state.lat) ? state.lat : 37.5665;
  const lng = Number.isFinite(state.lng) ? state.lng : 126.978;
  const stations = generateMockStations(lat, lng, radiusKm, fuel).sort((a, b) => a.price - b.price);
  return {
    stationsPayload: {
      updatedAt: new Date().toISOString(),
      fuel,
      radiusKm,
      total: stations.length,
      cheapest: stations[0] || null,
      stations
    },
    trendPayload: generateMockTrend(compareDays, fuel)
  };
}

function setReportStatus(text) {
  if (els.reportStatusText) {
    els.reportStatusText.textContent = text;
  }
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("file read failed"));
    reader.readAsDataURL(file);
  });
}

function renderReportStations(stations) {
  if (!els.reportStationSelect) return;
  const list = Array.isArray(stations) ? stations : [];
  state.lastStations = list;
  els.reportStationSelect.innerHTML = "";
  if (list.length === 0) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "주유소 데이터 없음";
    els.reportStationSelect.appendChild(option);
    return;
  }
  for (const s of list.slice(0, 30)) {
    const option = document.createElement("option");
    option.value = s.id;
    option.textContent = `${s.name} · ${wonPerLiter(s.price)} · ${formatDistance(s.distanceKm)}`;
    els.reportStationSelect.appendChild(option);
  }
  const selected = list[0];
  if (selected && Number.isFinite(selected.price)) {
    els.reportPriceInput.value = Math.round(selected.price);
  }
}

function handleStationSelect() {
  const stationId = els.reportStationSelect.value;
  const station = state.lastStations.find((item) => String(item.id) === String(stationId));
  if (!station) return;
  if (Number.isFinite(station.price)) {
    els.reportPriceInput.value = Math.round(station.price);
  }
}

function openQuickReportShortcut() {
  if (els.reportPanel) {
    els.reportPanel.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const firstStation = state.lastStations[0];
  if (firstStation && Number.isFinite(firstStation.price)) {
    els.reportPriceInput.value = Math.round(firstStation.price);
  }

  if (els.reportMemoInput && !String(els.reportMemoInput.value || "").trim()) {
    els.reportMemoInput.value = "레이더에서 발견한 가격 이상 징후 신고";
  }

  setReportStatus("바로 신고할 수 있도록 준비했어요. 사진을 찍고 신고 올리기를 누르세요.");

  window.setTimeout(() => {
    if (els.reportPhotoInput) {
      els.reportPhotoInput.focus();
    } else if (els.reportMemoInput) {
      els.reportMemoInput.focus();
    }
  }, 280);
}

async function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position.coords),
      (error) => reject(error),
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 20000 }
    );
  });
}

async function applyCurrentLocation() {
  const coords = await getCurrentLocation();
  state.lat = Number(coords.latitude.toFixed(6));
  state.lng = Number(coords.longitude.toFixed(6));
  // 맵 초기화 또는 마커 업데이트
  if (!state.map) {
    initMap(state.lat, state.lng);
  } else {
    updateUserMarkerOnMap(state.lat, state.lng);
  }
  els.locationText.textContent = `현재 좌표: ${state.lat}, ${state.lng}`;
  setLocationSearchStatus("현재 위치로 이동했습니다.");
  setRadarState("현재 위치 기준으로 레이더 탐색을 시작합니다.", true);
}

async function applySearchedLocation() {
  const keyword = String(els.locationSearchInput.value || "").trim();
  if (keyword.length < 2) {
    setLocationSearchStatus("검색어를 2글자 이상 입력해 주세요.");
    return;
  }
  setLocationSearchStatus("위치를 검색 중입니다...");
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ko&q=${encodeURIComponent(keyword)}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/json"
      }
    });
    if (!response.ok) throw new Error(`geocode ${response.status}`);
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) {
      setLocationSearchStatus("검색 결과가 없어요. 다른 키워드로 시도해 주세요.");
      return;
    }
    const first = rows[0];
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      setLocationSearchStatus("검색 좌표를 읽지 못했습니다.");
      return;
    }
    state.lat = Number(lat.toFixed(6));
    state.lng = Number(lng.toFixed(6));

    // UI Feedback
    const displayName = first.display_name.split(',')[0];
    els.locationText.textContent = `📍 ${displayName}`;
    setLocationSearchStatus("✅ 위치 확인 성공. 레이더가 즉시 가동됩니다.");
    setRadarState(`스캐닝: ${displayName}`, true);
    await refresh(true);
  } catch (error) {
    console.error(error);
    setLocationSearchStatus("⚠️ 통신 오류: 네트워크 상태를 확인해 주세요.");
  }
}

function renderStations(payload) {
  const { cheapest, stations = [] } = payload || {};
  if (!cheapest) {
    els.cheapestName.textContent = "데이터 없음";
    els.cheapestPrice.textContent = "-";
    els.cheapestMeta.textContent = "조건에 맞는 주유소를 찾지 못했습니다.";
    els.listCount.textContent = "0개";
    els.list.innerHTML = "";
    renderSmartPanel(null, null, 40, 12);
    renderReportStations([]);
    renderRadarBlips([], Number(els.radiusInput.value || 10));
    setRadarState("조건에 맞는 주유소를 찾지 못했습니다.", true);
    return;
  }

  els.cheapestName.textContent = cheapest.name;
  els.cheapestPrice.textContent = wonPerLiter(cheapest.price);
  els.cheapestMeta.textContent = `${formatDistance(cheapest.distanceKm)} · ${cheapest.address || "주소 정보 없음"}`;

  const { liters, efficiency } = getPlannerInputs();
  const { enriched, medianPrice, trendLatestPrice } = enrichStations(stations, liters, efficiency);
  const bestSmart = [...enriched].sort((a, b) => b.netSave - a.netSave)[0] || null;
  renderSmartPanel(bestSmart, medianPrice, liters, efficiency, trendLatestPrice);
  renderReportStations(stations);

  const sortMode = els.sortModeSelect.value;
  els.listTitle.textContent = sortMode === "smart" ? "반경 내 실질절약순 목록" : "반경 내 가격순 목록";
  const displayStations = [...enriched].sort((a, b) => {
    if (sortMode === "smart") return b.netSave - a.netSave || a.price - b.price;
    return a.price - b.price || a.distanceKm - b.distanceKm;
  });

  els.list.innerHTML = displayStations
    .map(
      (s, idx) => `
      <div class="item ${idx === 0 ? "item-top" : ""} ${idx >= 5 ? "is-hidden" : ""}" style="animation-delay:${idx * 0.05}s;">
        <div class="rank-chip">#${idx + 1}</div>
        <div class="info">
          <strong class="neon-text">${s.name}</strong>
          <div class="small">${formatDistance(s.distanceKm)} · ${s.address || "주소 정보 없음"}</div>
        </div>
        <div class="right-info">
          <div class="price-text">${wonPerLiter(s.price)}</div>
          <div class="save-text ${s.netSave >= 0 ? "good" : "bad"}">
            ${s.netSave >= 0 ? "▼" : "▲"} ${formatSignedWon(Math.abs(Math.round(s.netSave)))}
          </div>
        </div>
      </div>
    `
    )
    .join("");

  if (displayStations.length > 5) {
    els.showMoreContainer.classList.remove("is-hidden");
    els.showMoreBtn.classList.remove("is-active");
    els.showMoreBtn.querySelector("span").textContent = "주유소 더 보기";
  } else {
    els.showMoreContainer.classList.add("is-hidden");
  }

  renderRadarBlips(stations, Number(els.radiusInput.value || 10));
  setRadarState(`반경 ${Number(els.radiusInput.value || 10)}km 내 ${displayStations.length}개 포착`, true);
  // 지도 마커 업데이트
  updateStationMarkersOnMap(displayStations);
}

function renderTrend(payload) {
  const compareDays = Number(payload?.compareDays || 14);
  els.trendTitle.textContent = `${compareDays}일 전 대비`;

  if (!payload || !payload.latest || !payload.previous) {
    els.trendCurrent.textContent = "현재: -";
    els.trendPast.textContent = "비교 기준: -";
    els.trendDelta.textContent = "비교 데이터 없음";
    els.dailyDiffList.textContent = "";
    els.trendDelta.classList.remove("up", "down");
    return;
  }

  els.trendCurrent.textContent = `현재(${payload.latest.date}): ${wonPerLiter(payload.latest.price)}`;
  els.trendPast.textContent = `${compareDays}일 전(${payload.previous.date}): ${wonPerLiter(payload.previous.price)}`;

  const delta = Number(payload.delta || 0);
  const pct = payload.deltaPct === null || payload.deltaPct === undefined ? "-" : `${payload.deltaPct}%`;
  els.trendDelta.textContent = `${formatSignedWon(delta)} (${pct})`;
  els.trendDelta.classList.remove("up", "down");
  els.trendDelta.classList.add(delta >= 0 ? "up" : "down");

  const series = Array.isArray(payload.series) ? payload.series : [];
  const diffRows = [];
  for (let i = 1; i < series.length; i += 1) {
    const prev = series[i - 1];
    const curr = series[i];
    const dayDelta = Number((curr.price - prev.price).toFixed(2));
    diffRows.push({
      label: `${prev.date} → ${curr.date}`,
      delta: dayDelta
    });
  }
  const latestRows = diffRows.slice(-5).reverse();
  els.dailyDiffList.innerHTML = "";
  if (latestRows.length === 0) {
    els.dailyDiffList.textContent = "일별 비교 데이터가 부족합니다.";
    return;
  }
  for (const row of latestRows) {
    const item = document.createElement("div");
    item.className = "mini-item";
    const left = document.createElement("span");
    left.textContent = row.label;
    const right = document.createElement("span");
    right.textContent = formatSignedWon(row.delta);
    right.className = row.delta >= 0 ? "up" : "down";
    item.appendChild(left);
    item.appendChild(right);
    els.dailyDiffList.appendChild(item);
  }
}

function setShareStatus(text) {
  if (els.shareStatusText) {
    els.shareStatusText.textContent = text;
  }
}

function renderGrowthPanels(stationsPayload, trendPayload) {
  const stations = Array.isArray(stationsPayload?.stations) ? stationsPayload.stations : [];
  const cheapest = stationsPayload?.cheapest || stations[0] || null;
  const compareDays = Number(trendPayload?.compareDays || els.compareSelect.value || 14);
  const delta = Number(trendPayload?.delta || 0);
  const pct = Number(trendPayload?.deltaPct || 0);

  if (!cheapest || !Number.isFinite(cheapest.price)) {
    els.shareHeadline.textContent = "데이터 수집 중...";
    els.shareBody.textContent = "주변 주유소 데이터가 준비되면 공유 문구를 생성합니다.";
    els.surgeBadge.textContent = "분석 대기";
    els.surgeBadge.classList.remove("up", "down");
    els.surgeText.textContent = "일별 급등폭 분석을 준비하고 있습니다.";
    els.communityScoreText.textContent = "커뮤니티 참여지수 계산 중...";
    state.lastShareText = "";
    return;
  }

  const median = getMedianPrice(stations);
  const liters = clamp(toNumber(els.fillLitersInput.value, 40), 5, 120);
  const basePrice = Number.isFinite(median) ? median : cheapest.price;
  const savedWon = Math.max(0, Math.round((basePrice - cheapest.price) * liters));

  els.shareHeadline.textContent = `오늘 예상 절약 ${savedWon.toLocaleString("ko-KR")}원`;
  els.shareBody.textContent = `${cheapest.name} 기준 ${wonPerLiter(cheapest.price)} · ${formatDistance(
    cheapest.distanceKm
  )} · ${compareDays}일 대비 ${formatSignedWon(delta)} (${pct || 0}%)`;

  const fuelLabel = els.fuelSelect.value === "diesel" ? "경유" : "휘발유";
  state.lastShareText = `[기름따라 졸졸졸] 오늘의 절약 정보\n\n📌 ${fuelLabel} 최저가: ${cheapest.name} (${wonPerLiter(cheapest.price)})\n💰 예상 절약: ${savedWon.toLocaleString("ko-KR")}원 (${liters}L 기준)\n📈 ${compareDays}일 전 대비: ${formatSignedWon(delta)}\n\n지금 바로 가장 가까운 최저가를 확인하세요!`;

  const series = Array.isArray(trendPayload?.series) ? trendPayload.series : [];
  let maxRise = null;
  for (let i = 1; i < series.length; i += 1) {
    const rise = Number((series[i].price - series[i - 1].price).toFixed(2));
    if (!Number.isFinite(rise)) continue;
    if (!maxRise || rise > maxRise.rise) {
      maxRise = { rise, label: `${series[i - 1].date}→${series[i].date}` };
    }
  }

  if (!maxRise) {
    els.surgeBadge.textContent = "데이터 부족";
    els.surgeBadge.classList.remove("up", "down");
    els.surgeText.textContent = "급등 분석에 필요한 일별 데이터가 부족합니다.";
  } else if (maxRise.rise >= 0) {
    els.surgeBadge.textContent = `급등 경보 +${maxRise.rise.toLocaleString("ko-KR")}원`;
    els.surgeBadge.classList.add("up");
    els.surgeBadge.classList.remove("down");
    els.surgeText.textContent = `${maxRise.label} 구간이 최근 최대 상승입니다. 지금 비교 구매가 유리해요.`;
  } else {
    els.surgeBadge.textContent = `안정 구간 ${maxRise.rise.toLocaleString("ko-KR")}원`;
    els.surgeBadge.classList.add("down");
    els.surgeBadge.classList.remove("up");
    els.surgeText.textContent = `${maxRise.label} 구간은 하락 흐름입니다. 알림 기준을 낮춰보세요.`;
  }

  const engagementRaw = Math.round(
    clamp(stations.length * 1.2 + state.reportCount * 18 + state.shareCount * 13 + (delta > 0 ? 8 : 0), 0, 100)
  );
  els.communityScoreText.textContent = `커뮤니티 참여지수 ${engagementRaw}점 · 신고 ${state.reportCount}건 · 공유 ${state.shareCount}회`;
}

async function shareCard() {
  if (!state.lastShareText) {
    setShareStatus("공유할 데이터가 아직 없어요. 새로고침 후 다시 시도해 주세요.");
    return;
  }
  try {
    if (navigator.share) {
      await navigator.share({
        title: "기름따라 졸졸졸 절약 정보",
        text: state.lastShareText
      });
      state.shareCount += 1;
      localStorage.setItem("fuelRadarShareCount", String(state.shareCount));
      setShareStatus("공유 완료! 주변 사람에게 절약 정보를 전송했습니다.");
      rerenderCached();
      return;
    }
    await navigator.clipboard.writeText(state.lastShareText);
    state.shareCount += 1;
    localStorage.setItem("fuelRadarShareCount", String(state.shareCount));
    setShareStatus("공유 문구를 복사했습니다. 메신저에 바로 붙여넣으세요.");
    rerenderCached();
  } catch (error) {
    console.error(error);
    setShareStatus("공유 실패: 브라우저 권한 또는 복사 기능을 확인해 주세요.");
  }
}

function resetAutoRefresh() {
  if (state.timerId) {
    clearInterval(state.timerId);
    state.timerId = null;
  }
  if (!els.autoRefreshCheck.checked) return;
  const sec = Number(els.refreshSecSelect.value) || 60;
  state.timerId = setInterval(() => {
    refresh(false);
  }, sec * 1000);
}

async function refresh(manual = false) {
  if (!Number.isFinite(state.lat) || !Number.isFinite(state.lng)) return;
  if (state.refreshing) return;
  state.refreshing = true;
  setRadarState("레이더 스캔 중...", true);
  setStatus("실시간 데이터 조회 중...");
  els.refreshBtn.disabled = true;

  const fuel = els.fuelSelect.value;
  const compareDays = Number(els.compareSelect.value) || 14;
  const radiusKm = Number(els.radiusInput.value);
  const nonce = Date.now();

  try {
    let stationsPayload;
    let trendPayload;

    if (DEMO_MODE) {
      ({ stationsPayload, trendPayload } = getDemoPayload(fuel, compareDays, radiusKm));
    } else {
      const [stationsRes, trendRes] = await Promise.all([
        fetch(`/api/stations?lat=${state.lat}&lng=${state.lng}&radiusKm=${radiusKm}&fuel=${fuel}&_t=${nonce}`),
        fetch(`/api/trend?fuel=${fuel}&days=${compareDays}&_t=${nonce}`)
      ]);
      if (!stationsRes.ok) throw new Error("stations API error");
      if (!trendRes.ok) throw new Error("trend API error");
      [stationsPayload, trendPayload] = await Promise.all([stationsRes.json(), trendRes.json()]);
    }

    state.lastStationsPayload = stationsPayload;
    state.lastTrendPayload = trendPayload;
    rerenderCached();
    const autoText = els.autoRefreshCheck.checked ? `자동갱신 ${els.refreshSecSelect.value}초` : "자동갱신 꺼짐";
    const modeText = DEMO_MODE ? "DEMO" : manual ? "수동" : "자동";
    setStatus(`업데이트 완료 · ${new Date().toLocaleTimeString("ko-KR")} · ${modeText} · ${autoText}`);
  } catch (error) {
    console.error(error);
    setRadarState("레이더 스캔 실패: 네트워크/API를 확인해 주세요.", false);
    setStatus("조회 실패: API 키/권한/네트워크를 확인해 주세요.");
  } finally {
    state.refreshing = false;
    els.refreshBtn.disabled = false;
  }
}

async function submitReport() {
  try {
    const stationId = els.reportStationSelect.value;
    const station = state.lastStations.find((item) => String(item.id) === String(stationId));
    if (!station) {
      setReportStatus("신고 대상 주유소를 선택해 주세요.");
      return;
    }
    const observedPrice = Number(els.reportPriceInput.value);
    if (!Number.isFinite(observedPrice) || observedPrice <= 0) {
      setReportStatus("확인 가격을 입력해 주세요.");
      return;
    }
    if (!state.reportPhotoDataUrl) {
      setReportStatus("사진을 촬영/첨부해 주세요.");
      return;
    }

    els.reportSubmitBtn.disabled = true;
    setReportStatus("신고 접수 중...");

    const payload = {
      station,
      observedPrice,
      memo: String(els.reportMemoInput.value || "").trim(),
      photoDataUrl: state.reportPhotoDataUrl,
      reporterLocation: {
        lat: state.lat,
        lng: state.lng
      },
      fuel: els.fuelSelect.value,
      compareDays: Number(els.compareSelect.value) || 14
    };

    const response = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      throw new Error("report API error");
    }
    const result = await response.json();
    if (result?.sinmungoUrl) {
      els.sinmungoLink.href = result.sinmungoUrl;
    }
    els.reportDraftText.value = result?.draftText || "";
    setReportStatus(`신고 초안 접수 완료 · 접수번호 ${result?.reportId || "-"}`);
    state.reportCount += 1;
    localStorage.setItem("fuelRadarReportCount", String(state.reportCount));
    rerenderCached();
  } catch (error) {
    console.error(error);
    setReportStatus("신고 접수 실패: 사진 크기/네트워크를 확인해 주세요.");
  } finally {
    els.reportSubmitBtn.disabled = false;
  }
}

async function init() {
  els.radiusInput.addEventListener("input", () => {
    els.radiusLabel.textContent = `${els.radiusInput.value}km`;
  });
  els.refreshBtn.addEventListener("click", () => refresh(true));
  els.fuelSelect.addEventListener("change", () => refresh(true));
  els.compareSelect.addEventListener("change", () => refresh(true));
  els.sortModeSelect.addEventListener("change", rerenderCached);
  els.fillLitersInput.addEventListener("change", rerenderCached);
  els.efficiencyInput.addEventListener("change", rerenderCached);
  els.radiusInput.addEventListener("change", () => refresh(true));
  els.refreshSecSelect.addEventListener("change", () => {
    resetAutoRefresh();
    refresh(true);
  });
  els.autoRefreshCheck.addEventListener("change", () => {
    resetAutoRefresh();
    refresh(true);
  });
  els.reportStationSelect.addEventListener("change", handleStationSelect);
  els.reportPhotoInput.addEventListener("change", async () => {
    const file = els.reportPhotoInput.files && els.reportPhotoInput.files[0];
    if (!file) {
      state.reportPhotoDataUrl = null;
      els.reportPreview.hidden = true;
      els.reportPreview.removeAttribute("src");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      state.reportPhotoDataUrl = null;
      els.reportPreview.hidden = true;
      els.reportPreview.removeAttribute("src");
      setReportStatus("사진은 3MB 이하로 업로드해 주세요.");
      els.reportPhotoInput.value = "";
      return;
    }
    state.reportPhotoDataUrl = await fileToDataUrl(file);
    els.reportPreview.src = state.reportPhotoDataUrl;
    els.reportPreview.hidden = false;
    setReportStatus("사진 준비 완료");
  });
  els.reportSubmitBtn.addEventListener("click", submitReport);
  if (els.shareCardBtn) {
    els.shareCardBtn.addEventListener("click", shareCard);
  }
  if (els.quickReportBtn) {
    els.quickReportBtn.addEventListener("click", openQuickReportShortcut);
  }
  els.locationSearchBtn.addEventListener("click", applySearchedLocation);
  els.locationSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applySearchedLocation();
    }
  });
  els.showMoreBtn.addEventListener("click", () => {
    const hiddenItems = els.list.querySelectorAll(".item.is-hidden");
    const isActive = els.showMoreBtn.classList.contains("is-active");

    if (isActive) {
      // 다시 숨기기
      els.list.querySelectorAll(".item").forEach((item, idx) => {
        if (idx >= 5) item.classList.add("is-hidden");
      });
      els.showMoreBtn.classList.remove("is-active");
      els.showMoreBtn.querySelector("span").textContent = "주유소 더 보기";
      els.showMoreContainer.scrollIntoView({ behavior: 'smooth', block: 'end' });
    } else {
      // 펼치기
      hiddenItems.forEach(item => item.classList.remove("is-hidden"));
      els.showMoreBtn.classList.add("is-active");
      els.showMoreBtn.querySelector("span").textContent = "목록 접기";
    }
  });
  els.useCurrentLocationBtn.addEventListener("click", async () => {
    try {
      await applyCurrentLocation();
      await refresh(true);
    } catch (error) {
      console.error(error);
      setLocationSearchStatus("현재 위치를 가져오지 못했습니다. 권한을 확인해 주세요.");
    }
  });

  if (!("geolocation" in navigator)) {
    if (DEMO_MODE) {
      state.lat = 37.5665;
      state.lng = 126.978;
      els.locationText.textContent = "DEMO 좌표: 서울 시청";
      setRadarState("DEMO 레이더 모드로 주변 스캔을 시작합니다.", true);
      setLocationSearchStatus("DEMO 모드입니다. 검색 위치 전환도 사용할 수 있어요.");
      resetAutoRefresh();
      await refresh(true);
      return;
    }
    setRadarState("이 브라우저는 위치 기능을 지원하지 않습니다.", false);
    setLocationSearchStatus("위치 기능이 없어 검색 위치만 사용할 수 있습니다.");
    setStatus("이 브라우저는 위치 권한을 지원하지 않습니다.");
    return;
  }

  try {
    if (DEMO_MODE) {
      state.lat = 37.5665;
      state.lng = 126.978;
      els.locationText.textContent = "테스트 모드: 서울 시청";
      setRadarState("데모 레이더 가동 중", true);
      setLocationSearchStatus("💡 데모 모드입니다. 실제 유가를 보려면 '?demo=1'을 제거하세요.");
    } else {
      setLocationSearchStatus("📡 주변 주유소를 찾기 위해 위치를 확인하고 있습니다...");
      await applyCurrentLocation();

      // 위치 하을 승인된 후 watchPosition으로 실시간 추적 시작
      if ("geolocation" in navigator) {
        navigator.geolocation.watchPosition(
          (pos) => {
            const newLat = Number(pos.coords.latitude.toFixed(6));
            const newLng = Number(pos.coords.longitude.toFixed(6));
            state.lat = newLat;
            state.lng = newLng;
            updateUserMarkerOnMap(newLat, newLng);
          },
          null,
          { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
        );
      }
    }
    resetAutoRefresh();
    await refresh(true);
  } catch (error) {
    console.error(error);
    if (DEMO_MODE) {
      state.lat = 37.5665;
      state.lng = 126.978;
      els.locationText.textContent = "테스트 모드: 서울 시청";
      setRadarState("데모 레이더 가동 중", true);
      await refresh(true);
      return;
    }
    setRadarState("위치 권한이 필요합니다.", false);
    setLocationSearchStatus("📍 위치 권한을 허용하거나, 상단 검색창에 지역을 직접 입력해 주세요.");
    setStatus("실시간 데이터를 불러오려면 위치 권한이 필요합니다.");
  }
}

init();
