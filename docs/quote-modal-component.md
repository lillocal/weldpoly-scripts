# Quote modal — machine item (`data-quote-item`)

Designer component rendered in the quote drawer for **full machines**. Spare parts use `data-quote-part-item`; “Other” uses `data-quote-other`.

## What must be displayed (machine row)

| UI | Source in cart / script | Designer hook |
|----|-------------------------|---------------|
| Product **thumbnail** | `productImage` | `img[data-quote-image]` |
| Label | fixed copy | `[data-quote-title]` → `Request quote for full machine` |
| Machine **name** | `title` | first `[data-quote-description]` |
| Size / unit range | `productSizeRange` (fallback: `description`) | second `[data-quote-description]` (`.quote_item-description-copy`) |
| Include machine | checkbox state | `.quote_item-select` (styled empty div; JS toggles `aria-checked` / `is-checked`) |
| Accordion | open/close spare parts under this machine | `.quote_item-chevron` |

Spare parts for that machine render **below** the row (qty + remove). Chevron collapses/expands them.

## Required Designer structure

```html
<div data-quote-item class="quote_item">
  <img data-quote-image class="quote_item_image" alt="" />
  <div class="quote_item_content">
    <p data-quote-title class="quote_item-title">Request quote for full machine</p>
    <p data-quote-description class="quote_item-description">Item name</p>
    <p data-quote-description class="quote_item-description-copy">Unit</p>
  </div>
  <div class="quote_item-actions">
    <div class="quote_item-select"></div>
    <div class="quote_item-chevron">…</div>
  </div>
</div>
```

- Keep `data-quote-item` / `data-quote-part-item` / `data-quote-other` as **hidden templates** (CSS `display: none` on the template nodes).
- Do **not** put a native `<input type="checkbox">` inside `.quote_item-select` — that control is the SVG-styled div.

## How images get into the cart

When the user clicks **Add to quote** (`[data-add-quote]`), the script stores `productImage` from, in order:

1. `data-quote-image` on the button (optional explicit URL)
2. Nearest product card image: `.card_image` inside the same `.w-dyn-item` / `.card`
3. Product page hero: `.product-header1_image` or `[data-quote-product-image]`

**Recommended on category cards:** ensure the visible product image uses class `card_image` (or set `data-quote-image` on the CTA).

**Recommended on product pages:** keep `.product-header1_image` (or `data-quote-product-image`).

Also store when possible:

- `data-quote-title` — machine name  
- `data-quote-description` or `data-product-size-range` — size range  
- product slug via `/products/{slug}` details link or `[data-product-slug]`

## Related templates

| Attribute | Role |
|-----------|------|
| `data-quote-part-item` | Spare part line (name, code, qty, remove) |
| `data-quote-other` | “Other” line (title + `.quote_item-input-other` + qty + remove) |
| `data-quote-part-name` / `data-quote-part-code` | Part title / code |
| `data-quote-remove` | Remove part |
| `data-quote-number` | Qty display |

## Scripts

- `weldpoly-quote-system.js` — cart, modal render, machine row, accordion, images  
- `weldpoly-spare-parts-quantity-control-FIXED-ECOMMERCE.js` — add parts; passes `parentProductImage` for the machine header  
