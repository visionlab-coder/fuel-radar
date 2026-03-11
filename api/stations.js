const { fetchOpinet, fuelToProdcd, haversineKm, parseNumber, pick, wgs84ToKatec, katecToWgs84 } = require("./_opinet");

// 역지오코딩 - 좌표로부터 주소를 가져옵니다 (Nominatim, 무료)
async function reverseGeocode(lat, lng) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ko`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "FuelRadar/1.0" } });
    clearTimeout(timer);
    if (!res.ok) return "";
    const data = await res.json();
    const addr = data?.address;
    if (!addr) return "";
    // 도로명·구·시 순으로 조합
    const parts = [addr.road, addr.suburb || addr.quarter, addr.city_district || addr.county, addr.city || addr.town].filter(Boolean);
    return parts.slice(0, 3).join(" ");
  } catch {
    return "";
  }
}

module.exports = async (req, res) => {
  try {
    const lat = parseNumber(req.query.lat);
    const lng = parseNumber(req.query.lng);
    const radiusKm = Math.min(30, Math.max(1, parseNumber(req.query.radiusKm) || 10));
    const fuel = String(req.query.fuel || "gasoline").toLowerCase();

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: "lat,lng query is required" });
    }

    // WGS84 위경도를 오피넷 표준인 KATEC(TM) 좌표로 변환
    const katec = wgs84ToKatec(lat, lng);

    const rows = await fetchOpinet("aroundAll.do", {
      x: katec.x,
      y: katec.y,
      radius: Math.round(radiusKm * 1000),
      sort: 1,
      prodcd: fuelToProdcd(fuel)
    }, { cacheTtlSec: 120 });

    const stations = rows
      .map((row) => {
        // 오피넷 aroundAll 응답의 GIS 좌표는 이미 WGS84 위경도 소수점 값입니다
        // GIS_Y_COOR = 위도(lat, 예: 37.5665), GIS_X_COOR = 경도(lng, 예: 126.978)
        const sLng = parseNumber(pick(row, ["GIS_X_COOR", "X"]));
        const sLat = parseNumber(pick(row, ["GIS_Y_COOR", "Y"]));
        const price = parseNumber(pick(row, ["OIL_PRICE", "PRICE", "SALE_PRICE", "B027", "D047"]));
        const name = pick(row, ["OS_NM", "NAME", "POLL_NM"]) || "이름없음";
        const rawAddress = pick(row, ["NEW_ADR", "VAN_ADR", "ADDRESS"]) || "";

        if (!Number.isFinite(sLat) || !Number.isFinite(sLng) || !Number.isFinite(price)) return null;

        return {
          id: pick(row, ["UNI_ID", "ID", "OS_ID"]) || `${name}-${sLat}-${sLng}`,
          name,
          price,
          brand: pick(row, ["POLL_DIV_CD", "POLL_DIV_CO", "GPOLL_DIV_CO", "BRAND"]) || "",
          address: rawAddress,
          distanceKm: haversineKm(lat, lng, sLat, sLng),
          lat: sLat,
          lng: sLng
        };
      })
      .filter(Boolean)
      .filter((s) => s.distanceKm <= radiusKm + 0.05)
      .sort((a, b) => a.price - b.price || a.distanceKm - b.distanceKm);

    const sorted = stations.slice(0, 30);

    // 주소 없는 상위 5개만 역지오코딩으로 보완 (속도 제한: 순지 처리)
    const needGeo = sorted.filter(s => !s.address).slice(0, 5);
    for (const s of needGeo) {
      s.address = await reverseGeocode(s.lat, s.lng);
    }

    return res.status(200).json({
      updatedAt: new Date().toISOString(),
      fuel,
      radiusKm,
      total: stations.length,
      cheapest: sorted[0] || null,
      stations: sorted
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch stations",
      message: error instanceof Error ? error.message : "unknown"
    });
  }
};
