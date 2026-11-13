'use strict';

const toggle = document.querySelector('.menu-toggle');
const menu = document.querySelector('.menu');
const desktopViewport = window.matchMedia('(min-width: 1024px)');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
function usesDesktopNavigation() {
  return desktopViewport.matches && Boolean(document.querySelector('.desktop-nav'));
}
let scrollTop = 0;
let closing = false;
let closeTimer;
function openMenu() {
  if (menu.open || usesDesktopNavigation()) return;
  scrollTop = window.scrollY;
  document.body.style.setProperty('--scroll-top', `-${scrollTop}px`);
  document.body.classList.add('menu-open');
  toggle.setAttribute('autofocus', '');
  menu.append(toggle);
  menu.showModal();
  toggle.removeAttribute('autofocus');
  toggle.focus({ preventScroll: true });
  toggle.getBoundingClientRect();
  toggle.setAttribute('aria-expanded', 'true');
  toggle.setAttribute('aria-label', 'Close navigation');
  menu.classList.add('is-open');
}
function finishClose() {
  if (!closing) return;
  clearTimeout(closeTimer);
  document.querySelector('.header').append(toggle);
  toggle.setAttribute('aria-label', 'Open navigation');
  menu.close();
  closing = false;
  document.body.classList.remove('menu-open');
  document.body.style.removeProperty('--scroll-top');
  const scrollBehavior = document.documentElement.style.scrollBehavior;
  document.documentElement.style.scrollBehavior = 'auto';
  window.scrollTo(0, scrollTop);
  document.documentElement.style.scrollBehavior = scrollBehavior;
  toggle.setAttribute('aria-expanded', 'false');
  if (!usesDesktopNavigation()) toggle.focus({ preventScroll: true });
}
function closeMenu() {
  if (!menu.open || closing) return;
  closing = true;
  toggle.setAttribute('aria-expanded', 'false');
  menu.classList.remove('is-open');
  closeTimer = setTimeout(finishClose, reducedMotion.matches ? 0 : 320);
}
function syncNavigationMode() {
  if (usesDesktopNavigation() && menu.open) {
    closing = true;
    menu.classList.remove('is-open');
    finishClose();
  }
  toggle.hidden = usesDesktopNavigation();
}
syncNavigationMode();
desktopViewport.addEventListener('change', syncNavigationMode);
toggle.addEventListener('click', () => {
  if (menu.open) {
    closeMenu();
  } else {
    openMenu();
  }
});
menu.addEventListener('cancel', event => { event.preventDefault(); closeMenu(); });
menu.addEventListener('click', event => {
  const rect = menu.getBoundingClientRect();
  if (event.target === menu && (event.clientX < rect.left || event.clientX > rect.right)) closeMenu();
});
menu.addEventListener('transitionend', event => {
  if (event.target === menu.querySelector('.menu-panel') && event.propertyName === 'transform' && closing) finishClose();
});
menu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMenu));

const videos = [...document.querySelectorAll('.background-video')];
const visibleVideos = new Set();
function updatePlayback() {
  videos.forEach(video => {
    if (visibleVideos.has(video) && !document.hidden && !reducedMotion.matches) {
      if (!video.getAttribute('src')) video.src = video.dataset.file;
      video.muted = true;
      video.play().catch(() => { });
    } else video.pause();
  });
}
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => entry.isIntersecting ? visibleVideos.add(entry.target) : visibleVideos.delete(entry.target));
  updatePlayback();
});
videos.forEach(video => observer.observe(video));
document.addEventListener('visibilitychange', updatePlayback);
reducedMotion.addEventListener('change', updatePlayback);

(() => {
  const entrySelector = '.gaming-reviews .review-entry[data-review-id]';
  function getCatalog(doc, indexURL) {
    const seen = new Set();
    return [...doc.querySelectorAll(entrySelector)].map(entry => {
      const id = entry.dataset.reviewId;
      const link = entry.querySelector('.review-card[href]');
      const title = entry.querySelector('.review-card__title');
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || seen.has(id) || !link || !title) {
        throw new Error(`Invalid or duplicate review ID: ${id}`);
      }
      seen.add(id);
      return { id, title: title.textContent.replace(/\s+/g, ' ').trim(), url: new URL(link.getAttribute('href'), indexURL).href };
    });
  }
  if (document.body.classList.contains('page-gaming') && document.querySelector(entrySelector)) {
    try { getCatalog(document, location.href); }
    catch (error) { console.warn('Gaming catalog:', error.message); }
  }
  const currentId = document.body.dataset.reviewId;
  const navigations = [...document.querySelectorAll('[data-review-navigation]')];
  if (!currentId || !navigations.length) return;
  const indexURL = new URL(document.body.dataset.reviewIndex || '../gaming.html', location.href);
  function setLink(link, review, label) {
    if (!link) return;
    link.hidden = false;
    if (!review) {
      link.removeAttribute('href');
      link.removeAttribute('title');
      link.setAttribute('aria-disabled', 'true');
      link.setAttribute('tabindex', '-1');
      return;
    }
    link.href = review.url;
    link.removeAttribute('aria-disabled');
    link.removeAttribute('tabindex');
    link.setAttribute('aria-label', `${label}: ${review.title}`);
    link.title = review.title;
  }
  fetch(indexURL, { credentials: 'same-origin' })
    .then(response => {
      if (!response.ok) throw new Error(`Cannot load review index (${response.status})`);
      return response.text();
    })
    .then(html => {
      const catalog = getCatalog(new DOMParser().parseFromString(html, 'text/html'), indexURL);
      const position = catalog.findIndex(review => review.id === currentId);
      if (position < 0) throw new Error(`Review not found: ${currentId}`);
      navigations.forEach(navigation => {
        setLink(navigation.querySelector('[data-review-previous]'), catalog[position + 1], 'Previous review');
        setLink(navigation.querySelector('[data-review-next]'), catalog[position - 1], 'Next review');
      });
    })
    .catch(error => console.warn('Review navigation:', error.message));
})();

document.querySelectorAll('[data-youtube-id]').forEach(container => {
  const videoId = container.dataset.youtubeId;
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return;
  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube-nocookie.com/embed/${videoId}`;
  iframe.title = container.getAttribute('aria-label') || 'Video';
  iframe.loading = 'lazy';
  iframe.allow = 'encrypted-media; picture-in-picture; fullscreen';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  container.append(iframe);
});
