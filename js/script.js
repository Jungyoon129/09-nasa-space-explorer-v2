// js/script.js

// 1) 수업용 APOD 미러 JSON URL (README와 동일)
const APOD_FEED_URL = 'https://cdn.jsdelivr.net/gh/GCA-Classroom/apod/data.json';

// 2) DOM 참조
const btn = document.getElementById('getImageBtn');
const gallery = document.getElementById('gallery');

// 3) 로딩 배너 동적 생성(없으면 만들기)
let loading = document.getElementById('loading');
if (!loading) {
  loading = document.createElement('div');
  loading.id = 'loading';
  loading.className = 'loading';
  loading.hidden = true;
  loading.setAttribute('aria-live', 'polite');
  loading.textContent = '🔄 Loading space photos…';
  const container = document.querySelector('.container');
  container.insertBefore(loading, container.querySelector('.filters').nextSibling);
}

// 버튼 클릭 이벤트
btn?.addEventListener('click', async () => {
  showLoading('🔄 Loading space photos…');
  clearGallery();

  try {
    // 데이터 fetch + 최소 로딩시간(800ms)을 동시에 기다리기
    const [list] = await Promise.all([
      fetchAPOD(),
      delay(800)  // 최소 0.8초는 로딩 유지
    ]);

    if (!list.length) {
      gallery.innerHTML = emptyState('No results found. Please try again later.');
      return;
    }

    // 최신 날짜가 위로 오도록 정렬
    list.sort((a, b) => new Date(b.date) - new Date(a.date));

    renderGallery(list);
  } catch (err) {
    console.error(err);
    gallery.innerHTML = errorState('Could not load the APOD feed. Please try again.');
  } finally {
    hideLoading();
  }
});

// === 유틸: 최소 지연 함수 ===
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== 데이터 =====
async function fetchAPOD() {
  const res = await fetch(APOD_FEED_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();

  // 배열 혹은 {results: []} 모두 대응
  const arr = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
  // 미디어 URL이 전혀 없는 항목 제외
  return arr.filter(item => item && (item.url || item.hdurl || item.thumbnail_url));
}

// ===== 갤러리 =====
function clearGallery() {
  gallery.innerHTML = '';
}

function renderGallery(items) {
  const frag = document.createDocumentFragment();

  items.forEach(item => {
    const { title, date, media_type, url, thumbnail_url } = item;

    const card = document.createElement('article');
    card.className = 'gallery-item';
    card.tabIndex = 0;
    card.role = 'button';
    card.setAttribute('aria-label', `${title || 'APOD'} (${date}) – open details`);

    const imgWrap = document.createElement('div');

    if (media_type === 'image' && (url || item.hdurl)) {
      const img = document.createElement('img');
      img.src = url || item.hdurl; // 카드 썸네일은 가볍게 url 우선
      img.alt = title || 'Astronomy Picture';
      img.loading = 'lazy';
      imgWrap.appendChild(img);
    } else if (media_type === 'video' && (thumbnail_url || url)) {
      // README 권장: 비디오에 썸네일이 있으면 썸네일 보여주기
      if (thumbnail_url) {
        const img = document.createElement('img');
        img.src = thumbnail_url;
        img.alt = (title || 'APOD video') + ' (thumbnail)';
        img.loading = 'lazy';
        imgWrap.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'video-placeholder';
        ph.textContent = '▶ Video';
        imgWrap.appendChild(ph);
      }
    } else {
      const ph = document.createElement('div');
      ph.className = 'video-placeholder';
      ph.textContent = 'No preview';
      imgWrap.appendChild(ph);
    }

    const meta = document.createElement('p');
    meta.innerHTML = `<strong>${escapeHTML(title || 'Untitled')}</strong><br><small>${formatDate(date)}</small>`;

    card.append(imgWrap, meta);

    // 클릭/키보드로 모달 열기
    card.addEventListener('click', () => openModal(item));
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openModal(item);
      }
    });

    frag.appendChild(card);
  });

  gallery.appendChild(frag);
}

// ===== 모달 =====
let modalRoot = null;

function openModal(item) {
  closeModal(); // 중복 방지

  modalRoot = document.createElement('div');
  modalRoot.className = 'modal-root';
  modalRoot.role = 'dialog';
  modalRoot.setAttribute('aria-modal', 'true');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'modal-dialog';

  const header = document.createElement('div');
  header.className = 'modal-header';

  const titleEl = document.createElement('h2');
  titleEl.className = 'modal-title';
  titleEl.textContent = item.title || 'Astronomy Picture';

  const dateEl = document.createElement('time');
  dateEl.className = 'modal-date';
  dateEl.dateTime = item.date || '';
  dateEl.textContent = formatDate(item.date);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'modal-close';
  closeBtn.setAttribute('aria-label', 'Close modal');
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', closeModal);

  const body = document.createElement('div');
  body.className = 'modal-body';

  if (item.media_type === 'image' && (item.hdurl || item.url)) {
    const img = document.createElement('img');
    img.src = item.hdurl || item.url; // 모달은 큰 이미지 우선
    img.alt = item.title || 'Astronomy Picture';
    body.appendChild(img);
  } else if (item.media_type === 'video' && item.url) {
    const iframe = document.createElement('iframe');
    iframe.src = toEmbeddableURL(item.url);
    iframe.title = item.title || 'APOD video';
    iframe.allowFullscreen = true;
    iframe.loading = 'lazy';
    body.appendChild(iframe);

    const note = document.createElement('p');
    note.className = 'modal-note';
    note.innerHTML = `If the video doesn't load, <a href="${escapeAttr(
      item.url
    )}" target="_blank" rel="noopener noreferrer">open it in a new tab</a>.`;
    body.appendChild(note);
  } else {
    const p = document.createElement('p');
    p.textContent = 'No media available.';
    body.appendChild(p);
  }

  const expl = document.createElement('p');
  expl.className = 'modal-expl';
  expl.textContent = item.explanation || '';

  header.append(titleEl, dateEl, closeBtn);
  dialog.append(header, body, expl);
  modalRoot.append(overlay, dialog);
  document.body.appendChild(modalRoot);

  // 바깥 클릭 닫기
  overlay.addEventListener('click', closeModal);

  // ESC 닫기
  document.addEventListener('keydown', escCloseOnce, { once: true });

  // 접근성: 닫기 버튼 포커스
  setTimeout(() => closeBtn.focus(), 0);
}

function escCloseOnce(e) {
  if (e.key === 'Escape') closeModal();
}

function closeModal() {
  if (modalRoot && modalRoot.parentNode) {
    modalRoot.parentNode.removeChild(modalRoot);
    modalRoot = null;
  }
}

// ===== 상태/유틸 =====
function showLoading(msg = 'Loading…') {
  loading.textContent = msg;
  loading.hidden = false;
}
function hideLoading() { loading.hidden = true; }

function errorState(msg) {
  return `<div class="placeholder" role="status">${escapeHTML(msg)}</div>`;
}
function emptyState(msg) {
  return `<div class="placeholder" role="status">${escapeHTML(msg)}</div>`;
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    });
  } catch {
    return iso || '';
  }
}

function toEmbeddableURL(url) {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtube.com') && u.searchParams.get('v')) {
      return `https://www.youtube.com/embed/${u.searchParams.get('v')}`;
    }
    if (u.hostname === 'youtu.be') {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
    // 이미 /embed/ 형식이 온 경우 그대로 사용
    return url;
  } catch {
    return url;
  }
}

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[ch]);
}
function escapeAttr(s) { return String(s).replace(/"/g, '&quot;'); }
