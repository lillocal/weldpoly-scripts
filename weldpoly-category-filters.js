/**
 * Weldpoly Category Filters
 * - Hide Metric/Inch on Workshop Saws, Saddle Fusion, Debeaders
 * - Capability-match diameter search (number → min–max cover; Inch → mm)
 * - Name/code search when the query is not a pure number
 * Requires: Finsweet Attributes list + pipe-min-mm / pipe-max-mm / unit-system on cards
 */
(function () {
  'use strict';

  var HIDE_UNIT_SLUGS = ['workshop-saws', 'saddle-fusion', 'debeaders'];
  var INCH_TO_MM = 25.4;

  function categorySlug() {
    var m = location.pathname.match(/\/category\/([^\/]+)/);
    return m ? m[1] : '';
  }

  function hideUnitFilterIfNeeded() {
    if (HIDE_UNIT_SLUGS.indexOf(categorySlug()) === -1) return;
    document.querySelectorAll('.filter_block.unit-system').forEach(function (el) {
      el.style.display = 'none';
      el.setAttribute('aria-hidden', 'true');
    });
  }

  function selectedUnit() {
    var checked = document.querySelector('input[fs-list-field="unit-system"]:checked');
    if (checked && checked.getAttribute('fs-list-value')) {
      return checked.getAttribute('fs-list-value');
    }
    return 'Metric';
  }

  function updateSearchPlaceholder(input) {
    if (!input) return;
    if (selectedUnit() === 'Inch') {
      input.placeholder = 'Search diameter (in) or name';
    } else {
      input.placeholder = 'Search diameter (mm) or name';
    }
  }

  function parseQuery(raw) {
    var q = (raw || '').trim();
    if (!q) return { type: 'empty' };
    if (/^\d+(?:\.\d+)?$/.test(q)) {
      return { type: 'diameter', value: parseFloat(q) };
    }
    return { type: 'name', value: q.toLowerCase() };
  }

  function fieldNum(item, key) {
    var f = item.fields && item.fields[key];
    var n = f != null ? Number(f.value) : NaN;
    return n;
  }

  function coversDiameter(item, mm) {
    var min = fieldNum(item, 'pipe-min-mm');
    var max = fieldNum(item, 'pipe-max-mm');
    if (isNaN(min) || isNaN(max)) return false;
    var lo = Math.min(min, max);
    var hi = Math.max(min, max);
    return mm >= lo && mm <= hi;
  }

  function refilter(listInstance) {
    if (typeof listInstance.filter === 'function') {
      listInstance.filter();
      return;
    }
    if (typeof listInstance.triggerHook === 'function') {
      listInstance.triggerHook('filter');
    }
  }

  hideUnitFilterIfNeeded();

  window.FinsweetAttributes = window.FinsweetAttributes || [];
  window.FinsweetAttributes.push([
    'list',
    function (listInstances) {
      listInstances.forEach(function (listInstance) {
        var searchInput =
          document.querySelector('.filter_search') ||
          document.querySelector('#field') ||
          document.querySelector('[fs-list-element="filters"] input[type="text"]');

        updateSearchPlaceholder(searchInput);

        listInstance.addHook('filter', function (items) {
          if (!searchInput) return items;
          var parsed = parseQuery(searchInput.value);
          if (parsed.type === 'empty') return items;

          if (parsed.type === 'diameter') {
            var mm = parsed.value;
            if (selectedUnit() === 'Inch') mm = mm * INCH_TO_MM;
            return items.filter(function (item) {
              return coversDiameter(item, mm);
            });
          }

          var q = parsed.value;
          return items.filter(function (item) {
            var name = String(
              (item.fields && item.fields.name && item.fields.name.value) || ''
            ).toLowerCase();
            return name.indexOf(q) !== -1;
          });
        });

        if (searchInput) {
          // Ensure Finsweet built-in * search is not also attached
          if (searchInput.getAttribute('fs-list-field') === '*') {
            searchInput.removeAttribute('fs-list-field');
          }

          var trigger = function () {
            updateSearchPlaceholder(searchInput);
            refilter(listInstance);
          };

          searchInput.addEventListener('input', trigger);
          searchInput.addEventListener('change', trigger);
          document
            .querySelectorAll('input[fs-list-field="unit-system"]')
            .forEach(function (radio) {
              radio.addEventListener('change', trigger);
            });
        }
      });
    }
  ]);
})();
