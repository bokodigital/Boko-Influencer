(function () {
  // Resolve the influencer referral code from the URL (?ref=) or, on later
  // pages, from the boko_ref attribution cookie set on the first visit.
  function getRef() {
    try {
      var params = new URLSearchParams(window.location.search);
      var urlRef = params.get("ref") || params.get("boko_ref");
      if (urlRef) return urlRef;
      var m = document.cookie.match(/(?:^|;\s*)boko_ref=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    } catch (e) {
      return null;
    }
  }

  // 1) Landing: on ?ref=, set the attribution cookie client-side (so it never
  //    depends on the proxy Set-Cookie header) and log the click via the proxy.
  try {
    var p = new URLSearchParams(window.location.search);
    var urlRef = p.get("ref") || p.get("boko_ref");
    if (urlRef) {
      try {
        document.cookie =
          "boko_ref=" + encodeURIComponent(urlRef) +
          "; path=/; max-age=2592000; SameSite=Lax";
      } catch (e) {}
      fetch("/apps/boko-influencer/track?ref=" + encodeURIComponent(urlRef), {
        method: "GET",
        credentials: "same-origin",
      }).catch(function () {});
    }
  } catch (e) {}

  // 2) Add-to-cart detection — THEME-AGNOSTIC.
  //    Instead of intercepting the add request (which themes/apps implement in
  //    many incompatible ways and can hide from a fetch/XHR wrapper), we watch
  //    Shopify's own cart via /cart.js and fire whenever the item count rises.
  //    This catches every add: product pages, quick-add, cart drawers, apps.
  var lastCount = null;
  var lastAtc = 0;

  function fireAtc() {
    try {
      var r = getRef();
      if (!r) return;
      var now = Date.now();
      if (now - lastAtc < 1000) return;
      lastAtc = now;
      fetch("/apps/boko-influencer/atc?ref=" + encodeURIComponent(r), {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  function readCartCount(cb) {
    try {
      fetch("/cart.js", { credentials: "same-origin", headers: { Accept: "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (c) { cb(c && typeof c.item_count === "number" ? c.item_count : null); })
        .catch(function () {});
    } catch (e) {}
  }

  function checkCart() {
    readCartCount(function (n) {
      if (n == null) return;
      if (lastCount != null && n > lastCount) fireAtc();
      lastCount = n;
    });
  }

  // Establish the baseline count, then watch for increases.
  readCartCount(function (n) { lastCount = n; });
  setInterval(checkCart, 2500);
  window.addEventListener("focus", checkCart);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) checkCart();
  });
  // Re-check shortly after any click so a button-triggered add registers fast.
  document.addEventListener(
    "click",
    function () {
      setTimeout(checkCart, 700);
      setTimeout(checkCart, 1600);
    },
    true
  );
})();
