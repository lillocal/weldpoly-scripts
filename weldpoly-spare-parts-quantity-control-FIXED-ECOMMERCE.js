/**
 * Weldpoly Spare Parts — Add spare parts to quote
 * Load AFTER weldpoly-quote-system.js
 * Uses same cart; quote system renders modal. Triggers: [spare-part-add], .spare-part-qty-plus, checkbox in [spare-part-item]
 *
 * "Other" is a static UI option (not a CMS catalog item): hidden/removed from CMS lists,
 * injected once at the end of each spare-parts list, and collects a one-sentence description in the quote cart.
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
  return{inCart:idx>=0,index:idx>=0?idx:-1};
}

function updateSparePartButtonsState(){
  const sel='[spare-part-item], .spare-part-item, .collection_spare-part-item, .list-spare_parts .w-dyn-item, [data-quote-other-option]';
  document.querySelectorAll(sel).forEach(container=>{
    const trigger=container.querySelector('[spare-part-add]')||container.querySelector('.spare-part-qty-plus')||container.querySelector('.spare-part-checkbox input[type="checkbox"]')||container.querySelector('.spare-part-checkbox')||container.querySelector('.spare-part-check')||container.querySelector('input[type="checkbox"]');
    if(!trigger)return;
    const{inCart}=isSparePartInCart(container);
    const label=trigger.closest?.('label')||trigger;
    const checkbox=trigger.type==='checkbox'?trigger:(container.querySelector('.spare-part-checkbox input[type="checkbox"]')||container.querySelector('input[type="checkbox"]'));
    if(checkbox){
      checkbox.checked=inCart;
      checkbox.setAttribute('aria-checked',inCart?'true':'false');
    }
    if(label&&label!==trigger)label.classList.toggle('spare-part-in-quote',inCart);
    if(trigger.type!=='checkbox'){
      trigger.setAttribute('data-in-quote',inCart?'true':'false');
      trigger.classList.toggle('spare-part-in-quote',inCart);
      const t=(trigger.textContent||'').trim();
      if(t==='+'||t==='')trigger.textContent=inCart?'\u2713':'+';
    }
  });
}
window.updateSparePartButtonsState=updateSparePartButtonsState;

function getSparePartContainerFromTrigger(trigger){
  let c=trigger.closest('[data-quote-other-option]')||trigger.closest('[spare-part-item]')||trigger.closest('.spare-part-item')||trigger.closest('.collection_spare-part-item');
  if(!c){const d=trigger.closest('.w-dyn-item'); if(d&&(d.closest('.list-spare_parts')||d.closest('.spare-part-form')))c=d;}
  return c;
}

function toggleSparePartInQuote(trigger){
  const container=getSparePartContainerFromTrigger(trigger);
  if(!container)return;
  const title=getSparePartTitle(container);
  const description=getSparePartDescription(container);
  const parentTitle=getParentProductTitle();
  const parentSlug=getParentProductSlug();
  const cart=getCart();
  const merged=mergeDuplicateSpareParts(cart);
  const sameParent=(i)=>norm(i.parentProductTitle)===norm(parentTitle)||(parentSlug&&i.parentProductSlug===parentSlug);
  const same=merged.findIndex(i=>i.isSparePart&&norm(i.title)===norm(title)&&sameParent(i));
  if(same>=0){
    merged.splice(same,1);
    setCart(merged);
    updateSparePartButtonsState();
    if(typeof window.updateNavQty==='function')window.updateNavQty();
  }else{
    const sizeRange=getParentProductSizeRange();
    const hasParent=(parentTitle&&merged.some(i=>!i.isSparePart&&norm(i.title)===norm(parentTitle)))||(parentSlug&&merged.some(i=>!i.isSparePart&&i.productSlug===parentSlug));
    if(hasParent&&sizeRange){
      const ex=merged.find(i=>!i.isSparePart&&(norm(i.title)===norm(parentTitle)||(parentSlug&&i.productSlug===parentSlug)));
      if(ex&&!ex.productSizeRange)ex.productSizeRange=sizeRange;
    }
    if(!hasParent&&(parentTitle||parentSlug)){
      const parentDesc=getParentProductDescription();
      const prod={title:parentTitle||'Product',description:parentDesc||'',qty:1};
      if(parentSlug)prod.productSlug=parentSlug;
      if(sizeRange)prod.productSizeRange=sizeRange;
      merged.push(prod);
    }
    const other=isOtherSparePart(title)||container.hasAttribute('data-quote-other-option');
    const sp={title:other?'Other':title,description:other?'':description,qty:1,isSparePart:true,parentProductTitle:parentTitle||''};
    if(parentSlug)sp.parentProductSlug=parentSlug;
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

function getSparePartsListRoots(){
  const roots=[];
  document.querySelectorAll('.list-spare_parts').forEach(el=>{
    if(el.classList.contains('w-dyn-items')||el.getAttribute('role')==='list')roots.push(el);
    else{
      const nested=el.querySelector('.w-dyn-items, [role="list"]');
      roots.push(nested||el);
    }
  });
  document.querySelectorAll('[data-spare-parts-list]').forEach(el=>{
    if(!roots.includes(el))roots.push(el);
  });
  return roots;
}

/** Remove CMS placeholder rows named "Other" — they are not real catalog parts. */
function removeCmsOtherItems(){
  const candidates=document.querySelectorAll('.list-spare_parts .w-dyn-item, .list-spare_parts .collection_spare-part-item, [data-spare-parts-list] .w-dyn-item');
  candidates.forEach(el=>{
    if(el.hasAttribute('data-quote-other-option'))return;
    if(isOtherSparePart(getSparePartTitle(el)))el.remove();
  });
}

