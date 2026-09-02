/**
 * Weldpoly Spare Parts — Add spare parts to quote
 * Load AFTER weldpoly-quote-system.js
 * Uses same cart; quote system renders modal. Triggers: [spare-part-add], .spare-part-qty-plus, checkbox in [spare-part-item]
 *
 * "Other" comes from Designer ([spare-part-other]), not CMS. CMS placeholders named Other are removed;
 * Designer Other is kept last and collects a one-sentence description in the quote cart.
 */
(function(){
'use strict';
const CART_KEY='quoteCart',CART_SAVED_AT_KEY='quoteCartSavedAt',CART_TTL_MS=36e5;

function getCart(){
  try{
    const raw=localStorage.getItem(CART_KEY);
    const savedAtRaw=localStorage.getItem(CART_SAVED_AT_KEY);
    const savedAt=savedAtRaw?Number(savedAtRaw):0;
    if(savedAt&&(Date.now()-savedAt>CART_TTL_MS)){
      localStorage.removeItem(CART_KEY);
      localStorage.removeItem(CART_SAVED_AT_KEY);
      try{document.dispatchEvent(new CustomEvent('quoteCartExpired'));}catch(_){}
      return [];
    }
    if(raw){
      if(!savedAt)localStorage.setItem(CART_SAVED_AT_KEY,String(Date.now()));
      const cart=JSON.parse(raw);
      return Array.isArray(cart)?cart:[];
    }
    return [];
  }catch{return [];}
}

function setCart(cart){
  localStorage.setItem(CART_KEY,JSON.stringify(cart));
  localStorage.setItem(CART_SAVED_AT_KEY,String(Date.now()));
  try{document.dispatchEvent(new CustomEvent('quoteCartUpdated'));}catch(_){}
}

function mergeDuplicateSpareParts(cart){
  const norm=s=>(s||'').trim().toLowerCase();
  const seen=[],result=[];
  for(let i=0;i<cart.length;i++){
    const item=cart[i];
    if(!item.isSparePart){result.push(item);continue;}
    const key=norm(item.title)+'\n'+(item.parentProductSlug||norm(item.parentProductTitle||''));
    const idx=seen.indexOf(key);
    if(idx>=0)result[idx].qty=(result[idx].qty||1)+(item.qty||1);
    else{seen.push(key);result.push({...item,qty:item.qty||1});}
  }
  return result;
}

function getSparePartTitle(container){
  for(const sel of ['.spare-part-name','[spare-part-content]','.spare-part-code']){
    const el=container.querySelector(sel);
    if(el){const t=(el.textContent||'').trim();if(t&&t.length>0)return t;}
  }
  const txt=(container.textContent||'').trim().replace(/\s+/g,' ');
  const parts=txt.split(/[•|·]/).map(s=>s.trim()).filter(Boolean);
  if(parts[0])return parts[0];
  if(parts[1])return parts[1];
  const two=txt.split(/\s+/).slice(0,3).join(' ').trim();
  return two&&two.length>0?two:'Spare part';
}

function getSparePartDescription(container){
  for(const sel of ['.card_description','[data-quote-description]','.spare-part-description']){
    const el=container.querySelector(sel);
    if(el){const t=(el.textContent||'').trim();if(t&&t.length>1)return t;}
  }
  return '';
}

function getParentProductTitle(){
  const byAttr=document.querySelector('[data-quote-product-title]');
  if(byAttr){const t=(byAttr.getAttribute('data-quote-product-title')||byAttr.textContent||'').trim();if(t)return t;}
  const btn=document.querySelector('[data-add-quote][data-quote-title]');
  if(btn){const t=(btn.getAttribute('data-quote-title')||'').trim();if(t)return t;}
  return '';
}

function getParentProductSlug(){
  const el=document.querySelector('[data-product-slug]');
  return el?(el.getAttribute('data-product-slug')||'').trim():'';
}

function getParentProductSizeRange(){
  const el=document.querySelector('[data-product-size-range]');
  if(!el)return '';
  const v=(el.getAttribute('data-product-size-range')||el.textContent||'').trim();
  return v.replace(/\s+/g,' ').replace(/\s*\n\s*/g,' ');
}

function getParentProductDescription(){
  const byAttr=document.querySelector('[data-quote-product-description]');
  if(byAttr){const t=(byAttr.getAttribute('data-quote-product-description')||byAttr.textContent||'').trim();if(t)return t;}
  const btn=document.querySelector('[data-add-quote][data-quote-description]');
  if(btn){const t=(btn.getAttribute('data-quote-description')||'').trim();if(t)return t;}
  const titleEl=document.querySelector('[data-quote-product-title]');
  if(titleEl){
    const sibling=titleEl.nextElementSibling||titleEl.parentElement?.querySelector('[data-quote-description]');
    if(sibling){const t=(sibling.textContent||'').trim();if(t)return t;}
  }
  return '';
}

function getParentProductImage(){
  const byAttr=document.querySelector('[data-quote-product-image], [data-product-image]');
  if(byAttr){
    const src=(byAttr.getAttribute('data-quote-product-image')||byAttr.getAttribute('data-product-image')||byAttr.getAttribute('src')||'').trim();
    if(src)return src;
  }
  const img=document.querySelector('.product-header1_image, .product_header-image img, .product-hero img');
  return (img&&img.getAttribute('src')||'').trim();
}

function openQuoteModal(){
  if(typeof window.openQuoteModal==='function'){window.openQuoteModal();return;}
  const g=document.querySelector('[data-modal-group-status]');
  const m=document.querySelector('[data-modal-name="quote-modal"]');
  if(g)g.setAttribute('data-modal-group-status','active');
  if(m)m.setAttribute('data-modal-status','active');
}

const norm=s=>(s||'').trim().toLowerCase();
const isOtherSparePart=title=>norm(title)==='other';

function isSparePartInCart(container){
  const title=getSparePartTitle(container);
  const parentTitle=getParentProductTitle();
  const parentSlug=getParentProductSlug();
  const cart=getCart();
  const normP=(a,b)=>norm(a)===norm(b);
  const sameParent=(i)=>normP(i.parentProductTitle,parentTitle)||(parentSlug&&i.parentProductSlug===parentSlug);
  const idx=cart.findIndex(i=>i.isSparePart&&norm(i.title)===norm(title)&&sameParent(i));
  const qty=idx>=0?(cart[idx].qty||1):0;
  return{inCart:idx>=0,index:idx,qty};
}

function ensureSpareQtyStyles(){
  if(document.getElementById('spare-qty-stepper-style'))return;
  const st=document.createElement('style');
  st.id='spare-qty-stepper-style';
  st.textContent=[
    '[data-spare-qty-stepper]{display:inline-flex;align-items:center;gap:0.35rem;flex-shrink:0;}',
    '[data-spare-qty-stepper] button{appearance:none;border:0;background:#f5a623;color:#fff;width:1.75rem;height:1.75rem;border-radius:0.25rem;font:inherit;font-weight:600;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;padding:0;}',
    '[data-spare-qty-stepper] button:hover{filter:brightness(0.95);}',
    '[data-spare-qty-stepper] [data-spare-qty-value]{min-width:1.25rem;text-align:center;font-weight:600;font-variant-numeric:tabular-nums;}',
    '[spare-part-add].is-hidden-while-qty,[data-spare-add-host].is-hidden-while-qty{display:none!important;}'
  ].join('');
  document.head.appendChild(st);
}

function findAddHost(container){
  return container.querySelector('[spare-part-add]')||
    container.querySelector('.spare-part-qty-plus')||
    container.querySelector('.spare-part-checkbox')||
    container.querySelector('.spare-part-check')||
    null;
}

function setSparePartQty(container,nextQty){
  const title=getSparePartTitle(container);
  const description=getSparePartDescription(container);
  const parentTitle=getParentProductTitle();
  const parentSlug=getParentProductSlug();
  const cart=mergeDuplicateSpareParts(getCart());
  const sameParent=(i)=>norm(i.parentProductTitle)===norm(parentTitle)||(parentSlug&&i.parentProductSlug===parentSlug);
  const idx=cart.findIndex(i=>i.isSparePart&&norm(i.title)===norm(title)&&sameParent(i));
  const qty=Math.max(0,Number(nextQty)||0);
  if(qty<=0){
    if(idx>=0)cart.splice(idx,1);
  }else if(idx>=0){
    cart[idx].qty=qty;
  }else{
    const other=isOtherSparePart(title)||isDesignerOtherNode(container)||container.hasAttribute('data-quote-other-option');
    const sp={title:other?'Other':title,description:other?'':description,qty,isSparePart:true,parentProductTitle:parentTitle||''};
    if(parentSlug)sp.parentProductSlug=parentSlug;
    const parentSize=getParentProductSizeRange();
    const parentImage=getParentProductImage();
    const parentDesc=getParentProductDescription();
    if(parentSize)sp.parentProductSizeRange=parentSize;
    if(parentImage)sp.parentProductImage=parentImage;
    if(parentDesc)sp.parentProductDescription=parentDesc;
    if(other){sp.needsOtherDescription=true;sp.isOtherSparePart=true;}
    cart.push(sp);
  }
  setCart(cart);
  updateSparePartButtonsState();
  if(typeof window.updateNavQty==='function')window.updateNavQty();
  return qty;
}

function ensureProductPageStepper(container,qty){
  ensureSpareQtyStyles();
  let stepper=container.querySelector('[data-spare-qty-stepper]');
  if(!stepper){
    stepper=document.createElement('div');
    stepper.setAttribute('data-spare-qty-stepper','');
    stepper.innerHTML='<button type="button" data-spare-qty-minus aria-label="Decrease quantity">−</button><span data-spare-qty-value>1</span><button type="button" data-spare-qty-plus aria-label="Increase quantity">+</button>';
    const host=findAddHost(container);
    if(host&&host.parentElement)host.parentElement.insertBefore(stepper,host.nextSibling);
    else container.appendChild(stepper);
    stepper.querySelector('[data-spare-qty-minus]').addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      const cur=isSparePartInCart(container).qty||1;
      const next=setSparePartQty(container,cur-1);
      if(next<=0&&typeof window.updateSparePartButtonsState==='function')window.updateSparePartButtonsState();
    });
    stepper.querySelector('[data-spare-qty-plus]').addEventListener('click',e=>{
      e.preventDefault();e.stopPropagation();
      const cur=isSparePartInCart(container).qty||0;
      setSparePartQty(container,cur+1);
    });
  }
  const val=stepper.querySelector('[data-spare-qty-value]');
  if(val)val.textContent=String(qty);
  return stepper;
}

