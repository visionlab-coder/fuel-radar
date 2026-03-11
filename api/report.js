const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

function parseDataUrl(dataUrl) {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(String(dataUrl || ""));
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const base64 = match[2];
  const extMap = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };
  const ext = extMap[mimeType];
  if (!ext) return null;
  return { mimeType, base64, ext };
}

function limitText(text, max) {
  const value = String(text || "").trim();
  return value.length > max ? value.slice(0, max) : value;
}

module.exports = async (req, res) => {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }
    const body = req.body && typeof req.body === "object" ? req.body : {};
    const station = body.station && typeof body.station === "object" ? body.station : null;
    const observedPrice = Number(body.observedPrice);
    const photo = parseDataUrl(body.photoDataUrl);
    const memo = limitText(body.memo, 1500);

    if (!station || !station.name || !station.address) {
      return res.status(400).json({ error: "station is required" });
    }
    if (!Number.isFinite(observedPrice) || observedPrice <= 0) {
      return res.status(400).json({ error: "observedPrice is required" });
    }
    if (!photo) {
      return res.status(400).json({ error: "photoDataUrl is required" });
    }

    const imageBuffer = Buffer.from(photo.base64, "base64");
    if (imageBuffer.byteLength > 3 * 1024 * 1024) {
      return res.status(413).json({ error: "photo too large (max 3MB)" });
    }

    const reportId = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
    const reportDir = "/tmp/fuel-radar-reports";
    await fs.mkdir(reportDir, { recursive: true });

    const imageFile = path.join(reportDir, `${reportId}.${photo.ext}`);
    const metaFile = path.join(reportDir, `${reportId}.json`);
    await fs.writeFile(imageFile, imageBuffer);

    const payload = {
      reportId,
      createdAt: new Date().toISOString(),
      station: {
        id: station.id || "",
        name: station.name || "",
        address: station.address || "",
        brand: station.brand || "",
        priceInApp: station.price || null,
        lat: station.lat || null,
        lng: station.lng || null
      },
      observedPrice,
      memo,
      reporterLocation: body.reporterLocation || null,
      fuel: body.fuel || "gasoline",
      compareDays: body.compareDays || 14,
      imageFile
    };
    await fs.writeFile(metaFile, JSON.stringify(payload, null, 2), "utf8");

    const draftLines = [
      "[유류가격 이상 신고 초안]",
      `접수번호: ${reportId}`,
      `주유소: ${payload.station.name}`,
      `주소: ${payload.station.address}`,
      `앱 표시가: ${payload.station.priceInApp ?? "-"}원/L`,
      `현장 확인가: ${observedPrice}원/L`,
      `차이: ${
        Number.isFinite(payload.station.priceInApp) ? `${observedPrice - payload.station.priceInApp}원/L` : "-"
      }`,
      `작성시각: ${payload.createdAt}`,
      memo ? `메모: ${memo}` : "메모: 없음",
      `사진파일: ${imageFile}`
    ];

    return res.status(200).json({
      ok: true,
      reportId,
      sinmungoUrl: "https://www.epeople.go.kr/",
      draftText: draftLines.join("\n")
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to save report",
      message: error instanceof Error ? error.message : "unknown"
    });
  }
};
