/**
 * Weldpoly — Product “Need spare parts?” (item 30)
 * - Moves the Spare Parts accordion to the bottom of the product sub-header list
 * - Adds a top-of-page “Need spare parts?” control on every machine page
 * - With real parts loaded → anchors to #spare-parts (opens accordion)
 * - Without → /contact-us?topic=spare-parts (same request form as Spare Parts trailing card)
 * Behaviour is automatic from DOM, not configured per machine.
 */
(function () {
  'use strict';

  var STYLE_ID = 'weldpoly-need-spare-style';
  var BTN_ATTR = 'data-need-spare-parts';
  var SECTION_ID = 'spare-parts';
  var CONTACT_HREF = '/contact-us?topic=spare-parts';

  function isProductPage() {
    return /(?:^|\/)products\//i.test(location.pathname);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = [
      '[' + BTN_ATTR + ']{',
      'display:inline-flex;align-items:center;justify-content:center;',
      'margin-top:1rem;margin-bottom:0.25rem;',
      '}',
      '.product-header1_accordion[' + 'data-spare-section' + ']{scroll-margin-top:6rem;}'
    ].join('');
    document.head.appendChild(st);
  }

  function findAccordionWrapper() {
    return document.querySelector('.product-header1_accordion-wrapper');
  }

  function findSpareAccordion(wrapper) {
    if (!wrapper) return null;
    var items = [...wrapper.querySelectorAll(':scope > .product-header1_accordion')];
    return (
      items.find(function (el) {
        var label = (el.querySelector('.text-size-regular, .product-header1_heading')?.textContent || '')
          .replace(/\s+/g, ' ')
          .trim()
          .toLowerCase();
        return /^spare parts\b/.test(label) || label.indexOf('spare parts') === 0;
      }) || null
    );
  }

  function countRealSpareParts(scope) {
    var root = scope || document;
    return [...root.querySelectorAll('[spare-part-item]')].filter(function (el) {
      if (el.closest('.w-condition-invisible')) return false;
      var title = (
        el.getAttribute('spare-part-item') ||
        el.querySelector('.spare-part-name')?.textContent ||
        ''
      )
        .replace(/\s+/g, ' ')
        .trim();
      if (!title || /^other$/i.test(title) || /something else/i.test(title)) return false;
      var cs = window.getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      return true;
    }).length;
  }

  function hasLoadedSpareParts(spareAccordion) {
    if (!spareAccordion) return countRealSpareParts(document) > 0;
    if (spareAccordion.classList.contains('w-condition-invisible')) return false;
    return countRealSpareParts(spareAccordion) > 0;
  }

  function moveSpareToBottom(wrapper, spareAccordion) {
    if (!wrapper || !spareAccordion) return;
    spareAccordion.setAttribute('data-spare-section', '');
    spareAccordion.id = SECTION_ID;
    if (wrapper.lastElementChild !== spareAccordion) {
      wrapper.appendChild(spareAccordion);
    }
  }

  function openSpareAccordion(spareAccordion) {
    if (!spareAccordion) return;
    // Relume/Webflow accordions often toggle via click on heading
    var heading = spareAccordion.querySelector('.product-header1_heading');
    var details = spareAccordion.querySelector('.product-header1_details');
    var alreadyOpen =
      (details && window.getComputedStyle(details).display !== 'none' && details.offsetHeight > 0) ||
      spareAccordion.classList.contains('is-open') ||
      spareAccordion.getAttribute('aria-expanded') === 'true';
    if (!alreadyOpen && heading) {
      heading.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
    }
  }

  function findButtonHost() {
    var details = document.querySelector('.product-header1_product-details');
    if (!details) return null;
    // Prefer after the short description paragraph, before the accordion block
    var desc = details.querySelector('p.heading-style-h5, .heading-style-h5');
    if (desc) return { parent: desc.parentElement === details ? details : desc.parentElement, after: desc };
    var h1Wrap = details.querySelector('h1')?.closest('.margin-bottom, div');
    if (h1Wrap && h1Wrap.parentElement === details) return { parent: details, after: h1Wrap };
    var h1 = details.querySelector('h1');
    if (h1) return { parent: h1.parentElement || details, after: h1 };
    return { parent: details, after: details.firstElementChild };
  }

  function ensureButton(hasParts) {
    ensureStyles();
    var existing = document.querySelector('[' + BTN_ATTR + ']');
    var btn = existing;
    if (!btn) {
      var host = findButtonHost();
      if (!host || !host.parent) return null;
      btn = document.createElement('a');
      btn.setAttribute(BTN_ATTR, '');
      btn.className = 'button is-secondary w-inline-block';
      btn.textContent = 'Need spare parts?';
      if (host.after && host.after.parentElement === host.parent) {
        host.after.insertAdjacentElement('afterend', btn);
      } else {
        host.parent.appendChild(btn);
      }
    }

    if (hasParts) {
      btn.setAttribute('href', '#' + SECTION_ID);
      btn.onclick = function (e) {
        var target = document.getElementById(SECTION_ID);
        if (!target) return;
        e.preventDefault();
        openSpareAccordion(target);
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        try {
          history.replaceState(null, '', '#' + SECTION_ID);
        } catch (_) {}
      };
    } else {
      btn.setAttribute('href', CONTACT_HREF);
      btn.onclick = null;
    }
    return btn;
  }

  function handleHash() {
    if (location.hash.replace(/^#/, '') !== SECTION_ID) return;
    var target = document.getElementById(SECTION_ID);
    if (!target) return;
    openSpareAccordion(target);
    setTimeout(function () {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function run() {
    if (!isProductPage()) return;
    var wrapper = findAccordionWrapper();
    var spareAccordion = findSpareAccordion(wrapper);
    moveSpareToBottom(wrapper, spareAccordion);
    var hasParts = hasLoadedSpareParts(spareAccordion);
    ensureButton(hasParts);
    handleHash();
  }

  function boot() {
    run();
    // CMS/conditions + spare-parts injector may settle late
    setTimeout(run, 400);
    setTimeout(run, 1200);
    setTimeout(run, 2500);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.addEventListener('load', boot);
  window.addEventListener('hashchange', handleHash);
})();