function updateSparePartButtonsState(){
  const sel='[spare-part-other], [spare-part-item], .spare-part-item, .collection_spare-part-item, .list-spare_parts .w-dyn-item, [data-quote-other-option]';
  document.querySelectorAll(sel).forEach(container=>{
    const host=findAddHost(container);
    const{inCart,qty}=isSparePartInCart(container);
    const checkbox=container.querySelector('.spare-part-checkbox input[type="checkbox"]')||container.querySelector('input[type="checkbox"]');
    if(checkbox){
      checkbox.checked=inCart;
      checkbox.setAttribute('aria-checked',inCart?'true':'false');
    }
    if(host){
      host.classList.toggle('spare-part-in-quote',inCart);
      host.setAttribute('data-in-quote',inCart?'true':'false');
    }
    let stepper=container.querySelector('[data-spare-qty-stepper]');
    if(inCart){
      if(host)host.classList.add('is-hidden-while-qty');
      ensureProductPageStepper(container,qty||1);
    }else{
      if(host)host.classList.remove('is-hidden-while-qty');
      if(stepper)stepper.remove();
    }
  });
}
window.updateSparePartButtonsState=updateSparePartButtonsState;
window.setSparePartQtyFromList=setSparePartQty;

function getSparePartContainerFromTrigger(trigger){
  let c=trigger.closest('[spare-part-other]')||trigger.closest('[data-quote-other-option]')||trigger.closest('[spare-part-item]')||trigger.closest('.spare-part-item')||trigger.closest('.collection_spare-part-item');
  if(!c){const d=trigger.closest('.w-dyn-item'); if(d&&(d.closest('.list-spare_parts')||d.closest('.spare-part-form')))c=d;}
  return c;
}

