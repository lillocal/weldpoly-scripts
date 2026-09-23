/**
 * Weldpoly — Spare Parts trailing card (item 29)
 * Permanent final card after CMS results on /spare-parts.
 * Placed AFTER the dyn-list wrapper so Finsweet empty-state (display:none on list)
 * never hides it. CTA → /contact-us?topic=spare-parts (prefills Message).
 */
(function () {
  'use strict';

  var CARD_ATTR = 'data-spare-trailing-card';
  var WRAP_ATTR = 'data-spare-trailing-wrap';
  var STYLE_ID = 'weldpoly-spare-trailing-style';
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
      '[' + WRAP_ATTR + ']{',
      'display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px;margin-top:16px;width:100%;',
      '}',
      '@media screen and (max-width:991px){',
      '[' + WRAP_ATTR + ']{grid-template-columns:repeat(2,minmax(0,1fr));}',
      '}',
      '@media screen and (max-width:767px){',
      '[' + WRAP_ATTR + ']{grid-template-columns:minmax(0,1fr);}',
      '}',
      '[' + CARD_ATTR + ']{display:flex;height:100%;min-height:16rem;}',
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
    item.className = 'spare-parts-trailing';
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

  function findListWrapper() {
    var list =
      document.querySelector('.section_products-list .cms_list.product-list') ||
      document.querySelector('.cms_list.product-list');
    if (!list) return null;
    return list.closest('.cms_list-wrapper') || list.parentElement;
  }

  function placeCard() {
    var wrap = findListWrapper();
    if (!wrap || !wrap.parentElement) return false;
    ensureStyles();

    var host = wrap.parentElement.querySelector('[' + WRAP_ATTR + ']');
    if (!host) {
      host = document.createElement('div');
      host.setAttribute(WRAP_ATTR, '');
      host.className = 'spare-trailing-wrap';
      wrap.insertAdjacentElement('afterend', host);
    } else if (host.previousElementSibling !== wrap) {
      wrap.insertAdjacentElement('afterend', host);
    }

    var card = host.querySelector('[' + CARD_ATTR + ']');
    if (!card) host.appendChild(buildCard());
    return true;
  }

  function watchList() {
    var wrap = findListWrapper();
    var list = wrap && (wrap.querySelector('.cms_list.product-list') || wrap.querySelector('.cms_list'));
    if (!list || list.__weldpolyTrailingObserved) return;
    list.__weldpolyTrailingObserved = true;
    new MutationObserver(function () {
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
