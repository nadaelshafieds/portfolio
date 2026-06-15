// Smooth reveal on scroll — section titles / headings
const titleObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.section-title, .toc-main-title, .project-header-title, .contact-heading, .thank-you-heading').forEach(el => {
  el.style.cssText += 'opacity:0;transform:translateY(30px);transition:opacity 0.9s ease,transform 0.9s ease;';
  titleObserver.observe(el);
});

// Nav shadow on scroll
window.addEventListener('scroll', () => {
  const nav = document.querySelector('nav');
  nav.style.boxShadow = window.scrollY > 40 ? '0 2px 20px rgba(44,26,14,0.08)' : 'none';
});

// ═══════════════════════════════════════════════════════
// SLIDESHOW ENGINE
// ═══════════════════════════════════════════════════════
(function initSlideshows() {
  document.querySelectorAll('.slideshow-stage').forEach(stage => {
    const track = stage.querySelector('.slides-track');
    const slides = Array.from(track.querySelectorAll('.slide'));
    const prevBtn = stage.querySelector('.slide-btn-prev');
    const nextBtn = stage.querySelector('.slide-btn-next');
    const dotsWrap = stage.querySelector('.slide-dots');

    const block = stage.closest('.slideshow-block');
    const currentEl = block ? block.querySelector('.slide-current') : null;
    const totalEl = block ? block.querySelector('.slide-total') : null;

    const total = slides.length;
    let current = 0;
    let autoTimer = null;
    const interval = parseInt(stage.dataset.interval, 10) || 4000;

    // Build dots
    if (dotsWrap && total > 1) {
      slides.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.className = 'slide-dot' + (i === 0 ? ' active' : '');
        dot.setAttribute('aria-label', `Go to slide ${i + 1}`);
        dot.addEventListener('click', () => goTo(i));
        dotsWrap.appendChild(dot);
      });
    }

    if (totalEl) totalEl.textContent = total;

    if (total <= 1) {
      if (prevBtn) prevBtn.style.display = 'none';
      if (nextBtn) nextBtn.style.display = 'none';
    }

    function goTo(idx) {
      slides[current].classList.remove('active');
      if (dotsWrap) dotsWrap.querySelectorAll('.slide-dot')[current]?.classList.remove('active');
      current = (idx + total) % total;
      slides[current].classList.add('active');
      if (dotsWrap) dotsWrap.querySelectorAll('.slide-dot')[current]?.classList.add('active');
      if (currentEl) currentEl.textContent = current + 1;
    }

    function startAuto() {
      if (total <= 1) return;
      autoTimer = setInterval(() => goTo(current + 1), interval);
    }

    function resetAuto() {
      clearInterval(autoTimer);
      startAuto();
    }

    if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); goTo(current - 1); resetAuto(); });
    if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); goTo(current + 1); resetAuto(); });

    // Touch / swipe
    let touchStartX = 0;
    stage.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].clientX; }, { passive: true });
    stage.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(dx) > 40) { goTo(dx < 0 ? current + 1 : current - 1); resetAuto(); }
    }, { passive: true });

    stage.addEventListener('mouseenter', () => clearInterval(autoTimer));
    stage.addEventListener('mouseleave', startAuto);

    // ── Click image to open lightbox ──
    stage.addEventListener('click', (e) => {
      // Don't open lightbox if clicking nav buttons
      if (e.target.closest('.slide-btn')) return;
      const activeSlide = track.querySelector('.slide.active');
      if (!activeSlide) return;
      const img = activeSlide.querySelector('img');
      if (!img) return;

      // Collect all images in this slideshow
      const allImgs = slides.map(s => ({
        src: s.querySelector('img')?.src || '',
        alt: s.querySelector('img')?.alt || ''
      }));
      openLightbox(current, allImgs);
    });

    goTo(0);
    startAuto();
  });
})();