function toggleSparePartInQuote(trigger){
  const container=getSparePartContainerFromTrigger(trigger);
  if(!container)return;
  // If already in cart, product-page qty stepper owns adjustments — ignore re-clicks on the add host.
  const{inCart}=isSparePartInCart(container);
  if(inCart)return;

  const title=getSparePartTitle(container);
  const description=getSparePartDescription(container);
  const parentTitle=getParentProductTitle();
  const parentSlug=getParentProductSlug();
  const cart=getCart();
  const merged=mergeDuplicateSpareParts(cart);
  const sizeRange=getParentProductSizeRange();
  const parentImage=getParentProductImage();
  const parentDesc=getParentProductDescription();
  const other=isOtherSparePart(title)||isDesignerOtherNode(container)||container.hasAttribute('data-quote-other-option');
  const sp={title:other?'Other':title,description:other?'':description,qty:1,isSparePart:true,parentProductTitle:parentTitle||''};
  if(parentSlug)sp.parentProductSlug=parentSlug;
  if(sizeRange)sp.parentProductSizeRange=sizeRange;
  if(parentImage)sp.parentProductImage=parentImage;
  if(parentDesc)sp.parentProductDescription=parentDesc;
  if(other){
    sp.needsOtherDescription=true;
    sp.isOtherSparePart=true;
  }
  merged.push(sp);
  setCart(merged);
  updateSparePartButtonsState();
  if(typeof window.updateNavQty==='function')window.updateNavQty();
  openQuoteModal();
  if(other){
    setTimeout(()=>{
      const input=document.querySelector('[data-quote-other-description]');
      if(input){input.focus();try{input.select();}catch(_){}}
    },120);
  }
}

