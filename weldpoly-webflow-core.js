/**
 * Weldpoly Webflow Core - Unified Script
 *
 * Combines three scripts in one:
 * 1. Lenis Scroll Control - enable/disable scroll in sections
 * 2. Locomotive Scroll Init - initializes Locomotive with Lenis
 * 3. Content Reveal - GSAP ScrollTrigger reveal animations
 *
 * Requires (load before):
 * - Locomotive Scroll: https://cdn.jsdelivr.net/npm/locomotive-scroll@beta/bundled/locomotive-scroll.min.js
 * - GSAP + ScrollTrigger: https://cdn.prod.website-files.com/gsap/3.14.2/gsap.min.js, ScrollTrigger.min.js
 *
 * URL: https://cdn.jsdelivr.net/gh/francastudio/weldpoly-scripts@main/weldpoly-webflow-core.js
 */
(function() {
  'use strict';

  // ============================================================================
  // 1. LOCOMOTIVE SCROLL INIT
  // ============================================================================
  if (typeof LocomotiveScroll !== 'undefined') {
    window.locomotiveScroll = new LocomotiveScroll({
      lenisOptions: {
        lerp: 0.1,
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t))
      }
    });
  } else {
    console.warn('[Weldpoly] weldpoly-webflow-core: LocomotiveScroll not loaded');
  }

  // ============================================================================
  // 2. LENIS SCROLL CONTROL
  // ============================================================================
  (function() {
    let lenisInstance = null;
    let scrollControlInitialized = false;
    const disabledSections = new WeakSet();
    const scrollHandlers = new WeakMap();

    function getLenisInstance() {
      if (lenisInstance) return lenisInstance;
      if (typeof window.Lenis !== 'undefined' && window.lenis) lenisInstance = window.lenis;
      else if (window.scroll && window.scroll.lenis) lenisInstance = window.scroll.lenis;
      else if (window.locomotiveScroll && window.locomotiveScroll.lenis) lenisInstance = window.locomotiveScroll.lenis;
      return lenisInstance;
    }

    function allowsNestedScroll(target, root) {
      let el = target && target.nodeType === 1 ? target : target && target.parentElement;
      while (el && el !== root) {
        if (el.hasAttribute && (
          el.hasAttribute('data-lenis-prevent') ||
          el.hasAttribute('data-lenis-prevent-wheel') ||
          el.getAttribute('data-lenis-scroll') === 'enabled'
        )) {
          return true;
        }
        el = el.parentElement;
      }
      return false;
    }

    function disableScrollForElement(element) {
      if (!element || disabledSections.has(element)) return;
      disabledSections.add(element);
      // Do not block wheel/touch inside nested scroll regions (e.g. quote modal list).
      // Calling preventDefault on body/html was killing native overflow scroll there.
      const blockUnlessNested = (e) => {
        if (!element.contains(e.target)) return;
        if (allowsNestedScroll(e.target, element)) return;
        e.preventDefault();
        e.stopPropagation();
        return false;
      };
      scrollHandlers.set(element, { wheel: blockUnlessNested, touch: blockUnlessNested });
      element.addEventListener('wheel', blockUnlessNested, { passive: false, capture: true });
      element.addEventListener('touchmove', blockUnlessNested, { passive: false, capture: true });
      element.style.overflow = 'hidden';
      element.style.overscrollBehavior = 'none';
    }

    function enableScrollForElement(element) {
      if (!element || !disabledSections.has(element)) return;
      disabledSections.delete(element);
      const handlers = scrollHandlers.get(element);
      if (handlers) {
        element.removeEventListener('wheel', handlers.wheel, { capture: true });
        element.removeEventListener('touchmove', handlers.touch, { capture: true });
        scrollHandlers.delete(element);
      }
      element.style.overflow = '';
      element.style.overscrollBehavior = '';
    }

    function initScrollControl() {
      document.querySelectorAll('[data-lenis-scroll]').forEach(el => {
        if (el.getAttribute('data-lenis-scroll') === 'disabled') disableScrollForElement(el);
        else if (el.getAttribute('data-lenis-scroll') === 'enabled') enableScrollForElement(el);
      });
    }

    function watchForNewElements() {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach(m => m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          if (node.hasAttribute && node.getAttribute('data-lenis-scroll') === 'disabled') disableScrollForElement(node);
          (node.querySelectorAll ? node.querySelectorAll('[data-lenis-scroll="disabled"]') : []).forEach(disableScrollForElement);
        }));
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    window.disableLenisScroll = function(selector) {
      const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
      if (el) { disableScrollForElement(el); el.setAttribute('data-lenis-scroll', 'disabled'); }
    };
    window.enableLenisScroll = function(selector) {
      const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
      if (el) { enableScrollForElement(el); el.setAttribute('data-lenis-scroll', 'enabled'); }
    };
    window.toggleLenisScroll = function(selector) {
      const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
      if (!el) return;
      if (disabledSections.has(el)) window.enableLenisScroll(el); else window.disableLenisScroll(el);
    };
    window.isLenisScrollDisabled = function(selector) {
      const el = typeof selector === 'string' ? document.querySelector(selector) : selector;
      return el ? disabledSections.has(el) : false;
    };

    function init() {
      if (scrollControlInitialized) return;
      scrollControlInitialized = true;
      const check = setInterval(() => {
        if (getLenisInstance() || document.readyState === 'complete') {
          clearInterval(check);
          initScrollControl();
          watchForNewElements();
        }
      }, 100);
      if (document.readyState !== 'loading') { initScrollControl(); watchForNewElements(); }
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
    if (typeof Webflow !== 'undefined') Webflow.push(function() { if (!scrollControlInitialized) init(); });
  })();

  // ============================================================================
  // 3. CONTENT REVEAL (GSAP ScrollTrigger)
  // ============================================================================
  (function() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      console.warn('[Weldpoly] weldpoly-webflow-core: GSAP or ScrollTrigger not loaded');
      return;
    }
    gsap.registerPlugin(ScrollTrigger);

    function initContentRevealScroll() {
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const ctx = gsap.context(() => {
        document.querySelectorAll('[data-reveal-group]').forEach(groupEl => {
          const groupStaggerSec = (parseFloat(groupEl.getAttribute('data-stagger')) || 100) / 1000;
          const groupDistance = groupEl.getAttribute('data-distance') || '2em';
          const triggerStart = groupEl.getAttribute('data-start') || 'top 80%';
          const animDuration = 0.8;
          const animEase = 'power4.inOut';

          if (prefersReduced) {
            gsap.set(groupEl, { clearProps: 'all', y: 0, autoAlpha: 1 });
            return;
          }

          const directChildren = Array.from(groupEl.children).filter(el => el.nodeType === 1);
          if (!directChildren.length) {
            gsap.set(groupEl, { y: groupDistance, autoAlpha: 0 });
            ScrollTrigger.create({
              trigger: groupEl,
              start: triggerStart,
              once: true,
              onEnter: () => gsap.to(groupEl, {
                y: 0,
                autoAlpha: 1,
                duration: animDuration,
                ease: animEase,
                onComplete: () => gsap.set(groupEl, { clearProps: 'all' })
              })
            });
            return;
          }

          const slots = [];
          directChildren.forEach(child => {
            const nestedGroup = child.matches('[data-reveal-group-nested]')
              ? child
              : child.querySelector(':scope [data-reveal-group-nested]');

            if (nestedGroup) {
              const includeParent = child.getAttribute('data-ignore') === 'false' || nestedGroup.getAttribute('data-ignore') === 'false';
              slots.push({ type: 'nested', parentEl: child, nestedEl: nestedGroup, includeParent });
            } else {
              slots.push({ type: 'item', el: child });
            }
          });

          slots.forEach(slot => {
            if (slot.type === 'item') {
              const isNestedSelf = slot.el.matches('[data-reveal-group-nested]');
              const d = isNestedSelf ? groupDistance : (slot.el.getAttribute('data-distance') || groupDistance);
              gsap.set(slot.el, { y: d, autoAlpha: 0 });
            } else {
              if (slot.includeParent) gsap.set(slot.parentEl, { y: groupDistance, autoAlpha: 0 });
              const nestedD = slot.nestedEl.getAttribute('data-distance') || groupDistance;
              Array.from(slot.nestedEl.children).forEach(target => gsap.set(target, { y: nestedD, autoAlpha: 0 }));
            }
          });

          slots.forEach(slot => {
            if (slot.type === 'nested' && slot.includeParent) gsap.set(slot.parentEl, { y: groupDistance });
          });

          ScrollTrigger.create({
            trigger: groupEl,
            start: triggerStart,
            once: true,
            onEnter: () => {
              const tl = gsap.timeline();
              slots.forEach((slot, slotIndex) => {
                const slotTime = slotIndex * groupStaggerSec;
                if (slot.type === 'item') {
                  tl.to(slot.el, {
                    y: 0,
                    autoAlpha: 1,
                    duration: animDuration,
                    ease: animEase,
                    onComplete: () => gsap.set(slot.el, { clearProps: 'all' })
                  }, slotTime);
                } else {
                  if (slot.includeParent) {
                    tl.to(slot.parentEl, {
                      y: 0,
                      autoAlpha: 1,
                      duration: animDuration,
                      ease: animEase,
                      onComplete: () => gsap.set(slot.parentEl, { clearProps: 'all' })
                    }, slotTime);
                  }
                  const nestedMs = parseFloat(slot.nestedEl.getAttribute('data-stagger'));
                  const nestedStaggerSec = isNaN(nestedMs) ? groupStaggerSec : nestedMs / 1000;
                  Array.from(slot.nestedEl.children).forEach((nestedChild, nestedIndex) => {
                    tl.to(nestedChild, {
                      y: 0,
                      autoAlpha: 1,
                      duration: animDuration,
                      ease: animEase,
                      onComplete: () => gsap.set(nestedChild, { clearProps: 'all' })
                    }, slotTime + nestedIndex * nestedStaggerSec);
                  });
                }
              });
            }
          });
        });
      });
      return () => ctx.revert();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initContentRevealScroll);
    } else {
      initContentRevealScroll();
    }
  })();
})();
