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

const reviewNavigationReady = (() => {
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
  return fetch(indexURL, { credentials: 'same-origin' })
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
  iframe.loading = 'eager';
  iframe.allow = 'encrypted-media; picture-in-picture; fullscreen';
  iframe.allowFullscreen = true;
  iframe.referrerPolicy = 'strict-origin-when-cross-origin';
  container.append(iframe);
});

(() => {
  const root = document.documentElement;
  const loader = document.querySelector('.page-loader');
  const main = document.querySelector('main');
  const revealSelector = '.hero, .biography, .content-section, .links-section, .intro-photo, .media-description, .media-item, .portfolio-card, .review-entry, .gaming-links, .review-layout > :not(.review-hero)';
  const revealElements = [...document.querySelectorAll(revealSelector)].filter(element => {
    return !element.parentElement.closest(revealSelector);
  });
  let revealObserver;
  let revealStarted = false;
  let navigating = false;
  let scrollFrame = 0;
  let pageReady = false;
  const isReview = document.body.classList.contains('page-review');

  function updateBackground() {
    scrollFrame = 0;
    if (!pageReady || isReview || document.body.classList.contains('menu-open')) return;
    const distance = root.scrollHeight - window.innerHeight;
    const position = window.scrollY;
    const progress = distance > 0 ? Math.min(1, Math.max(0, position / distance)) : 0;
    const color = getComputedStyle(document.body).getPropertyValue('--orange').trim();
    const hex = color.replace('#', '');
    if (!/^[a-f\d]{6}$/i.test(hex)) return;
    const channels = [0, 2, 4].map(offset => {
      const value = parseInt(hex.slice(offset, offset + 2), 16);
      return Math.round(255 + (value - 255) * progress * 0.2);
    });
    document.body.style.backgroundColor = `rgb(${channels.join(', ')})`;
  }

  function requestBackgroundUpdate() {
    if (pageReady && !revealStarted && window.scrollY >= 24 && !document.body.classList.contains('menu-open')) startRevealing();
    if (!scrollFrame) scrollFrame = requestAnimationFrame(updateBackground);
  }

  function startRevealing() {
    if (!revealObserver || revealStarted) return;
    revealStarted = true;
    revealElements.forEach(element => {
      if (!element.classList.contains('is-revealed')) revealObserver.observe(element);
    });
  }

  function revealPage() {
    revealObserver?.disconnect();
    revealObserver = null;
    revealStarted = false;
    root.classList.add('reveal-initializing');
    revealElements.forEach(element => element.classList.remove('scroll-reveal', 'is-revealed'));
    if (desktopViewport.matches && !reducedMotion.matches && 'IntersectionObserver' in window) {
      const revealOffset = Math.round(window.innerHeight * 0.35);
      revealObserver = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-revealed');
          revealObserver.unobserve(entry.target);
        });
      }, { threshold: 0, rootMargin: `0px 0px -${revealOffset}px 0px` });
      revealElements.forEach(element => {
        element.classList.add('scroll-reveal');
        if (element.matches('.hero')) element.classList.add('is-revealed');
      });
    }
    main?.getBoundingClientRect();
    root.classList.remove('reveal-initializing');
    if (window.scrollY >= 24) startRevealing();
  }

  function finishLoading() {
    pageReady = true;
    main?.removeAttribute('inert');
    document.body.removeAttribute('aria-busy');
    initializeColorWipes();
    revealPage();
    updateBackground();
    main?.getBoundingClientRect();
    root.classList.remove('page-loading');
    loader?.setAttribute('aria-hidden', 'true');
    if (reducedMotion.matches) {
      loader?.remove();
    } else {
      setTimeout(() => loader?.remove(), 400);
    }
  }

  main?.setAttribute('inert', '');
  document.body.setAttribute('aria-busy', 'true');
  document.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });

  const windowReady = document.readyState === 'complete'
    ? Promise.resolve()
    : new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
  const imagesReady = [...document.images].map(image => {
    if (image.decode) return image.decode().catch(() => {});
    if (image.complete) return Promise.resolve();
    return new Promise(resolve => {
      image.addEventListener('load', resolve, { once: true });
      image.addEventListener('error', resolve, { once: true });
    });
  });
  const videoReady = videos.map(video => {
    if (reducedMotion.matches || navigator.connection?.saveData) return Promise.resolve();
    return new Promise(resolve => {
      const events = ['loadeddata', 'error', 'abort', 'suspend'];
      function checkVideo(event) {
        const suspended = event?.type === 'suspend' && video.readyState >= 1;
        if (video.readyState < 2 && !video.error && !suspended && event?.type !== 'abort') return;
        events.forEach(name => video.removeEventListener(name, checkVideo));
        resolve();
      }
      events.forEach(name => video.addEventListener(name, checkVideo));
      video.preload = 'auto';
      if (!video.getAttribute('src')) video.src = video.dataset.file;
      checkVideo();
    });
  });

  Promise.allSettled([windowReady, document.fonts?.ready, reviewNavigationReady, ...imagesReady, ...videoReady])
    .then(finishLoading);

  window.addEventListener('scroll', requestBackgroundUpdate, { passive: true });
  window.addEventListener('resize', requestBackgroundUpdate, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(requestBackgroundUpdate).observe(document.body);
  reducedMotion.addEventListener('change', () => { if (pageReady) revealPage(); });
  desktopViewport.addEventListener('change', () => { if (pageReady) revealPage(); });

  document.addEventListener('focusin', event => {
    const element = event.target.closest('.scroll-reveal');
    if (element) {
      element.classList.add('is-revealed');
      revealObserver?.unobserve(element);
    }
  });

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.hasAttribute('download') || (link.target && link.target !== '_self') || link.getAttribute('aria-disabled') === 'true') return;
    const destination = new URL(link.href, location.href);
    if (!['http:', 'https:'].includes(destination.protocol) || destination.origin !== location.origin) return;
    if (destination.pathname === location.pathname && destination.search === location.search) return;
    if (!destination.pathname.endsWith('/') && !destination.pathname.endsWith('.html')) return;
    if (reducedMotion.matches) return;
    event.preventDefault();
    if (navigating) return;
    navigating = true;
    root.classList.add('page-leaving');
    setTimeout(() => location.assign(destination.href), 200);
  });

  window.addEventListener('pageshow', event => {
    navigating = false;
    root.classList.remove('page-leaving');
    if (event.persisted) {
      if (menu.open) {
        closing = true;
        menu.classList.remove('is-open');
        finishClose();
      }
      requestBackgroundUpdate();
    }
  });
})();

function initializeColorWipes() {
  const selector = '.desktop-nav a, .menu nav a, .content-nav a, .footer-nav a, .social-links a, .music-inline-link, .webdesign-inline-link, .review-pagination a[href], .review-back-link, .review-hero__back, .footer > a';
  document.querySelectorAll(selector).forEach(link => {
    if (link.classList.contains('color-wipe') || link.getAttribute('aria-disabled') === 'true') return;
    const style = getComputedStyle(link);
    const overlay = document.createElement('span');
    overlay.className = 'color-wipe__overlay';
    overlay.setAttribute('aria-hidden', 'true');
    if (style.position === 'static') link.classList.add('color-wipe--relative');
    if (style.display === 'inline') link.classList.add('color-wipe--inline');
    if (link.matches('.footer > a')) {
      link.classList.add('color-wipe--logo');
    } else {
      link.childNodes.forEach(node => overlay.append(node.cloneNode(true)));
      overlay.querySelectorAll('[id]').forEach(element => element.removeAttribute('id'));
    }
    const base = document.createElement('span');
    base.className = 'color-wipe__base';
    base.append(...link.childNodes);
    link.classList.add('color-wipe');
    link.append(base, overlay);
  });
}
