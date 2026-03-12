// Mock Data replicating the original UI
const mockStations = [
  { rank: 1, name: "지에스칼텍스(주) 대청주유소", price: 1777, diff: "+4,445", dist: "2.54km", addr: "주소 정보 없음" },
  { rank: 2, name: "HD현대오일뱅크(주)직영 교대셀프주유소", price: 1794, diff: "+3,955", dist: "1.88km", addr: "주소 정보 없음" },
  { rank: 3, name: "HD현대오일뱅크(주)직영 직지셀프주유소", price: 1794, diff: "+3,941", dist: "1.93km", addr: "주소 정보 없음" },
  { rank: 4, name: "SK에너지(주)신세계주유소", price: 1798, diff: "+3,700", dist: "1.03km", addr: "주소 정보 없음" },
];

let radarAngle = 0;
function renderRadar() {
  const canvas = document.getElementById('radarCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const size = 120;
  const center = size / 2;

  function draw() {
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

    // Draw sweep
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(radarAngle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, 55, 0, Math.PI * 0.25);
    ctx.lineTo(0, 0);
    const grad = ctx.createLinearGradient(0, 0, 55, 55);
    grad.addColorStop(0, 'rgba(94, 234, 212, 0.4)');
    grad.addColorStop(1, 'rgba(94, 234, 212, 0)');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.restore();

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

    radarAngle += 0.05;
    requestAnimationFrame(draw);
  }

  draw();
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

  // Modal Event Listeners
  const shinmungoBtn = document.getElementById('shinmungoBtn');
  const communityBtn = document.getElementById('shareCommunityBtn');

  const shinmungoModal = document.getElementById('shinmungoModal');
  const communityModal = document.getElementById('communityModal');

  const closeShinmungoBtn = document.getElementById('closeShinmungoBtn');
  const closeCommunityBtn = document.getElementById('closeCommunityBtn');

  // Open modals
  if (shinmungoBtn) {
    shinmungoBtn.addEventListener('click', (e) => {
      e.preventDefault();
      shinmungoModal.classList.remove('hidden');
    });
  }

  if (communityBtn) {
    communityBtn.addEventListener('click', (e) => {
      e.preventDefault();
      communityModal.classList.remove('hidden');
    });
  }

  // Close modals
  if (closeShinmungoBtn) {
    closeShinmungoBtn.addEventListener('click', () => {
      shinmungoModal.classList.add('hidden');
    });
  }

  if (closeCommunityBtn) {
    closeCommunityBtn.addEventListener('click', () => {
      communityModal.classList.add('hidden');
    });
  }

  // Close when clicking outside
  window.addEventListener('click', (e) => {
    if (e.target === shinmungoModal) shinmungoModal.classList.add('hidden');
    if (e.target === communityModal) communityModal.classList.add('hidden');
  });

  // Form Submissions
  const shinmungoForm = document.getElementById('shinmungoForm');
  if (shinmungoForm) {
    shinmungoForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = shinmungoForm.querySelector('button');
      const originalText = btn.textContent;
      btn.textContent = '전송 중...';
      btn.disabled = true;

      // Simulate network request
      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
        shinmungoModal.classList.add('hidden');
        showToast('✅ 신문고 접수가 완료되었습니다. 담당 관청으로 전달됩니다.');
        shinmungoForm.reset();
      }, 1000);
    });
  }

  const communityForm = document.getElementById('communityForm');
  if (communityForm) {
    communityForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const btn = communityForm.querySelector('button');
      const originalText = btn.textContent;
      btn.textContent = '등록 중...';
      btn.disabled = true;

      const comment = document.getElementById('shareComment').value || '오늘 대박 절약 꿀팁 공유합니다!';

      setTimeout(() => {
        btn.textContent = originalText;
        btn.disabled = false;
        communityModal.classList.add('hidden');
        showToast('📢 커뮤니티에 성공적으로 공유되었습니다!');
        communityForm.reset();

        // Add visual cue in DOM as proof of share
        addFeedItem('지에스칼텍스(주) 대청주유소', comment);
      }, 1000);
    });
  }

  // Toast System
  function showToast(message) {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    container.appendChild(toast);

    // Trigger reflow & show
    setTimeout(() => { toast.classList.add('show'); }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => { toast.remove(); }, 300);
    }, 3000);
  }

  // Visual simulation for feed (adds to UI)
  function addFeedItem(stationName, comment) {
    const container = document.getElementById('fullStationList');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'list-item fade-in-up';
    div.style.borderLeft = '4px solid #fdba74';
    div.innerHTML = `
      <div class="list-header">
        <div style="display:flex; align-items:center;">
          <span class="text-orange font-bold text-sm mr-2">[커뮤니티 새 피드]</span>
        </div>
        <div style="text-align:right;">
          <h3 class="station-name text-md" style="color:#fdba74;">" ${comment} "</h3>
          <p class="text-tertiary mt-1">방금 전 · 내 제보 (${stationName})</p>
        </div>
      </div>
    `;
    container.prepend(div);
  }
});