function getCheckboxFromClickTarget(target){
  if(target&&target.type==='checkbox')return target;
  if(target&&target.tagName==='LABEL'){
    const cb=target.control||(target.htmlFor?document.getElementById(target.htmlFor):null)||target.querySelector('input[type="checkbox"]');
    if(cb)return cb;
  }
  const wrapper=target?.closest?.('.w-checkbox, .spare-part-checkbox, .fs-checkbox-5_wrapper, .checkbox_field, .form_checkbox');
  if(wrapper){
    const cb=wrapper.querySelector('input[type="checkbox"]');
    if(cb)return cb;
  }
  return null;
}

function isDesignerOtherNode(el){
  return !!(el&&(el.hasAttribute('spare-part-other')||el.closest?.('[spare-part-other]')));
}

function getDesignerOtherNodes(){
  return [...document.querySelectorAll('[spare-part-other]')];
}

/** Remove CMS placeholder rows named "Other" — Designer [spare-part-other] is the real option. */
function removeCmsOtherItems(){
  const candidates=document.querySelectorAll('.list-spare_parts .w-dyn-item, .list-spare_parts .collection_spare-part-item, [data-spare-parts-list] .w-dyn-item');
  candidates.forEach(el=>{
    if(isDesignerOtherNode(el)||el.querySelector?.('[spare-part-other]'))return;
    if(el.hasAttribute('data-quote-other-option')){el.remove();return;}
    if(isOtherSparePart(getSparePartTitle(el)))el.remove();
  });
  // Also remove any previously JS-injected fallback rows when Designer Other exists
  if(getDesignerOtherNodes().length){
    document.querySelectorAll('[data-quote-other-option]').forEach(el=>el.remove());
  }
}

/** Keep Designer Other as the last sibling in its spare-parts section. */
function moveDesignerOtherToEnd(){
  getDesignerOtherNodes().forEach(other=>{
    const parent=other.parentElement;
    if(!parent)return;
    parent.appendChild(other);
  });
}

function syncOtherOptionInLists(){
  removeCmsOtherItems();
  moveDesignerOtherToEnd();
  updateSparePartButtonsState();
  ensureMachineQuoteToggle();
}

function machineInCart(){
  const title=getParentProductTitle();
  const slug=getParentProductSlug();
  const cart=getCart();
  return cart.some(i=>!i.isSparePart&&((slug&&i.productSlug===slug)||norm(i.title)===norm(title)));
}

