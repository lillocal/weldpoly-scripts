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

    // Style for Other spare-part description field + hide Designer templates
    if (!document.getElementById('quote-other-desc-style')) {
      const st = document.createElement('style');
      st.id = 'quote-other-desc-style';
      st.textContent = [
        '[data-quote-other]{display:none!important;}',
        '[data-quote-other-description]{display:block;width:100%;margin-top:0.35rem;padding:0.5rem 0.65rem;border:1px solid rgba(0,0,0,0.18);border-radius:4px;font:inherit;line-height:1.35;background:#fff;color:inherit;box-sizing:border-box;}',
        '[data-quote-other-description]:focus{outline:2px solid rgba(0,0,0,0.35);outline-offset:1px;}',
        '.quote_item-input-other{width:100%;}'
      ].join('');
      document.head.appendChild(st);
    }

    const modalGroup = document.querySelector('[data-modal-group-status]');
    const quoteModal = document.querySelector('[data-modal-name="quote-modal"]');
    const quoteContent = quoteModal?.querySelector('.quote_modal-content');
    const templateItem = quoteModal?.querySelector('[data-quote-item]');
    const templatePartItem = quoteModal?.querySelector('[data-quote-part-item]');
    const templateOtherItem = quoteModal?.querySelector('[data-quote-other]');
    const titleEl = quoteModal?.querySelector('.quote_header-title');
    const emptyState = quoteModal?.querySelector('[quote-empty]') || quoteModal?.querySelector('.quote_empty-wrapper');
    const actionsBlock = quoteModal?.querySelector('.quote_modal-content-bottom');
    let cart = [];

    function isOtherSparePart(item) {
      return !!(item && item.isSparePart && (item.isOtherSparePart === true || (item.title || '').trim().toLowerCase() === 'other'));
    }

    function resolveCartItem(item) {
      if (!item) return null;
      const key = itemKey(item);
      return cart.find((c) => itemKey(c) === key) || item;
    }

    function syncOtherDescriptionInputs(value, except) {
      document.querySelectorAll('[data-quote-other-description]').forEach((el) => {
        if (el === except) return;
        if (el.value !== value) el.value = value;
      });
    }

    function isOtherInputSlot(node) {
      return !!(node && (
        node.classList?.contains('quote_item-input-other') ||
        node.hasAttribute?.('data-quote-other-input') ||
        node.hasAttribute?.('data-quote-other-description')
      ));
    }

    function attachOtherDescriptionField(host, item, opts) {
      if (!host) return null;
      const focus = !!(opts && opts.focus);
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 200;
      input.className = 'quote_other-description';
      input.setAttribute('data-quote-other-description', '');
      input.setAttribute('aria-label', 'Describe the part you need');
      input.placeholder = 'Describe the part you need (one sentence)';
      input.value = item.description || '';
      // Persist against the live cart entry (never re-render on blur — that was orphaning
      // item refs via loadCart in updateRequestQuotePageEmptyState and wiping the field).
      input.addEventListener('input', () => {
        const target = resolveCartItem(item);
        if (!target) return;
        target.description = input.value;
        if (target.description.trim()) delete target.needsOtherDescription;
        saveCart({ silent: true });
        syncOtherDescriptionInputs(target.description, input);
      });
      input.addEventListener('blur', () => {
        const target = resolveCartItem(item);
        if (!target) return;
        target.description = (input.value || '').trim();
        input.value = target.description;
        if (target.description) delete target.needsOtherDescription;
        saveCart({ silent: true });
        syncOtherDescriptionInputs(target.description, input);
      });
      if (isOtherInputSlot(host)) {
        host.innerHTML = '';
        host.appendChild(input);
      } else {
        host.replaceWith(input);
      }
      // Hide leftover part template description lines for Other (keep title)
      const content = input.closest('.quote_item_content');
      if (content) {
        content.querySelectorAll('p, [data-quote-part-code], [data-quote-part-machine], .quote_item-description, .spare-part-code').forEach((el) => {
          if (el === input) return;
          if (el.hasAttribute('data-quote-title') || el.hasAttribute('data-quote-part-name') || el.classList.contains('spare-part-name')) return;
          if (el.contains(input)) return;
          el.style.display = 'none';
        });
      }
      if (focus || item.needsOtherDescription) {
        setTimeout(() => { try { input.focus(); } catch (_) {} }, 50);
      }
      return input;
    }


    function formatQuoteData(items) {
      const list = Array.isArray(items) ? items : [];
      if (!list.length) return 'No items added';

      // Single-line-friendly: Webflow Forms collapses newlines in the inbox view.
      // Keep each item compact and separate items with " | ".
      const parts = list.map((item, index) => {
        const n = index + 1;
        const qty = item && item.qty ? item.qty : 1;
        const title = ((item && item.title) || 'Unnamed item').trim();
        const desc = ((item && item.description) || '').trim();
        const parent = ((item && (item.parentProductTitle || item.parentProductSlug)) || '').trim();
        const size = ((item && item.productSizeRange) || '').trim();
        const bits = [];

        if (isOtherSparePart(item)) {
          bits.push(`${n}) Other${parent ? ` (for ${parent})` : ''}`);
          bits.push(`Note: ${desc || '(missing description)'}`);
        } else if (item && item.isSparePart) {
          bits.push(`${n}) ${title}${parent ? ` (for ${parent})` : ''}`);
          if (desc) bits.push(`Desc: ${desc}`);
        } else {
          bits.push(`${n}) ${title}`);
          if (size) bits.push(`Size: ${size}`);
          else if (desc) bits.push(`Desc: ${desc}`);
        }
        bits.push(`Qty: ${qty}`);
        return bits.join(' — ');
      });

      return `QUOTE ITEMS: ${parts.join(' | ')}`;
    }

    function formatOtherDescriptions(items) {
      const list = (Array.isArray(items) ? items : []).filter(isOtherSparePart);
      if (!list.length) return '';
      return list.map((item, index) => {
        const parent = ((item.parentProductTitle || item.parentProductSlug) || '').trim();
        const desc = (item.description || '').trim();
        const prefix = list.length > 1 ? `${index + 1}) ` : '';
        return `${prefix}${desc || '(missing description)'}${parent ? ` [for ${parent}]` : ''}`;
      }).join(' | ');
    }

    function syncQuoteFormFields() {
      const hidden = document.querySelector('[data-quote-hidden], #quote-data, input[name="quote-data"]');
      if (hidden) {
        const formatted = formatQuoteData(cart);
        if (hidden.value !== formatted) hidden.value = formatted;
      }
      // Optional dedicated field (Designer: name="other-description" or data-other-description-hidden)
      const otherField = document.querySelector(
        '[data-other-description-hidden], #other-description, input[name="other-description"], textarea[name="other-description"]'
      );
      if (otherField) {
        const otherText = formatOtherDescriptions(cart);
        if (otherField.value !== otherText) otherField.value = otherText;
      }
    }

    function saveCart(opts) {
      localStorage.setItem(CART_KEY, JSON.stringify(cart));
      try { localStorage.setItem(CART_SAVED_AT_KEY, String(Date.now())); } catch (_) {}
      syncQuoteFormFields();
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

    const normT=t=>(t||'').trim().toLowerCase().replace(/\s+/g,' ');
    function parentKeyFromMachine(item) {
      return ((item && item.productSlug) || '').trim() || normT(item && item.title);
    }
    function parentKeyFromPart(item) {
      return ((item && item.parentProductSlug) || '').trim() || normT(item && item.parentProductTitle);
    }
    function machineMetaFromPart(sp) {
      return {
        title: (sp.parentProductTitle || '').trim(),
        description: (sp.parentProductDescription || '').trim(),
        productSlug: (sp.parentProductSlug || '').trim(),
        productSizeRange: (sp.parentProductSizeRange || '').trim(),
        productImage: (sp.parentProductImage || '').trim(),
        qty: 1,
        isSparePart: false
      };
    }
    function enrichMachineMeta(base, extra) {
      const out = { ...base };
      ['title', 'description', 'productSlug', 'productSizeRange', 'productImage'].forEach((k) => {
        if (!(out[k] || '').trim() && (extra[k] || '').trim()) out[k] = extra[k];
      });
      return out;
    }

    // Groups machines with their spare parts. If parts exist without the machine in cart,
    // still insert a data-quote-item header (unchecked) so the parent product is visible.
    function buildCartOrder() {
      const order = [];
      const usedPartIdx = new Set();
      const partGroups = new Map();

      cart.forEach((item, idx) => {
        if (!item.isSparePart) return;
        const key = parentKeyFromPart(item) || `__orphan_${idx}`;
        if (!partGroups.has(key)) partGroups.set(key, { meta: machineMetaFromPart(item), parts: [] });
        const g = partGroups.get(key);
        g.meta = enrichMachineMeta(g.meta, machineMetaFromPart(item));
        g.parts.push({ item, idx });
      });

      cart.forEach((item, idx) => {
        if (item.isSparePart) return;
        const key = parentKeyFromMachine(item);
        order.push({ item, idx, kind: 'machine', selected: true });
        const g = partGroups.get(key);
        if (g) {
          g.parts.forEach((p) => {
            order.push({ item: p.item, idx: p.idx, kind: 'part' });
            usedPartIdx.add(p.idx);
          });
          partGroups.delete(key);
        }
      });

      partGroups.forEach((g, key) => {
        const hasParent = !String(key).startsWith('__orphan_') && !!(g.meta.title || g.meta.productSlug);
        if (hasParent) {
          order.push({ item: g.meta, idx: -1, kind: 'machine', selected: false, referenceOnly: true });
        }
        g.parts.forEach((p) => {
          if (usedPartIdx.has(p.idx)) return;
          order.push({ item: p.item, idx: p.idx, kind: 'part' });
        });
      });

      return order;
    }

    function setMachineInQuote(meta, include) {
      loadCart();
      const slug = (meta.productSlug || '').trim();
      const title = (meta.title || '').trim();
      const idx = cart.findIndex((i) => !i.isSparePart && ((slug && i.productSlug === slug) || normT(i.title) === normT(title)));
      if (include) {
        if (idx < 0) {
          const p = { title: title || 'Product', description: meta.description || '', qty: 1 };
          if (slug) p.productSlug = slug;
          if (meta.productSizeRange) p.productSizeRange = meta.productSizeRange;
          if (meta.productImage) p.productImage = meta.productImage;
          cart.push(p);
        }
      } else if (idx >= 0) {
        cart.splice(idx, 1);
      }
      saveCart();
      renderCart();
      updateNavQty();
      renderRequestQuotePageList();
      refreshSparePartButtons();
    }

    function syncWebflowCheckboxVisual(cb, checked) {
      if (!cb) return;
      cb.checked = !!checked;
      const wrap = cb.closest('.w-checkbox');
      const custom = (wrap && wrap.querySelector('.w-checkbox-input')) ||
        (cb.previousElementSibling && cb.previousElementSibling.classList?.contains('w-checkbox-input')
          ? cb.previousElementSibling
          : null);
      if (custom) custom.classList.toggle('w--redirected-checked', !!checked);
    }

    function bindMachineSelect(clone, meta, selected) {
      const host = clone.querySelector('[data-quote-machine-select]') || clone.querySelector('.quote_item-select');
      if (!host) return;
      // Prefer the Designer checkbox — never wipe/replace it (that caused double boxes).
      let cb = host.querySelector('input[type="checkbox"]') ||
        clone.querySelector('[data-quote-machine-checkbox]');
      if (!cb) {
        cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.setAttribute('data-quote-machine-checkbox', '');
        cb.setAttribute('aria-label', 'Request quote for full machine');
        host.appendChild(cb);
      }
      syncWebflowCheckboxVisual(cb, selected);
      cb.setAttribute('aria-label', 'Request quote for full machine');
      cb.addEventListener('change', () => {
        syncWebflowCheckboxVisual(cb, cb.checked);
        setMachineInQuote(meta, !!cb.checked);
      });
    }

    function fillMachineRow(clone, item, selected) {
      const titleNode = clone.querySelector('[data-quote-title]');
      const descNodes = [...clone.querySelectorAll('[data-quote-description]')];
      if (titleNode) titleNode.textContent = 'Request quote for full machine';
      if (descNodes[0]) descNodes[0].textContent = item.title || '';
      if (descNodes[1]) {
        const unit = (item.productSizeRange || item.description || '').trim();
        descNodes[1].textContent = unit;
        descNodes[1].style.display = unit ? '' : 'none';
      }
      const imgEl = clone.querySelector('[data-quote-image]');
      if (imgEl) {
        if (item.productImage) {
          imgEl.src = item.productImage;
          imgEl.alt = item.title || '';
        } else {
          imgEl.remove();
        }
      }
      bindMachineSelect(clone, item, selected);
    }

    function refreshSparePartButtons() {
      if (typeof window.updateSparePartButtonsState === 'function') window.updateSparePartButtonsState();
    }

    function itemKey(o){return (o.isSparePart?'p':'n')+'\x01'+(o.title||'')+'\x01'+(o.parentProductSlug||o.parentProductTitle||'');}
    function removeFromCart(item){
      loadCart();
      // Machines and spare parts are independent lines: removing one never cascades to the other.
      const i=cart.findIndex(c=>itemKey(c)===itemKey(item));
      if(i>=0)cart.splice(i,1);
      saveCart();
      renderCart();
      updateNavQty();
      renderRequestQuotePageList();
      refreshSparePartButtons();
    }

    function ensureQtyControls(clone) {
      if (!clone || clone.querySelector('.quote_item-qty')) return;
      const actions = clone.querySelector('.quote_item-actions');
      if (!actions) return;
      const src = templateItem && templateItem.querySelector('.quote_item-qty');
      if (src) {
        actions.insertBefore(src.cloneNode(true), actions.firstChild);
        return;
      }
      const wrap = document.createElement('div');
      wrap.className = 'quote_item-qty';
      wrap.innerHTML = '<div class="quote_minus" aria-label="Decrease quantity">−</div><div data-quote-number="" class="quote_number"><div>1</div></div><div class="quote_plus" aria-label="Increase quantity">+</div>';
      actions.insertBefore(wrap, actions.firstChild);
    }

    function bumpQty(item, delta) {
      loadCart();
      const live = cart.find((c) => itemKey(c) === itemKey(item));
      if (!live) return;
      const next = (live.qty || 1) + delta;
      if (next < 1) return;
      live.qty = next;
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
      if (templateOtherItem) templateOtherItem.style.display = 'none';
      quoteContent.querySelectorAll('.quote_item, .quote_part-item').forEach(el => {
        if (
          !el.hasAttribute('data-quote-item') &&
          !el.hasAttribute('data-quote-part-item') &&
          !el.hasAttribute('data-quote-other')
        ) el.remove();
      });
      const templatePart = templatePartItem || templateItem;
      const order = buildCartOrder();
      const titleSel=['[data-quote-title]','[data-quote-part-name]','.quote_part-item-title','.quote_part-item_title','.quote_item-title','.quote_part-title','.quote_item_content p:first-child','.quote_item_content > *:first-child'];
      const descSel=['[data-quote-description]','[data-quote-part-machine]','[data-quote-part-code]','.quote_part-item-description','.quote_part-item_description','.quote_item-description','.quote_part-description','.quote_item_content p:nth-of-type(2)','.quote_item_content p:last-of-type','.quote_item_content > *:nth-child(2)','.quote_item_content > *:last-child'];

      const ins=emptyState||null;
      order.forEach((entry)=>{
        const item = entry.item;
        const isSparePart = item.isSparePart === true;
        const isOther = isOtherSparePart(item);
        const isMachine = !isSparePart;
        const template = (isOther && templateOtherItem) ? templateOtherItem : (isSparePart ? templatePart : templateItem);
        const clone = template.cloneNode(true);
        clone.style.display = 'flex';
        clone.removeAttribute('data-quote-item');
        clone.removeAttribute('data-quote-part-item');
        clone.removeAttribute('data-quote-other');
        if (isSparePart) clone.classList.add('quote_part-item');
        if (isSparePart) ensureQtyControls(clone);

        if (isMachine) {
          fillMachineRow(clone, item, entry.selected !== false);
          ins?quoteContent.insertBefore(clone,ins):quoteContent.appendChild(clone);
          return;
        }

        const titleNode=findInClone(clone,titleSel)||clone.querySelector('[data-quote-title]');
        const descNode=findInClone(clone,descSel)||clone.querySelector('[data-quote-description]');
        const sizeRangeNode=clone.querySelector('[data-quote-size-range]');
        const qtyEl = clone.querySelector('[data-quote-number]');
        const partMachineNode=clone.querySelector('[data-quote-part-machine]');
        const partCodeNode=clone.querySelector('[data-quote-part-code]');
        if (titleNode) titleNode.textContent = item.title || '';
        const descText=item.description||'';
        const sizeText=item.productSizeRange||'';
        const parentTitle=(item.parentProductTitle||'').trim();
        const fullDesc=sizeRangeNode ? descText : (sizeText && descText ? sizeText+'\n'+descText : (sizeText||descText));
        // Parent machine is shown via the data-quote-item header above the parts.
        if (partMachineNode) {
          partMachineNode.textContent = parentTitle;
          partMachineNode.style.display = parentTitle ? '' : 'none';
        }
        if (isOther) {
          const otherHost =
            clone.querySelector('.quote_item-input-other') ||
            clone.querySelector('[data-quote-other-input]') ||
            partCodeNode ||
            descNode;
          attachOtherDescriptionField(otherHost, item, { focus: !!item.needsOtherDescription });
          if (sizeRangeNode) sizeRangeNode.style.display = 'none';
        } else if (partCodeNode || partMachineNode) {
          if (partCodeNode) {
            partCodeNode.textContent = descText;
            partCodeNode.style.display = descText ? '' : 'none';
          }
        } else {
          if (descNode) descNode.textContent = parentTitle ? (descText ? descText + '\n' + parentTitle : parentTitle) : fullDesc;
          if (sizeRangeNode) sizeRangeNode.textContent = sizeText;
        }
        if (qtyEl) {
          const q = item.qty || 1;
          qtyEl.textContent = q;
          const inner = qtyEl.querySelector('div');
          if (inner) inner.textContent = q;
        }
        if (!titleNode && !descNode && !partMachineNode) {
          const partContent = clone.querySelector('[data-quote-part-content]') || clone.querySelector('.quote_item_content');
          if (partContent) partContent.textContent = ((item.title || '') + ' ' + (item.description || '') + (parentTitle ? ' — ' + parentTitle : '')).trim();
        }
        const imgEl = clone.querySelector('[data-quote-image]');
        if (imgEl) imgEl.remove();

        const plusBtn = clone.querySelector('.quote_plus');
        const minusBtn = clone.querySelector('.quote_minus');
        const removeBtn = clone.querySelector('[data-quote-remove]');
        if (plusBtn) plusBtn.addEventListener('click', () => bumpQty(item, 1));
        if (minusBtn) minusBtn.addEventListener('click', () => bumpQty(item, -1));
        if (removeBtn) removeBtn.addEventListener('click', (e) => { e.preventDefault(); removeFromCart(item); });
        ins?quoteContent.insertBefore(clone,ins):quoteContent.appendChild(clone);
      });
      updateTitle();
      toggleEmptyState();
    }

    const pageListContainer = document.querySelector('[data-quote-list]') || document.querySelector('.request-a-quote_list');
    const pageTitleEl = document.querySelector('[data-request-a-quote-title]');
    const pageTemplate = pageListContainer?.querySelector('[data-quote-placeholder]') || pageListContainer?.querySelector('[data-quote-item]') || pageListContainer?.querySelector('.quote_item') || templateItem || templatePartItem;
    const pagePartTemplate = pageListContainer?.querySelector('[data-quote-part-item]') || null;
    const pageOtherTemplate = pageListContainer?.querySelector('[data-quote-other]') || null;

    function renderRequestQuotePageList() {
      if (!pageListContainer) return;
      const template = pageTemplate || templateItem || templatePartItem;
      if (!template) return;
      template.style.display = 'none';
      if (pagePartTemplate) pagePartTemplate.style.display = 'none';
      if (pageOtherTemplate) pageOtherTemplate.style.display = 'none';
      pageListContainer.querySelectorAll('.quote_item, .quote_part-item').forEach(el => {
        if (
          el !== template &&
          el !== pagePartTemplate &&
          el !== pageOtherTemplate &&
          !el.hasAttribute('data-quote-placeholder') &&
          !el.hasAttribute('data-quote-item') &&
          !el.hasAttribute('data-quote-part-item') &&
          !el.hasAttribute('data-quote-other')
        ) el.remove();
      });
      const order = buildCartOrder();
      order.forEach((entry) => {
        const item = entry.item;
        const isOther = isOtherSparePart(item);
        const isMachine = !item.isSparePart;
        const otherTpl = pageOtherTemplate || templateOtherItem;
        const partTpl = pagePartTemplate || templatePartItem;
        const machineTpl = pageTemplate || templateItem;
        const itemTemplate = isMachine
          ? machineTpl
          : ((isOther && otherTpl) ? otherTpl : ((item.isSparePart && partTpl) ? partTpl : template));
        const clone = itemTemplate.cloneNode(true);
        clone.style.display = 'flex';
        clone.removeAttribute('data-quote-placeholder');
        clone.removeAttribute('data-quote-item');
        clone.removeAttribute('data-quote-part-item');
        clone.removeAttribute('data-quote-other');
        if (item.isSparePart) clone.classList.add('quote_part-item');
        if (item.isSparePart) ensureQtyControls(clone);

        if (isMachine) {
          fillMachineRow(clone, item, entry.selected !== false);
          pageListContainer.appendChild(clone);
          return;
        }

        const tEl = clone.querySelector('[data-quote-title]') || clone.querySelector('[data-quote-part-name]') || clone.querySelector('.quote_item-title');
        const dEl = clone.querySelector('[data-quote-description]') || clone.querySelector('[data-quote-part-machine]') || clone.querySelector('[data-quote-part-code]') || clone.querySelector('.quote_item-description');
        const sEl = clone.querySelector('[data-quote-size-range]');
        const qEl = clone.querySelector('[data-quote-number]') || clone.querySelector('.quote_number');
        if (tEl) tEl.textContent = item.title || '';
        const descT=item.description||'', sizeT=item.productSizeRange||'';
        const parentTitle=(item.parentProductTitle||'').trim();
        const fullD=sEl ? descT : (sizeT && descT ? sizeT+'\n'+descT : (sizeT||descT));
        const partMachineNode=clone.querySelector('[data-quote-part-machine]');
        const partCodeNode=clone.querySelector('[data-quote-part-code]');
        if (partMachineNode) {
          partMachineNode.textContent = parentTitle;
          partMachineNode.style.display = parentTitle ? '' : 'none';
        }
        if (isOther) {
          const pageDesc =
            clone.querySelector('.quote_item-input-other') ||
            clone.querySelector('[data-quote-other-input]') ||
            partCodeNode ||
            dEl ||
            clone.querySelector('.quote_item-description');
          attachOtherDescriptionField(pageDesc, item, { focus: false });
          if (sEl) sEl.style.display = 'none';
        } else if (partCodeNode || partMachineNode) {
          if (partCodeNode) {
            partCodeNode.textContent = descT;
            partCodeNode.style.display = descT ? '' : 'none';
          }
        } else {
          if (dEl) dEl.textContent = parentTitle ? (descT ? descT + '\n' + parentTitle : parentTitle) : fullD;
          if (sEl) sEl.textContent = sizeT;
        }
        if (qEl) { const q = item.qty || 1; qEl.textContent = q; const i = qEl.querySelector('div'); if (i) i.textContent = q; }
        const plusBtn = clone.querySelector('.quote_plus');
        const minusBtn = clone.querySelector('.quote_minus');
        const removeBtn = clone.querySelector('[data-quote-remove]');
        if (plusBtn) plusBtn.addEventListener('click', () => bumpQty(item, 1));
        if (minusBtn) minusBtn.addEventListener('click', () => bumpQty(item, -1));
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
      // Use in-memory cart only — loadCart() here orphaned item refs bound to Other
      // description inputs on /get-a-quote, so typed text never persisted.
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
      const imageSrc = (
        button.getAttribute('data-quote-image') ||
        document.querySelector?.('[data-quote-product-image]')?.getAttribute?.('src') ||
        document.querySelector?.('[data-quote-product-image]')?.getAttribute?.('data-quote-product-image') ||
        document.querySelector?.('.product-header1_image')?.getAttribute?.('src') ||
        ''
      ).trim();
      const existing = cart.find(i => !i.isSparePart && (i.title === title || (slug && i.productSlug === slug)));
      if (existing) {
        existing.qty = (existing.qty || 1) + 1;
        if (imageSrc && !existing.productImage) existing.productImage = imageSrc;
        if (sizeRange && !existing.productSizeRange) existing.productSizeRange = sizeRange;
      } else {
        const p = { title, description, qty: 1 };
        if (slug) p.productSlug = slug;
        if (sizeRange) p.productSizeRange = sizeRange;
        if (imageSrc) p.productImage = imageSrc;
        cart.push(p);
      }
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
      form.addEventListener('submit', (e) => {
        // Always refresh hidden fields first (source of truth for Webflow Forms).
        syncQuoteFormFields();
        // Block submit when an Other spare part has no description (last chance to capture detail).
        const missingOther = cart.filter(isOtherSparePart).filter((i) => !(i.description || '').trim());
        if (missingOther.length) {
          e.preventDefault();
          e.stopImmediatePropagation();
          const input = document.querySelector('[data-quote-list] [data-quote-other-description], [data-quote-other-description]');
          if (input) {
            input.setAttribute('aria-invalid', 'true');
            try { input.focus(); } catch (_) {}
          }
          window.alert('Please describe the “Other” spare part before submitting your quote.');
          return;
        }
        try { sessionStorage.setItem(QUOTE_SUBMIT_FLAG, 'true'); } catch (_) {}
      }, true);
      // formdata fires when FormData is built — last reliable chance to set payload values.
      form.addEventListener('formdata', (e) => {
        syncQuoteFormFields();
        try {
          e.formData.set('quote-data', formatQuoteData(cart));
          const otherText = formatOtherDescriptions(cart);
          if (otherText) e.formData.set('other-description', otherText);
        } catch (_) {}
      });
      // Register late so we overwrite any legacy page inline formatQuoteData injectors.
      const bindLateSync = () => {
        form.addEventListener('submit', () => { syncQuoteFormFields(); });
      };
      if (document.readyState === 'complete') bindLateSync();
      else window.addEventListener('load', bindLateSync);
      syncQuoteFormFields();
    }

    loadCart();
    renderCart();
    renderRequestQuotePageList();
    updateRequestQuotePageEmptyState();
    updateNavQty();
    refreshSparePartButtons();
    setupQuoteLeadTracking();
    syncQuoteFormFields();

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
