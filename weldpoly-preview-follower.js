/**
 * Weldpoly — OUR EQUIPMENT preview follower
 * Fixes stacked/stuck hover images:
 * - Clears previous clones on row change and on mouseleave
 * - Anchors preview to the hovered row (does not float with the cursor across the page)
 */
(function () {
  'use strict';

  function initPreviewFollower() {
    if (typeof gsap === 'undefined') return;

    document.querySelectorAll('[data-follower-wrap]').forEach(function (wrap) {
      var collection = wrap.querySelector('[data-follower-collection]');
      var items = wrap.querySelectorAll('[data-follower-item]');
      var follower = wrap.querySelector('[data-follower-cursor]');
      var followerInner = wrap.querySelector('[data-follower-cursor-inner]');
      if (!collection || !follower || !followerInner || !items.length) return;

      var prevIndex = null;
      var activeItem = null;
      var clearToken = 0;
      var offset = 100;
      var duration = 0.4;
      var ease = 'power2.inOut';

      gsap.set(follower, { xPercent: -50, yPercent: -50 });

      function clearVisuals(immediate) {
        var token = ++clearToken;
        Array.prototype.slice
          .call(follower.querySelectorAll('[data-follower-visual]'))
          .forEach(function (el) {
            gsap.killTweensOf(el);
            if (immediate) {
              el.remove();
              return;
            }
            gsap.to(el, {
              yPercent: -offset,
              opacity: 0,
              duration: duration,
              ease: ease,
              overwrite: true,
              onComplete: function () {
                if (token === clearToken) el.remove();
              }
            });
          });
      }

      function anchorToItem(item) {
        var rect = item.getBoundingClientRect();
        var x = Math.min(rect.right - 40, window.innerWidth - 40);
        var y = rect.top + rect.height / 2;
        gsap.to(follower, {
          x: x,
          y: y,
          duration: 0.35,
          ease: 'power3.out',
          overwrite: 'auto'
        });
      }

      function showItem(item, index) {
        var forward = prevIndex === null || index > prevIndex;
        prevIndex = index;
        activeItem = item;

        clearVisuals(false);

        var visual = item.querySelector('[data-follower-visual]');
        if (!visual) return;

        var clone = visual.cloneNode(true);
        clone.style.opacity = '1';
        followerInner.appendChild(clone);
        anchorToItem(item);

        gsap.fromTo(
          clone,
          { yPercent: forward ? offset : -offset, opacity: 0 },
          { yPercent: 0, opacity: 1, duration: duration, ease: ease, overwrite: true }
        );
      }

      items.forEach(function (item, index) {
        item.addEventListener('mouseenter', function () {
          showItem(item, index);
        });
      });

      window.addEventListener(
        'scroll',
        function () {
          if (activeItem) anchorToItem(activeItem);
        },
        { passive: true }
      );

      collection.addEventListener('mouseleave', function () {
        activeItem = null;
        prevIndex = null;
        clearVisuals(true);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPreviewFollower);
  } else {
    initPreviewFollower();
  }
})();