function ensureMachineQuoteToggleStyles(){
  if(document.getElementById('machine-quote-toggle-style'))return;
  const st=document.createElement('style');
  st.id='machine-quote-toggle-style';
  st.textContent=[
    '[data-machine-quote-toggle]{display:flex;align-items:center;justify-content:space-between;gap:1rem;margin:0 0 1rem;padding:0.85rem 1rem;border:1px solid rgba(0,0,0,0.12);border-radius:0.5rem;background:#fff;}',
    '[data-machine-quote-toggle] .mqt-copy{display:flex;flex-direction:column;gap:0.15rem;min-width:0;}',
    '[data-machine-quote-toggle] .mqt-label{font-size:0.75rem;letter-spacing:0.04em;text-transform:uppercase;opacity:0.7;}',
    '[data-machine-quote-toggle] .mqt-title{font-weight:600;}',
    '[data-machine-quote-toggle] input[type="checkbox"]{width:1.15rem;height:1.15rem;accent-color:#f5a623;cursor:pointer;flex-shrink:0;}'
  ].join('');
  document.head.appendChild(st);
}

function setFullMachineInQuote(include){
  const title=getParentProductTitle()||'Product';
  const slug=getParentProductSlug();
  const sizeRange=getParentProductSizeRange();
  const parentDesc=getParentProductDescription();
  let cart=mergeDuplicateSpareParts(getCart());
  const idx=cart.findIndex(i=>!i.isSparePart&&((slug&&i.productSlug===slug)||norm(i.title)===norm(title)));
  if(include){
    if(idx<0){
      const prod={title,description:parentDesc||'',qty:1};
      if(slug)prod.productSlug=slug;
      if(sizeRange)prod.productSizeRange=sizeRange;
      const image=getParentProductImage();
      if(image)prod.productImage=image;
      cart.push(prod);
    }
  }else if(idx>=0){
    cart.splice(idx,1);
  }
  setCart(cart);
  if(typeof window.updateNavQty==='function')window.updateNavQty();
  ensureMachineQuoteToggle();
  if(include)openQuoteModal();
}

function ensureMachineQuoteToggle(){
  // Only on product pages that expose parent machine metadata + spare parts list
  const list=document.querySelector('.list-spare_parts, [data-spare-parts-list]');
  const title=getParentProductTitle();
  if(!list||!title)return;
  ensureMachineQuoteToggleStyles();
  let host=document.querySelector('[data-machine-quote-toggle]');
  if(!host){
    host=document.createElement('div');
    host.setAttribute('data-machine-quote-toggle','');
    host.innerHTML='<div class="mqt-copy"><div class="mqt-label">Request quote for full machine</div><div class="mqt-title"></div></div><input type="checkbox" aria-label="Request quote for full machine">';
    list.parentElement?.insertBefore(host,list);
    const cb=host.querySelector('input[type="checkbox"]');
    cb.addEventListener('change',()=>{
      setFullMachineInQuote(!!cb.checked);
    });
  }
  const titleEl=host.querySelector('.mqt-title');
  if(titleEl)titleEl.textContent=title;
  const cb=host.querySelector('input[type="checkbox"]');
  if(cb)cb.checked=machineInCart();
}
window.ensureMachineQuoteToggle=ensureMachineQuoteToggle;

function init(){
  document.addEventListener('click',e=>{
    if(e.target.closest('[data-spare-qty-stepper]'))return;
    let trigger=e.target.closest('[spare-part-add]')||e.target.closest('.spare-part-qty-plus')||e.target.closest('.spare-part-check');
    if(!trigger){
      const cb=getCheckboxFromClickTarget(e.target);
      if(cb&&getSparePartContainerFromTrigger(cb))trigger=cb;
    }
    if(!trigger)return;
    // Host is hidden while qty stepper is shown — don't toggle via leftover clicks
    if(trigger.classList?.contains('is-hidden-while-qty')||trigger.closest?.('.is-hidden-while-qty'))return;
    e.preventDefault();
    e.stopPropagation();
    toggleSparePartInQuote(trigger);
  },{capture:true});

  const modal=document.querySelector('[data-modal-name="quote-modal"]');
  if(modal){
    const obs=new MutationObserver(()=>{
      if(modal.getAttribute('data-modal-status')==='active'){}else updateSparePartButtonsState();
    });
    obs.observe(modal,{attributes:true,attributeFilter:['data-modal-status']});
  }

  document.addEventListener('quoteCartUpdated',()=>{
    updateSparePartButtonsState();
    ensureMachineQuoteToggle();
  });
  syncOtherOptionInLists();
  // CMS/Finsweet may re-render list items after first paint
  setTimeout(syncOtherOptionInLists,300);
  setTimeout(syncOtherOptionInLists,1000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,100));
else setTimeout(init,100);
})();
