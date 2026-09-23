/**
 * Weldpoly — Spare Parts trailing card (item 29)
 * Last cell inside the product CMS grid on /spare-parts.
 * Re-appends after Finsweet filter/sort (which can wipe list children)
 * and forces the grid visible when the list would otherwise be empty.
 * CTA → /contact-us?topic=spare-parts (prefills Message).
 */
(function () {
  'use strict';

  var CARD_ATTR = 'data-spare-trailing-card';
  var STYLE_ID = 'weldpoly-spare-trailing-style';
  var FORCED_ATTR = 'data-spare-trailing-forced';
  var TOPIC = 'spare-parts';
  var CONTACT_PATH = '/contact-us';
  var PREFILL =
    "I'm looking for a spare part (or machine) that isn't listed on the Spare Parts page. Please help me track it down.";

  function pathIsSpareParts() {
    return /(?:^|\/)spare-parts\/?$/i.test(location.pathname.replace(/\.html$/i, ''));
  }

  function pathIsContact() {
    return /(?:^|\/)contact-us\/?$/i.test(location.pathname.replace(/\.html$/i, ''));
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = [
      /* legacy wrap from earlier placement — hide if any remain */
      '[data-spare-trailing-wrap]{display:none!important;}',
      '.cms_list.product-list [' + CARD_ATTR + ']{display:flex;height:100%;min-height:16rem;}',
      '.spare-trailing_card{',
      'display:flex;flex-direction:column;justify-content:center;align-items:flex-start;gap:1rem;',
      'box-sizing:border-box;width:100%;min-height:100%;padding:1.75rem 1.5rem;',
      'background:#fff;border:1px solid #dadde0;border-radius:16px;',
      '}',
      '.spare-trailing_title{',
      'margin:0;font-size:1.25rem;line-height:1.25;font-weight:700;letter-spacing:0.01em;color:#1c1c1c;',
      '}',
      '.spare-trailing_text{',
      'margin:0;font-size:0.95rem;line-height:1.45;color:#1c1c1c;opacity:0.85;max-width:28ch;',
      '}',
      '.spare-trailing_card .button{margin-top:0.25rem;}'
    ].join('');
    document.head.appendChild(st);
  }

  function buildCard() {
    var item = document.createElement('div');
    item.setAttribute(CARD_ATTR, '');
    item.className = 'cms_list-item spare-parts-trailing';
    item.setAttribute('role', 'listitem');

    var card = document.createElement('div');
    card.className = 'spare-trailing_card card_component';

    var title = document.createElement('h3');
    title.className = 'spare-trailing_title';
    title.textContent = 'Need Spare Parts?';

    var text = document.createElement('p');
    text.className = 'spare-trailing_text';
    text.textContent =
      "Can't find your machine, or the part you're after? Tell us what you need and we'll track it down.";

    var cta = document.createElement('a');
    cta.className = 'button w-button';
    cta.href = CONTACT_PATH + '?topic=' + encodeURIComponent(TOPIC);
    cta.textContent = 'Request a spare part';

    card.appendChild(title);
    card.appendChild(text);
    card.appendChild(cta);
    item.appendChild(card);
    return item;
  }

  function findList() {
    return (
      document.querySelector('.section_products-list .cms_list.product-list') ||
      document.querySelector('.cms_list.product-list') ||
      document.querySelector('.cms_list.w-dyn-items')
    );
  }

  function getOrCreateCard() {
    var existing = document.querySelector('[' + CARD_ATTR + ']');
    if (existing) return existing;
    return buildCard();
  }

  function syncListVisibility(list) {
    var dynCount = list.querySelectorAll('.w-dyn-item').length;
    if (dynCount > 0) {
      if (list.hasAttribute(FORCED_ATTR)) {
        list.style.removeProperty('display');
        list.removeAttribute(FORCED_ATTR);
      }
      return;
    }
    // No CMS results — keep the grid up so the trailing card stays in layout
    list.style.setProperty('display', 'grid', 'important');
    list.setAttribute(FORCED_ATTR, '1');
  }

  function placeCard() {
    var list = findList();
    if (!list) return false;
    ensureStyles();

    // Remove previous outside-grid placement
    document.querySelectorAll('[data-spare-trailing-wrap]').forEach(function (el) {
      el.remove();
    });

    var card = getOrCreateCard();
    if (list.lastElementChild !== card) list.appendChild(card);
    syncListVisibility(list);
    return true;
  }

  function watchList() {
    var list = findList();
    if (!list || list.__weldpolyTrailingObserved) return;
    list.__weldpolyTrailingObserved = true;
    new MutationObserver(function () {
      // Finsweet may wipe children or toggle display:none — restore card last
      placeCard();
    }).observe(list, { childList: true, attributes: true, attributeFilter: ['style', 'class'] });
  }

  function prefillContactForm() {
    var params = new URLSearchParams(location.search);
    if (params.get('topic') !== TOPIC) return;
    var message =
      document.querySelector('textarea[name="Message"], textarea#Message, textarea[data-name="Message"]') ||
      document.querySelector('form textarea');
    if (!message) return;
    if (!(message.value || '').trim()) message.value = PREFILL;
    try {
      message.dispatchEvent(new Event('input', { bubbles: true }));
      message.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (_) {}
  }

  function boot() {
    if (pathIsSpareParts()) {
      if (!placeCard()) {
        var tries = 0;
        var t = setInterval(function () {
          tries += 1;
          if (placeCard() || tries > 40) {
            clearInterval(t);
            watchList();
          }
        }, 250);
      } else {
        watchList();
      }
    }
    if (pathIsContact()) prefillContactForm();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
  window.addEventListener('load', function () {
    if (pathIsSpareParts()) {
      placeCard();
      watchList();
    }
    if (pathIsContact()) prefillContactForm();
  });
})();
