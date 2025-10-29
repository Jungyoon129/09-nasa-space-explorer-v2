// js/script.js  (Replacement Version)

// 1) APOD 미러 JSON
const APOD_FEED_URL = 'https://cdn.jsdelivr.net/gh/GCA-Classroom/apod/data.json';

// 2) DOM
const btn = document.getElementById('getImageBtn');
const gallery = document.getElementById('gallery');
const startInput = document.getElementById('startDate');
const endInput = document.getElementById('endDate');

// Random Space Fact
const SPACE_FACTS = [
  "A day on Venus is longer than a year on Venus.",
  "Neutron stars can spin over 600 times per second.",
  "Jupiter’s Great Red Spot is a storm bigger than Earth.",
  "One million Earths could fit inside the Sun.",
  "There are more stars in the universe than grains of sand on Earth.",
  "In space, metal pieces can weld together in a process called cold welding.",
  "Saturn could float in water—it’s less dense than water."
];

function showRandomFact(){
  const box = document.getElementById('spaceFact');
  if(!box) return;
  const fact = SPACE_FACTS[Math.floor(Math.random()*SPACE_FACTS.length)];
  box.textContent = `💡 Did you know? ${fact}`;
}
showRandomFact(); // 페이지 로드 때 1회 표시


// 3) Loading banner (create once)
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

// Fetch click
btn?.addEventListener('click', async () => {
  showLoading('🔄 Loading space photos…');
  clearGallery();

  try {
    const [list] = await Promise.all([fetchAPOD(), delay(800)]);
    const filtered = filterByDateRange(list, startInput?.value, endInput?.value);

    if (!filtered.length) {
      gallery.innerHTML = emptyState('No results for that date range.');
      return;
    }

    filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    renderGallery(filtered);
  } catch (err) {
    console.error(err);
    gallery.innerHTML = errorState('Could not load the APOD feed. Please try again.');
  } finally {
    hideLoading();
  }
});

// Utils
function delay(ms){ return new Promise(r => setTimeout(r, ms)); }

// Data
async function fetchAPOD() {
  const res = await fetch(APOD_FEED_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const arr = Array.isArray(data) ? data : (Array.isArray(data.results) ? data.results : []);
  return arr.filter(item => item && (item.url || item.hdurl || item.thumbnail_url));
}

// Date filter
function filterByDateRange(list, start, end) {
  if (!start && !end) return list;
  const s = start ? new Date(start) : null;
  const e = end ? new Date(end) : null;
  return list.filter(it => {
    const d = new Date(it.date);
    if (Number.isNaN(d)) return false;
    return (!s || d >= s) && (!e || d <= e);
  });
}

// Gallery
function clearGallery(){ gallery.innerHTML = ''; }

function renderGallery(items) {
  const frag = document.createDocumentFragment();
  items.forEach(item => {
    const { title, date, media_type, url, thumbnail_url, hdurl } = item;

    const card = document.createElement('article');
    card.className = 'gallery-item';
    card.tabIndex = 0;
    card.role = 'button';
    card.setAttribute('aria-label', `${title || 'APOD'} (${date}) – open details`);

    const imgWrap = document.createElement('div');

    if (media_type === 'image' && (url || hdurl)) {
      const img = document.createElement('img');
      img.src = url || hdurl;
      img.alt = title || 'Astronomy Picture';
      img.loading = 'lazy';
      imgWrap.appendChild(img);
    } else if (media_type === 'video') {
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
    card.addEventListener('click', () => openModal(item));
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openModal(item); }
    });

    frag.appendChild(card);
  });
  gallery.appendChild(frag);
}

// Modal
let modalRoot = null;

function openModal(item) {
  closeModal();

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
    img.src = item.hdurl || item.url;
    img.alt = item.title || 'Astronomy Picture';
    body.appendChild(img);

  } else if (item.media_type === 'video' && item.url) {
    // Robust video embed
    const embed = toEmbeddableURL(item.url);

    const iframe = document.createElement('iframe');
    iframe.src = embed;
    iframe.title = item.title || 'APOD video';
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allow',
      'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
    );
    // 강화된 보안/호환 속성
    iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-presentation');
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.loading = 'lazy';
    body.appendChild(iframe);

    // 확실한 새 탭 열기 버튼
    const openBtn = document.createElement('button');
    openBtn.className = 'modal-close';
    openBtn.textContent = 'Open Video in New Tab';
    openBtn.addEventListener('click', () => {
      window.open(item.url, '_blank', 'noopener,noreferrer');
    });
    body.appendChild(openBtn);

    const note = document.createElement('p');
    note.className = 'modal-note';
    note.textContent = "If the player doesn't load here, use the button above to watch it on YouTube.";
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

  overlay.addEventListener('click', closeModal);
  document.addEventListener('keydown', escCloseOnce, { once: true });
  setTimeout(() => closeBtn.focus(), 0);
}

function escCloseOnce(e){ if (e.key === 'Escape') closeModal(); }
function closeModal(){
  if (modalRoot && modalRoot.parentNode) {
    modalRoot.parentNode.removeChild(modalRoot);
    modalRoot = null;
  }
}

// Status / helpers
function showLoading(msg='Loading…'){ loading.textContent = msg; loading.hidden = false; }
function hideLoading(){ loading.hidden = true; }
function errorState(msg){ return `<div class="placeholder" role="status">${escapeHTML(msg)}</div>`; }
function emptyState(msg){ return `<div class="placeholder" role="status">${escapeHTML(msg)}</div>`; }

function formatDate(iso){
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined,{ year:'numeric', month:'short', day:'2-digit' });
  } catch { return iso || ''; }
}

// === Robust YouTube embedding (nocookie + more patterns)
function toEmbeddableURL(url) {
  try {
    const u = new URL(url);

    // youtube.com → nocookie embed
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube-nocookie.com/embed/${v}?rel=0&modestbranding=1&playsinline=1`;
      if (u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/shorts/')[1];
        if (id) return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
      }
      if (u.pathname.startsWith('/embed/')) {
        const id = u.pathname.split('/embed/')[1];
        return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
      }
    }

    // youtu.be → nocookie embed
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace('/', '');
      if (id) return `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
    }

    return url; // 변환 불가 시 원본 유지
  } catch {
    return url;
  }
}

function escapeHTML(s){
  return String(s).replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  })[ch]);
}
function escapeAttr(s){ return String(s).replace(/"/g,'&quot;'); }