function buildStaticOtherNode(template){
  let node;
  if(template){
    node=template.cloneNode(true);
  }else{
    node=document.createElement('div');
    node.className='collection_spare-part-item';
    node.setAttribute('role','listitem');
    node.innerHTML='<div spare-part-item="" class="spare-part-item"><div spare-part-content="" class="spare-part-content-wrap"><div spare-part-name="" class="spare-part-name">Other</div></div><div class="spare-part-quantity-control"><label spare-part-add="" class="w-checkbox spare-part-checkbox"><div class="w-checkbox-input w-checkbox-input--inputType-custom spare-part-check"></div><input type="checkbox" name="quote-other" data-name="Other" style="opacity:0;position:absolute;z-index:-1"/><span class="spare-part-checkbox_name w-form-label">Other</span></label></div></div>';
  }
  node.removeAttribute('id');
  node.setAttribute('data-quote-other-option','true');
  node.classList.add('is-quote-other-option');
  node.classList.remove('w-dyn-item');

  const nameEl=node.querySelector('.spare-part-name,[spare-part-name]');
  if(nameEl)nameEl.textContent='Other';

  // Strip catalog-only fields from the clone
  node.querySelectorAll('[spare-part-code],[spare-part-machine],[spare-part-description],.spare-part-divisor').forEach(el=>el.remove());
  node.querySelectorAll('.spare-part-code').forEach(el=>{
    if(!el.hasAttribute('spare-part-name')&&!el.classList.contains('spare-part-name'))el.remove();
  });

  const input=node.querySelector('input[type="checkbox"]');
  if(input){
    input.removeAttribute('id');
    input.name='quote-other';
    input.setAttribute('data-name','Other');
    input.checked=false;
  }
  const labelSpan=node.querySelector('.spare-part-checkbox_name, .w-form-label');
  if(labelSpan){
    labelSpan.textContent='Other';
    labelSpan.removeAttribute('for');
  }
  return node;
}

/** Inject a single static Other option at the end of each spare-parts list. */
function ensureStaticOtherOption(){
  getSparePartsListRoots().forEach(list=>{
    if(!list||!list.isConnected)return;
    const existing=list.querySelector(':scope > [data-quote-other-option]');
    if(existing){
      list.appendChild(existing);
      return;
    }
    const template=list.querySelector(':scope > .w-dyn-item, :scope > .collection_spare-part-item, :scope > [spare-part-item]');
    const node=buildStaticOtherNode(template);
    list.appendChild(node);

    // If Webflow empty-state is showing because CMS list was empty, keep Other visible
    const empty=list.parentElement&&list.parentElement.querySelector('.w-dyn-empty');
    if(empty)empty.style.display='none';
    list.style.display='';
  });
}

function syncOtherOptionInLists(){
  removeCmsOtherItems();
  ensureStaticOtherOption();
  updateSparePartButtonsState();
}

function init(){
  document.addEventListener('click',e=>{
    let trigger=e.target.closest('[spare-part-add]')||e.target.closest('.spare-part-qty-plus')||e.target.closest('.spare-part-check');
    if(!trigger){
      const cb=getCheckboxFromClickTarget(e.target);
      if(cb&&getSparePartContainerFromTrigger(cb))trigger=cb;
    }
    if(!trigger)return;
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

  document.addEventListener('quoteCartUpdated',()=>updateSparePartButtonsState());
  syncOtherOptionInLists();
  // CMS/Finsweet may re-render list items after first paint
  setTimeout(syncOtherOptionInLists,300);
  setTimeout(syncOtherOptionInLists,1000);
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(init,100));
else setTimeout(init,100);
})();
