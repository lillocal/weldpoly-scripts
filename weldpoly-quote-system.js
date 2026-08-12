/** Weldpoly Quote System — cart, modal, products | CDN: cdn.jsdelivr.net/gh/lillocal/weldpoly-scripts@main/weldpoly-quote-system.js */
(function(){
'use strict';
const CART_KEY='quoteCart',CART_SAVED_AT_KEY='quoteCartSavedAt',CART_TTL_MS=36e5;
// GA4 conversion config — fired on the success page after a confirmed quote submission.
// Adjust value/currency to match the Google Ads conversion you want to report.
const GA4_LEAD_EVENT='generate_lead',GA4_LEAD_CURRENCY='AUD',GA4_LEAD_VALUE=1;
// Flag set on the quote form submit and read on the success page. Captured at load
// time (before the success page's own script clears it) so the conversion is reliable.
const QUOTE_SUBMIT_FLAG='quoteSubmitted';
let cameFromQuoteSubmit=false;
try{cameFromQuoteSubmit=sessionStorage.getItem(QUOTE_SUBMIT_FLAG)==='true';}catch(_){}
let systemInitialized=false;

  function initQuoteSystem() {
    if (systemInitialized) return;
    systemInitialized = true;

    // Style for Other spare-part description field in quote cart
    if (!document.getElementById('quote-other-desc-style')) {
      const st = document.createElement('style');
      st.id = 'quote-other-desc-style';
      st.textContent = '[data-quote-other-description]{display:block;width:100%;margin-top:0.35rem;padding:0.5rem 0.65rem;border:1px solid rgba(0,0,0,0.18);border-radius:4px;font:inherit;line-height:1.35;background:#fff;color:inherit;box-sizing:border-box;}[data-quote-other-description]:focus{outline:2px solid rgba(0,0,0,0.35);outline-offset:1px;}';
      document.head.appendChild(st);
    }

    const modalGroup = document.querySelector('[data-modal-group-status]');
    const quoteModal = document.querySelector('[data-modal-name="quote-modal"]');
    const quoteContent = quoteModal?.querySelector('.quote_modal-content');
    const templateItem = quoteModal?.querySelector('[data-quote-item]');
    const templatePartItem = quoteModal?.querySelector('[data-quote-part-item]');
    const titleEl = quoteModal?.querySelector('.quote_header-title');
    const emptyState = quoteModal?.querySelector('[quote-empty]') || quoteModal?.querySelector('.quote_empty-wrapper');
    const actionsBlock = quoteModal?.querySelector('.quote_modal-content-bottom');
    let cart = [];

    function isOtherSparePart(item) {
      return !!(item && item.isSparePart && ((item.title || '').trim().toLowerCase() === 'other'));
    }

    function attachOtherDescriptionField(descNode, item, opts) {
      if (!descNode) return null;
      const focus = !!(opts && opts.focus);
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 200;
      input.className = ((descNode.className || '') + ' quote_other-description').trim();
      input.setAttribute('data-quote-other-description', '');
      input.setAttribute('aria-label', 'Describe the part you need');
      input.placeholder = 'Describe the part you need (one sentence)';
      input.value = item.description || '';
      input.addEventListener('input', () => {
        item.description = input.value;
        if (item.description.trim()) delete item.needsOtherDescription;
        saveCart({ silent: true });
      });
      input.addEventListener('blur', () => {
        item.description = (input.value || '').trim();
        if (item.description) delete item.needsOtherDescription;
        saveCart({ silent: true });
        renderRequestQuotePageList();
      });
      descNode.replaceWith(input);
      // Hide leftover part template description lines for Other
      const content = input.closest('.quote_item_content');
      if (content) {
        content.querySelectorAll('[data-quote-part-code], [data-quote-part-machine]').forEach((el) => {
          if (el !== input) el.style.display = 'none';
        });
      }
      if (focus || item.needsOtherDescription) {
        setTimeout(() => { try { input.focus(); } catch (_) {} }, 50);
      }
      return input;
    }


    function saveCart(opts) {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      try { localStorage.setItem(CART_SAVED_AT_KEY, String(Date.now())); } catch (_) {}
      if (opts && opts.silent) return;
      try { document.dispatchEvent(new CustomEvent('quoteCartUpdated')); } catch (_) {}
    }

    const navQty = document.querySelector('[data-nav-quote-qty]');
    function updateNavQty() {
      if (!navQty) return;
      if (cart.length === 0) {
        navQty.style.display = 'none';
        navQty.textContent = '';
      } else {
        navQty.style.display = 'flex';
        navQty.textContent = cart.length;
      }
    }
    window.updateNavQty = updateNavQty;

    const modalSubmitBtn = document.querySelector('[data-quote-modal-submit]');
    if (modalSubmitBtn) {
      modalSubmitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/get-a-quote';
      });
    }

    function mergeDuplicateSpareParts(arr) {
      const norm = s => (s || '').trim().toLowerCase();
      const seen = [];
      const result = [];
      for (let i = 0; i < arr.length; i++) {
        const item = arr[i];
        if (!item.isSparePart) { result.push(item); continue; }
        const key = norm(item.title) + '\n' + norm(item.parentProductTitle || '');
        const idx = seen.indexOf(key);
        if (idx >= 0) { result[idx].qty = (result[idx].qty || 1) + (item.qty || 1); }
        else { seen.push(key); result.push({ ...item, qty: item.qty || 1 }); }
      }
      return result;
    }

    function loadCart() {
      const raw = localStorage.getItem(CART_KEY);
      const savedAtRaw = localStorage.getItem(CART_SAVED_AT_KEY);
      const savedAt = savedAtRaw ? Number(savedAtRaw) : 0;
      if (savedAt && (Date.now() - savedAt > CART_TTL_MS)) {
        localStorage.removeItem(CART_KEY);
        localStorage.removeItem(CART_SAVED_AT_KEY);
        try { document.dispatchEvent(new CustomEvent('quoteCartExpired')); } catch (_) {}
        cart = [];
        return;
      }
      if (raw) {
        try {
          cart = mergeDuplicateSpareParts(JSON.parse(raw));
        } catch {
          cart = [];
        }
      }
    }

    function updateTitle() {
      if (titleEl) titleEl.textContent = `QUOTE (${cart.length} ${cart.length === 1 ? 'ITEM' : 'ITEMS'})`;
    }

    function toggleEmptyState() {
      if (!emptyState || !actionsBlock) return;
      if (cart.length === 0) {
        emptyState.style.display = 'flex';
        actionsBlock.style.display = 'none';
      } else {
        emptyState.style.display = 'none';
        actionsBlock.style.display = 'block';
      }
    }

    function findInClone(root, selectors) {
      if (!root || !selectors || !selectors.length) return null;
      for (let i = 0; i < selectors.length; i++) {
        const el = root.querySelector(selectors[i]);
        if (el) return el;
      }
      return null;
    }

    function buildCartOrder() {
      const norm = t => (t || '').trim().toLowerCase();
      const order = [];
      cart.forEach((item, idx) => {
        if (!item.isSparePart) {
          order.push({ item, idx });
          cart.forEach((sp, j) => {
            const same=(sp.isSparePart)&&(item.productSlug&&sp.parentProductSlug===item.productSlug||norm(sp.parentProductTitle)===norm(item.title));
            if(same)order.push({ item: sp, idx: j });
          });
        }
      });
      cart.forEach((item, idx) => {
        if (item.isSparePart && !order.some(o => o.idx === idx)) order.push({ item, idx });
      });
      return order;
    }

    function refreshSparePartButtons() {
      if (typeof window.updateSparePartButtonsState === 'function') window.updateSparePartButtonsState();
    }

    function itemKey(o){return (o.isSparePart?'p':'n')+'\x01'+(o.title||'')+'\x01'+(o.parentProductSlug||o.parentProductTitle||'');}
    const normT=t=>(t||'').trim().toLowerCase().replace(/\s+/g,' ');
    function removeFromCart(item){
      loadCart();
      if(item.isSparePart===true){
        const i=cart.findIndex(c=>itemKey(c)===itemKey(item));
        if(i>=0)cart.splice(i,1);
      }else{
        const productSlug=item.productSlug||'';
        const productTitle=normT(item.title);
        const spareMatchesProduct=(c)=>(c.isSparePart===true)&&(productSlug&&c.parentProductSlug===productSlug||normT(c.parentProductTitle)===productTitle);
        const productMatches=(c)=>(!c.isSparePart)&&(productSlug&&c.productSlug===productSlug||normT(c.title)===productTitle);
        const toRemove=cart.filter(c=>spareMatchesProduct(c)||productMatches(c));
        if(toRemove.length>0){
          console.log('[Weldpoly Quote] Removing product parent:',{title:item.title,slug:productSlug,removing:toRemove.length,items:toRemove.map(x=>({title:x.title,isSparePart:x.isSparePart,parentSlug:x.parentProductSlug}))});
        }
        cart=cart.filter(c=>!(spareMatchesProduct(c)||productMatches(c)));
      }
      saveCart();
      renderCart();
      updateNavQty();
      renderRequestQuotePageList();
      refreshSparePartButtons();
    }

    function renderCart() {
      if (!quoteContent || !templateItem) return;
      templateItem.style.display = 'none';
      if (templatePartItem) templatePartItem.style.display = 'none';
      quoteContent.querySelectorAll('.quote_item, .quote_part-item').forEach(el => {
        if (!el.hasAttribute('data-quote-item') && !el.hasAttribute('data-quote-part-item')) el.remove();
      });
      const templatePart = templatePartItem || templateItem;
      const order = buildCartOrder();
      const titleSel=['[data-quote-title]','[data-quote-part-name]','.quote_part-item-title','.quote_part-item_title','.quote_item-title','.quote_part-title','.quote_item_content p:first-child','.quote_item_content > *:first-child'];
      const descSel=['[data-quote-description]','[data-quote-part-machine]','[data-quote-part-code]','.quote_part-item-description','.quote_part-item_description','.quote_item-description','.quote_part-description','.quote_item_content p:nth-of-type(2)','.quote_item_content p:last-of-type','.quote_item_content > *:nth-child(2)','.quote_item_content > *:last-child'];

      const ins=emptyState||null;
      order.forEach(({item,idx})=>{
        const isSparePart = item.isSparePart === true;
        const template = isSparePart ? templatePart : templateItem;
        const clone = template.cloneNode(true);
        clone.style.display = 'flex';
        clone.removeAttribute('data-quote-item');
        clone.removeAttribute('data-quote-part-item');
        if (isSparePart) clone.classList.add('quote_part-item');

        const titleNode=findInClone(clone,titleSel)||clone.querySelector('[data-quote-title]');
        const descNode=findInClone(clone,descSel)||clone.querySelector('[data-quote-description]');
        const sizeRangeNode=clone.querySelector('[data-quote-size-range]');
        const qtyEl = clone.querySelector('[data-quote-number]');
        if (titleNode) titleNode.textContent = item.title || '';
        const descText=item.description||'';
        const sizeText=item.productSizeRange||'';
        const fullDesc=sizeRangeNode ? descText : (sizeText && descText ? sizeText+'\n'+descText : (sizeText||descText));
        if (isOtherSparePart(item)) {
          attachOtherDescriptionField(descNode, item, { focus: !!item.needsOtherDescription });
          if (sizeRangeNode) sizeRangeNode.style.display = 'none';
        } else {
          if (descNode) descNode.textContent = fullDesc;
          if (sizeRangeNode) sizeRangeNode.textContent = sizeText;
        }
        if (qtyEl) {
          const q = item.qty || 1;
          qtyEl.textContent = q;
          const inner = qtyEl.querySelector('div');
          if (inner) inner.textContent = q;
        }
        if (isSparePart && !titleNode && !descNode) {
          const partContent = clone.querySelector('[data-quote-part-content]') || clone.querySelector('.quote_item_content');
          if (partContent) partContent.textContent = ((item.title || '') + ' ' + (item.description || '')).trim();
        }
        const imgEl = clone.querySelector('[data-quote-image]');
        if (imgEl) imgEl.remove();

        const plusBtn = clone.querySelector('.quote_plus');
        const minusBtn = clone.querySelector('.quote_minus');
        const removeBtn = clone.querySelector('[data-quote-remove]');
        if (plusBtn) plusBtn.addEventListener('click', () => { item.qty++; renderCart(); saveCart(); updateNavQty(); renderRequestQuotePageList(); refreshSparePartButtons(); });
        if (minusBtn) minusBtn.addEventListener('click', () => { if (item.qty > 1) item.qty--; renderCart(); saveCart(); updateNavQty(); renderRequestQuotePageList(); refreshSparePartButtons(); });
        if (removeBtn) removeBtn.addEventListener('click', (e) => { e.preventDefault(); removeFromCart(item); });
        ins?quoteContent.insertBefore(clone,ins):quoteContent.appendChild(clone);
      });
      updateTitle();
      toggleEmptyState();
    }

    const pageListContainer = document.querySelector('[data-quote-list]') || document.querySelector('.request-a-quote_list');
    const pageTitleEl = document.querySelector('[data-request-a-quote-title]');
    const pageTemplate = pageListContainer?.querySelector('[data-quote-placeholder]') || pageListContainer?.querySelector('[data-quote-item]') || pageListContainer?.querySelector('.quote_item') || templateItem || templatePartItem;

    function renderRequestQuotePageList() {
      if (!pageListContainer) return;
      const template = pageTemplate || templateItem || templatePartItem;
      if (!template) return;
      template.style.display = 'none';
      pageListContainer.querySelectorAll('.quote_item, .quote_part-item').forEach(el => {
        if (el !== template && !el.hasAttribute('data-quote-placeholder') && !el.hasAttribute('data-quote-item') && !el.hasAttribute('data-quote-part-item')) el.remove();
      });
      const order = buildCartOrder();
      order.forEach(({ item, idx }) => {
        const itemTemplate = (item.isSparePart && templatePartItem) ? templatePartItem : template;
        const clone = itemTemplate.cloneNode(true);
        clone.style.display = 'flex';
        clone.removeAttribute('data-quote-placeholder');
        clone.removeAttribute('data-quote-item');
        clone.removeAttribute('data-quote-part-item');
        if (item.isSparePart) clone.classList.add('quote_part-item');
        const tEl = clone.querySelector('[data-quote-title]') || clone.querySelector('.quote_item-title');
        const dEl = clone.querySelector('[data-quote-description]') || clone.querySelector('.quote_item-description');
        const sEl = clone.querySelector('[data-quote-size-range]');
        const qEl = clone.querySelector('[data-quote-number]') || clone.querySelector('.quote_number');
        if (tEl) tEl.textContent = item.title || '';
        const descT=item.description||'', sizeT=item.productSizeRange||'';
        const fullD=sEl ? descT : (sizeT && descT ? sizeT+'\n'+descT : (sizeT||descT));
        if (isOtherSparePart(item)) {
          const pageDesc = dEl || clone.querySelector('[data-quote-part-machine]') || clone.querySelector('[data-quote-part-code]') || clone.querySelector('.quote_item-description');
          attachOtherDescriptionField(pageDesc, item, { focus: false });
          if (sEl) sEl.style.display = 'none';
        } else {
          if (dEl) dEl.textContent = fullD;
          if (sEl) sEl.textContent = sizeT;
        }
        if (qEl) { const q = item.qty || 1; qEl.textContent = q; const i = qEl.querySelector('div'); if (i) i.textContent = q; }
        const plusBtn = clone.querySelector('.quote_plus');
        const minusBtn = clone.querySelector('.quote_minus');
        const removeBtn = clone.querySelector('[data-quote-remove]');
        if (plusBtn) plusBtn.addEventListener('click', () => { item.qty++; saveCart(); renderCart(); renderRequestQuotePageList(); updateNavQty(); refreshSparePartButtons(); });
        if (minusBtn) minusBtn.addEventListener('click', () => { if (item.qty > 1) item.qty--; saveCart(); renderCart(); renderRequestQuotePageList(); updateNavQty(); refreshSparePartButtons(); });
        if (removeBtn) removeBtn.addEventListener('click', (e) => { e.preventDefault(); removeFromCart(item); });
        pageListContainer.appendChild(clone);
      });
      if (pageTitleEl) pageTitleEl.textContent = `QUOTE (${cart.length} ${cart.length === 1 ? 'ITEM' : 'ITEMS'})`;
      updateRequestQuotePageEmptyState();
    }

    function updateRequestQuotePageEmptyState() {
      const path = (window.location.pathname || '').toLowerCase();
      const hasQuoteTitle = !!document.querySelector('[data-request-a-quote-title]');
      const isRequestQuotePage = /\/(get-a-quote|request-a-quote)(\/|$)/.test(path) || /(get-a-quote|request-a-quote)\.html/.test(path) || hasQuoteTitle;
      if (!isRequestQuotePage) return;
      const pageQuoteSection = document.querySelector('.request-a-quote_content, [quote-content], .request-quote_wrapper');
      if (!pageQuoteSection) return;
      loadCart();
      if (cart.length === 0) {
        document.body.classList.add('quote-request-empty');
      } else {
        document.body.classList.remove('quote-request-empty');
      }
    }

    function setupModalScroll() {
      if (!quoteContent) return;
      quoteContent.style.overflowY = 'auto';
      quoteContent.style.overflowX = 'hidden';
      quoteContent.style.minHeight='0';
      const modalCard = quoteModal?.querySelector('.modal__card') || quoteModal;
      if (modalCard) {
        const headerHeight = quoteModal?.querySelector('.quote_header')?.offsetHeight || 0;
        const actionsHeight = quoteModal?.querySelector('.quote_modal-content-bottom')?.offsetHeight || 0;
        quoteContent.style.maxHeight = (window.innerHeight - headerHeight - actionsHeight - 40) + 'px';
      }
      quoteContent.setAttribute('data-locomotive-scroll', 'ignore');
      quoteContent.setAttribute('data-scroll', 'ignore');
      quoteContent.classList.add('quote-modal-scrollable');
    }

    function handleModalScrollControl(modalOpen) {
      if (typeof window.disableLenisScroll !== 'function' || typeof window.enableLenisScroll !== 'function') {
        setTimeout(() => handleModalScrollControl(modalOpen), 100);
        return;
      }
      const body = document.body;
      const html = document.documentElement;
      if (modalOpen) {
        window.disableLenisScroll(body);
        window.disableLenisScroll(html);
        if (quoteContent) { quoteContent.removeAttribute('data-lenis-scroll'); quoteContent.style.overflowY = 'auto'; quoteContent.style.overflowX = 'hidden'; }
      } else {
        window.enableLenisScroll(body);
        window.enableLenisScroll(html);
      }
    }

    function openQuoteModal() {
      loadCart();
      if (modalGroup) modalGroup.setAttribute('data-modal-group-status', 'active');
      if (quoteModal) quoteModal.setAttribute('data-modal-status', 'active');
      setupModalScroll();
      handleModalScrollControl(true);
      renderCart();
    }

    function closeQuoteModal() {
      if (modalGroup) modalGroup.setAttribute('data-modal-group-status', 'not-active');
      if (quoteModal) quoteModal.setAttribute('data-modal-status', 'not-active');
      handleModalScrollControl(false);
    }
    window.openQuoteModal = openQuoteModal;
    window.closeQuoteModal = closeQuoteModal;

    function addProductToCart(button) {
      loadCart();
      const title = button.getAttribute('data-quote-title') || 'Unnamed item';
      const description = button.getAttribute('data-quote-description') || '';
      const slugSrc = button.getAttribute('data-quote-product-slug') || button.closest?.('[data-product-slug]')?.getAttribute?.('data-product-slug') || button.closest?.('.w-dyn-item')?.querySelector?.('[data-product-slug]')?.getAttribute?.('data-product-slug') || document.querySelector?.('[data-product-slug]')?.getAttribute?.('data-product-slug');
      const slug = (slugSrc || '').trim();
      const sizeRangeEl = button.closest?.('.w-dyn-item')?.querySelector?.('[data-product-size-range]') || document.querySelector?.('[data-product-size-range]');
      const sizeRange = (button.getAttribute('data-quote-size-range') || (sizeRangeEl ? (sizeRangeEl.getAttribute?.('data-product-size-range')||sizeRangeEl.textContent||'').trim() : '')).trim();
      const existing = cart.find(i => i.title === title || (slug && i.productSlug === slug));
      if (existing) existing.qty++;
      else { const p = { title, description, qty: 1 }; if (slug) p.productSlug = slug; if (sizeRange) p.productSizeRange = sizeRange; cart.push(p); }
      renderCart();
      saveCart();
      updateNavQty();
      refreshSparePartButtons();
    }

    document.addEventListener('click',e=>{
      const openBtn=e.target.closest('[data-modal-target="quote-modal"]');
      if (openBtn) {
        // Nav "Get a quote" CTA should navigate to /get-a-quote (or request-a-quote),
        // not open the quote cart modal. Keep modal for add-to-quote / cart triggers.
        const href = (openBtn.getAttribute('href') || '').trim();
        const goesToQuotePage = /(?:^|\/)(get-a-quote|request-a-quote)(?:\/|$|\.html|\?|#)/i.test(href);
        if (goesToQuotePage && !openBtn.hasAttribute('data-add-quote')) {
          return;
        }
        e.preventDefault();
        if (openBtn.hasAttribute('data-add-quote')) addProductToCart(openBtn);
        openQuoteModal();
      }
    });

    document.addEventListener('click',e=>{
      const closeBtn=e.target.closest('.modal__btn-close, [data-modal-close]');
      if (closeBtn) { e.preventDefault(); closeQuoteModal(); }
    });

    document.querySelectorAll('[data-add-quote]').forEach(btn=>{
      if(btn.hasAttribute('data-modal-target'))return;
      btn.addEventListener('click',e=>{e.preventDefault();addProductToCart(btn);openQuoteModal();});
    });

    if (quoteModal) {
      const modalObserver = new MutationObserver((mutations) => {
        mutations.forEach((m) => {
          if (m.type === 'attributes' && m.attributeName === 'data-modal-status') {
            const isActive = quoteModal.getAttribute('data-modal-status') === 'active';
            setTimeout(() => {
              if (isActive) { setupModalScroll(); handleModalScrollControl(true); renderCart(); }
              else { handleModalScrollControl(false); refreshSparePartButtons(); }
            }, 50);
          }
        });
      });
      modalObserver.observe(quoteModal, { attributes: true, attributeFilter: ['data-modal-status'] });
    }

    const onCartEvt=()=>{loadCart();renderCart();renderRequestQuotePageList();updateRequestQuotePageEmptyState();updateNavQty();refreshSparePartButtons();};
    document.addEventListener('quoteCartExpired',onCartEvt);
    document.addEventListener('quoteCartUpdated',onCartEvt);

    function fireQuoteLeadConversion() {
      loadCart();
      const itemsCount = Array.isArray(cart) ? cart.reduce((sum, i) => sum + (i && i.qty ? i.qty : 1), 0) : 0;
      const payload = { currency: GA4_LEAD_CURRENCY, value: GA4_LEAD_VALUE, items_count: itemsCount };
      try {
        if (typeof window.gtag === 'function') {
          window.gtag('event', GA4_LEAD_EVENT, payload);
        } else {
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push(Object.assign({ event: GA4_LEAD_EVENT }, payload));
        }
        console.log('[Weldpoly Quote] GA4 generate_lead fired', payload);
      } catch (err) {
        console.warn('[Weldpoly Quote] GA4 generate_lead failed', err);
      }
    }

    function setupQuoteLeadTracking() {
      // Case 1: we landed on the success page after a confirmed quote submit.
      // Most reliable point to fire — gtag is loaded and no redirect can cancel it.
      // We only read the flag here (captured at load); the success page's own script
      // is responsible for clearing it, so we don't break its access gate.
      if (cameFromQuoteSubmit && !document.querySelector('[data-quote-hidden]')) {
        fireQuoteLeadConversion();
        return;
      }
      // Case 2: on the quote request page, mark the submit so the success page fires
      // the conversion. Redundant with the page's inline flag, kept as a safety net.
      const hidden = document.querySelector('[data-quote-hidden]');
      const form = hidden ? hidden.closest('form') : null;
      if (!form) return;
      form.addEventListener('submit', () => {
        try { sessionStorage.setItem(QUOTE_SUBMIT_FLAG, 'true'); } catch (_) {}
      });
    }

    loadCart();
    renderCart();
    renderRequestQuotePageList();
    updateRequestQuotePageEmptyState();
    updateNavQty();
    refreshSparePartButtons();
    setupQuoteLeadTracking();

    window.updateRequestQuotePageEmptyState = updateRequestQuotePageEmptyState;
    window.addEventListener('load', updateRequestQuotePageEmptyState);
    setTimeout(updateRequestQuotePageEmptyState, 300);
    setTimeout(updateRequestQuotePageEmptyState, 1000);

    if (quoteModal && quoteModal.getAttribute('data-modal-status') === 'active') {
      setupModalScroll();
      handleModalScrollControl(true);
    }
  }

  window.initQuoteSystem = initQuoteSystem;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initQuoteSystem);
  else initQuoteSystem();
  if (typeof Webflow !== 'undefined') Webflow.push(() => { if (!systemInitialized) initQuoteSystem(); });
})();
