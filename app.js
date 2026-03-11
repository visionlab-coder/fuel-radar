// Mock Data replicating the original UI
const mockStations = [
  { rank: 1, name: "지에스칼텍스(주) 대청주유소", price: 1777, diff: "+4,445", dist: "2.54km", addr: "주소 정보 없음" },
  { rank: 2, name: "HD현대오일뱅크(주)직영 교대셀프주유소", price: 1794, diff: "+3,955", dist: "1.88km", addr: "주소 정보 없음" },
  { rank: 3, name: "HD현대오일뱅크(주)직영 직지셀프주유소", price: 1794, diff: "+3,941", dist: "1.93km", addr: "주소 정보 없음" },
  { rank: 4, name: "SK에너지(주)신세계주유소", price: 1798, diff: "+3,700", dist: "1.03km", addr: "주소 정보 없음" },
];

function renderRadar() {
  const canvas = document.getElementById('radarCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 120;
  const center = size / 2;

  // Clear
  ctx.clearRect(0, 0, size, size);

  // Draw circles
  ctx.strokeStyle = 'rgba(94, 234, 212, 0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(center, center, 20, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(center, center, 40, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(center, center, 55, 0, Math.PI * 2); ctx.stroke();

  // Draw cross
  ctx.beginPath(); ctx.moveTo(center, 5); ctx.lineTo(center, size - 5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(5, center); ctx.lineTo(size - 5, center); ctx.stroke();

  // Draw dots
  ctx.fillStyle = '#a7f3d0';
  const dots = [
    { x: 40, y: 30 }, { x: 80, y: 40 }, { x: 60, y: 70 }, { x: 30, y: 80 }, { x: 90, y: 85 }, { x: 55, y: 100 }
  ];
  dots.forEach(d => {
    ctx.beginPath();
    ctx.arc(d.x, d.y, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#5eead4';
  });
  ctx.shadowBlur = 0;
}

function renderList() {
  const container = document.getElementById('fullStationList');
  if (!container) return;

  container.innerHTML = mockStations.map(st => `
    <div class="list-item">
      <div class="list-header">
        <div style="display:flex; align-items:center; width:60%;">
          <span class="list-rank">#${st.rank}</span>
          <div class="list-bar"></div>
        </div>
        <div style="text-align:right;">
          <h3 class="station-name text-lg">${st.name}</h3>
          <p class="text-tertiary mt-1">${st.dist} · ${st.addr}</p>
        </div>
      </div>
      <div class="list-price-group">
        <span class="station-price">${st.price.toLocaleString()}원/L</span>
        <span class="text-primary mt-1 font-bold">▼ ${st.diff}원</span>
      </div>
    </div>
  `).join('');
}

document.addEventListener('DOMContentLoaded', () => {
  renderRadar();
  renderList();

  const slider = document.getElementById('radiusSlider');
  const radiusText = document.getElementById('radiusText');
  const rdrRadius = document.getElementById('rdrRadius');
  if (slider) {
    slider.addEventListener('input', (e) => {
      if (radiusText) radiusText.textContent = e.target.value + 'km';
      if (rdrRadius) rdrRadius.textContent = e.target.value + 'km';
    });
  }
});