// ═══════════════════════════════════════════════════════
// LIGHTBOX with pinch-to-zoom
// ═══════════════════════════════════════════════════════
(function setupLightbox() {
  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'lightbox-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <button class="lbx-close" aria-label="Close">&times;</button>
    <button class="lbx-prev" aria-label="Previous">&#8249;</button>
    <button class="lbx-next" aria-label="Next">&#8250;</button>
    <div class="lbx-figure">
      <img class="lbx-img" src="" alt="">
    </div>
    <div class="lbx-counter"></div>
    <div class="lbx-hint">Pinch or scroll to zoom &nbsp;·&nbsp; tap outside to close</div>
  `;
  document.body.appendChild(overlay);

  const lbxImg = overlay.querySelector('.lbx-img');
  const counterEl = overlay.querySelector('.lbx-counter');
  const closeBtn = overlay.querySelector('.lbx-close');
  const prevBtn = overlay.querySelector('.lbx-prev');
  const nextBtn = overlay.querySelector('.lbx-next');
  const figure = overlay.querySelector('.lbx-figure');

  let images = [];
  let currentIdx = 0;

  // ── Zoom state ──────────────────────────────────────
  let scale = 1;
  let originX = 0, originY = 0;
  let isDragging = false;
  let dragStartX = 0, dragStartY = 0;
  let translateX = 0, translateY = 0;

  function applyTransform() {
    lbxImg.style.transform = `scale(${scale}) translate(${translateX / scale}px, ${translateY / scale}px)`;
  }

  function resetZoom() {
    scale = 1; translateX = 0; translateY = 0;
    applyTransform();
  }

  // ── Render ───────────────────────────────────────────
  function render() {
    const item = images[currentIdx];
    lbxImg.src = item.src;
    lbxImg.alt = item.alt;
    counterEl.textContent = `${currentIdx + 1} / ${images.length}`;
    resetZoom();
  }

  // ── Open / close ─────────────────────────────────────
  window.openLightbox = function (idx, imgs) {
    images = imgs;
    currentIdx = idx;
    render();
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  };

  function closeLightbox() {
    overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    resetZoom();
  }

  function showPrev() { currentIdx = (currentIdx - 1 + images.length) % images.length; render(); }
  function showNext() { currentIdx = (currentIdx + 1) % images.length; render(); }

  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', showPrev);
  nextBtn.addEventListener('click', showNext);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target === figure) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (!overlay.classList.contains('is-open')) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') showPrev();
    if (e.key === 'ArrowRight') showNext();
    if (e.key === '+') { scale = Math.min(scale + 0.3, 5); applyTransform(); }
    if (e.key === '-') { scale = Math.max(scale - 0.3, 1); if (scale === 1) resetZoom(); else applyTransform(); }
  });

  // ── Mouse wheel zoom ─────────────────────────────────
  figure.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    scale = Math.min(Math.max(scale + delta, 1), 5);
    if (scale === 1) resetZoom(); else applyTransform();
  }, { passive: false });

  // ── Mouse drag (when zoomed) ──────────────────────────
  lbxImg.addEventListener('mousedown', (e) => {
    if (scale <= 1) return;
    isDragging = true;
    dragStartX = e.clientX - translateX;
    dragStartY = e.clientY - translateY;
    lbxImg.style.cursor = 'grabbing';
    e.preventDefault();
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    translateX = e.clientX - dragStartX;
    translateY = e.clientY - dragStartY;
    applyTransform();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
    lbxImg.style.cursor = scale > 1 ? 'grab' : 'default';
  });

  // ── Pinch-to-zoom (touch) ────────────────────────────
  let lastTouchDist = null;
  let touchSwipeStartX = 0;
  let touchMoved = false;

  figure.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      lastTouchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    } else if (e.touches.length === 1) {
      touchSwipeStartX = e.touches[0].clientX;
      touchMoved = false;
    }
  }, { passive: true });

  figure.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      if (lastTouchDist) {
        const ratio = dist / lastTouchDist;
        scale = Math.min(Math.max(scale * ratio, 1), 5);
        applyTransform();
      }
      lastTouchDist = dist;
    } else if (e.touches.length === 1 && scale > 1) {
      e.preventDefault();
      translateX += e.touches[0].clientX - touchSwipeStartX;
      touchSwipeStartX = e.touches[0].clientX;
      applyTransform();
      touchMoved = true;
    }
  }, { passive: false });

  figure.addEventListener('touchend', (e) => {
    lastTouchDist = null;
    // Swipe left/right only when not zoomed and not dragging
    if (scale <= 1 && !touchMoved && e.changedTouches.length === 1) {
      const dx = e.changedTouches[0].clientX - touchSwipeStartX;
      if (Math.abs(dx) > 50) { dx < 0 ? showNext() : showPrev(); }
    }
    if (scale <= 1) resetZoom();
  }, { passive: true });

  // Double-tap to toggle zoom
  let lastTap = 0;
  figure.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTap < 300) {
      scale = scale > 1 ? 1 : 2.5;
      if (scale === 1) resetZoom(); else applyTransform();
    }
    lastTap = now;
  }, { passive: true });
})();