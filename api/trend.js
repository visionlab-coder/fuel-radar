const { fetchOpinet, fuelToProdcd, parseDate, parseNumber, pick } = require("./_opinet");

function toKstYmd(date) {
  const y = date.getUTCFullYear();
  const m = `${date.getUTCMonth() + 1}`.padStart(2, "0");
  const d = `${date.getUTCDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

module.exports = async (req, res) => {
  try {
    const fuel = String(req.query.fuel || "gasoline").toLowerCase();
    const compareDaysRaw = parseNumber(req.query.days);
    const compareDays = Math.min(30, Math.max(1, Number.isFinite(compareDaysRaw) ? Math.round(compareDaysRaw) : 14));
    const rows = await fetchOpinet("avgRecentPrice.do", { prodcd: fuelToProdcd(fuel) }, { cacheTtlSec: 1800 });

    const points = rows
      .map((row) => {
        const dateRaw = pick(row, ["TRADE_DT", "DATE", "STAT_DT", "WDATE"]);
        const priceRaw = pick(row, ["PRICE", "OIL_PRICE", "AVG_PRICE", "AVERAGE_PRICE"]);
        const date = parseDate(dateRaw);
        const price = parseNumber(priceRaw);
        if (!date || !Number.isFinite(price)) return null;
        return { date, price };
      })
      .filter(Boolean)
      .sort((a, b) => a.date - b.date);

    if (points.length === 0) {
      return res.status(200).json({
        updatedAt: new Date().toISOString(),
        fuel,
        compareDays,
        latest: null,
        previous: null,
        series: [],
        delta: null,
        deltaPct: null,
        note: "Not enough trend data from API"
      });
    }

    const latest = points[points.length - 1];
    const targetTs = latest.date.getTime() - compareDays * 24 * 60 * 60 * 1000;
    let past = points[0];
    for (const point of points) {
      if (point.date.getTime() <= targetTs) {
        past = point;
      } else {
        break;
      }
    }

    const delta = latest.price - past.price;
    const deltaPct = past.price > 0 ? (delta / past.price) * 100 : null;

    return res.status(200).json({
      updatedAt: new Date().toISOString(),
      fuel,
      compareDays,
      latest: {
        date: toKstYmd(latest.date),
        price: Number(latest.price.toFixed(2))
      },
      previous: {
        date: toKstYmd(past.date),
        price: Number(past.price.toFixed(2))
      },
      series: points.slice(-15).map((point) => ({
        date: toKstYmd(point.date),
        price: Number(point.price.toFixed(2))
      })),
      delta: Number(delta.toFixed(2)),
      deltaPct: deltaPct === null ? null : Number(deltaPct.toFixed(2))
    });
  } catch (error) {
    return res.status(500).json({
      error: "Failed to fetch trend",
      message: error instanceof Error ? error.message : "unknown"
    });
  }
};
