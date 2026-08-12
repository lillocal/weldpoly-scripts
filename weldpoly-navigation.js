/**
 * Weldpoly Navigation — Unified script
 * Only acts on scroll or menu open. Initial state: component CSS (variants).
 *
 * 1) Centered Nav: [data-navigation-toggle="toggle"], [data-navigation-toggle="close"]
 *    [data-navigation-status] active/not-active. ESC closes.
 * 2) Scroll Background: Add .nav--scrolled to .navigation when user scrolls down.
 * 3) Scroll Hide/Show: Add .nav--hidden when scrolling down, remove when scrolling up.
 */
(function() {
  'use strict';

  // ===== 1) Centered Scaling Navigation Bar =====
  function initCenteredScalingNavigationBar() {
    const navigationInnerItems = document.querySelectorAll('[data-navigation-item]');
    navigationInnerItems.forEach((item, index) => {
      item.style.transitionDelay = `${index * 0.05}s`;
    });

    const getNavStatusEl = () => document.querySelector('[data-navigation-status]');

    const setNavStatus = (status) => {
      const navStatusEl = getNavStatusEl();
      if (!navStatusEl) return;
      navStatusEl.setAttribute('data-navigation-status', status);
      // Dark overlay should only capture clicks while the menu is open
      document.querySelectorAll('.navigation__dark-bg').forEach((el) => {
        el.style.pointerEvents = status === 'active' ? 'auto' : 'none';
      });
    };

    // Ensure closed menu never blocks the toggle hit-target
    setNavStatus(getNavStatusEl()?.getAttribute('data-navigation-status') || 'not-active');

    // Single delegated handler — avoids double-toggle when nested elements
    // also carry data-navigation-toggle (e.g. MENU label inside the button).
    document.addEventListener('click', (e) => {
      const toggleBtn = e.target.closest('[data-navigation-toggle="toggle"]');
      if (toggleBtn) {
        e.preventDefault();
        e.stopPropagation();
        const navStatusEl = getNavStatusEl();
        if (!navStatusEl) return;
        const next = navStatusEl.getAttribute('data-navigation-status') === 'not-active' ? 'active' : 'not-active';
        setNavStatus(next);
        return;
      }

      const closeBtn = e.target.closest('[data-navigation-toggle="close"]');
      if (closeBtn) {
        // Don't treat nested toggle clicks as close
        if (e.target.closest('[data-navigation-toggle="toggle"]')) return;
        setNavStatus('not-active');
      }
    }, true);

    document.addEventListener('keydown', e => {
      if (e.keyCode === 27) {
        const navStatusEl = getNavStatusEl();
        if (!navStatusEl) return;
        if (navStatusEl.getAttribute('data-navigation-status') === 'active') {
          setNavStatus('not-active');
        }
      }
    });

    // Make the whole toggle button (and label) receive clicks
    document.querySelectorAll('.centered-nav__toggle, [data-navigation-toggle="toggle"]').forEach((el) => {
      el.style.pointerEvents = 'auto';
      el.style.cursor = 'pointer';
      if (el.matches('.centered-nav__toggle')) {
        el.style.position = el.style.position || 'relative';
        el.style.zIndex = '20';
      }
      el.querySelectorAll('*').forEach((child) => {
        child.style.pointerEvents = 'none';
      });
    });
  }

  // ===== 2) Nav Scroll Background =====
  const SCROLL_THRESHOLD = 60;

  function getScrollY() {
    if (typeof window === 'undefined') return 0;
    const ls = window.locomotiveScroll || window.scroll?.locomotive;
    if (ls && ls.lenis && typeof ls.lenis.scroll === 'number') return ls.lenis.scroll;
    return window.scrollY || window.pageYOffset || document.documentElement.scrollTop || 0;
  }

  function initNavScrollBackground() {
    const nav = document.querySelector('.navigation');
    if (!nav) return;

    let isScrolled = false;

    const update = () => {
      const scrollY = getScrollY();
      const shouldBeScrolled = scrollY > SCROLL_THRESHOLD;
      if (shouldBeScrolled !== isScrolled) {
        isScrolled = shouldBeScrolled;
        nav.classList.toggle('nav--scrolled', isScrolled);
      }
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('load', update);

    const hookLenis = () => {
      const ls = window.locomotiveScroll || window.scroll?.locomotive;
      if (ls && ls.lenis) {
        ls.lenis.on('scroll', update);
        return true;
      }
      return false;
    };
    if (!hookLenis()) {
      document.addEventListener('DOMContentLoaded', () => hookLenis());
      setTimeout(() => hookLenis(), 1500);
    }
  }

  // ===== 3) Nav Scroll Hide/Show =====
  const SCROLL_HIDE_TOP_THRESHOLD = 80;
  const SCROLL_HIDE_DELTA = 50;

  function initNavScrollHide() {
    const nav = document.querySelector('.navigation');
    if (!nav) return;

    let lastScrollY = getScrollY();
    let isHidden = false;

    const update = () => {
      if (document.querySelector('[data-navigation-status="active"]')) return;

      const scrollY = getScrollY();

      if (scrollY <= SCROLL_HIDE_TOP_THRESHOLD) {
        if (isHidden) {
          isHidden = false;
          nav.classList.remove('nav--hidden');
        }
        lastScrollY = scrollY;
        return;
      }

      const delta = scrollY - lastScrollY;

      if (delta > SCROLL_HIDE_DELTA) {
        lastScrollY = scrollY;
        if (!isHidden) {
          isHidden = true;
          nav.classList.add('nav--hidden');
        }
      } else if (delta < -SCROLL_HIDE_DELTA) {
        lastScrollY = scrollY;
        if (isHidden) {
          isHidden = false;
          nav.classList.remove('nav--hidden');
        }
      }
    };

    let scrollTicking = false;
    const onScroll = () => {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(() => {
        update();
        scrollTicking = false;
      });
    };

    lastScrollY = getScrollY();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('load', () => { lastScrollY = getScrollY(); });

    const hookLenis = () => {
      const ls = window.locomotiveScroll || window.scroll?.locomotive;
      if (ls && ls.lenis) {
        ls.lenis.on('scroll', () => {
          requestAnimationFrame(update);
        });
        return true;
      }
      return false;
    };
    if (!hookLenis()) {
      document.addEventListener('DOMContentLoaded', () => hookLenis());
      setTimeout(() => hookLenis(), 1500);
    }
  }

  // ===== Init =====
  function init() {
    initCenteredScalingNavigationBar();
    initNavScrollBackground();
    initNavScrollHide();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
