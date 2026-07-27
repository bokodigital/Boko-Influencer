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

  function isCartAdd(url) {
    try {
      return /\/cart\/add(\.js)?($|\?)/.test(String(url));
    } catch (e) {
      return false;
    }
  }

  var lastAtc = 0;
  function trackAtc() {
    try {
      var r = getRef();
      if (!r) return;
      var now = Date.now();
      if (now - lastAtc < 800) return; // throttle duplicate fires for one add
      lastAtc = now;
      fetch("/apps/boko-influencer/atc?ref=" + encodeURIComponent(r), {
        method: "POST",
        credentials: "same-origin",
        keepalive: true,
      }).catch(function () {});
    } catch (e) {}
  }

  // 1) Landing: when the storefront loads with ?ref=, set the attribution
  //    cookie client-side (so it never depends on the proxy Set-Cookie header)
  //    and log the click via the app proxy.
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

  // 2) Add-to-cart detection via fetch — CLOBBER-PROOF.
  //    Other apps/themes often replace window.fetch after us. Instead of a
  //    one-time wrap, we install an accessor so window.fetch ALWAYS returns our
  //    wrapper, and if anyone reassigns window.fetch we transparently re-wrap
  //    their function — keeping our hook permanently outermost.
  function wrapFetch(fn) {
    return function (input, init) {
      var url = typeof input === "string" ? input : input && input.url;
      var method = (init && init.method) || (input && input.method) || "GET";
      var res = fn.apply(this, arguments);
      try {
        if (res && typeof res.then === "function" && isCartAdd(url) && /post/i.test(method)) {
          res.then(function (r) { if (r && r.ok) trackAtc(); }).catch(function () {});
        }
      } catch (e) {}
      return res;
    };
  }
  try {
    var currentFetch = window.fetch;
    var wrappedFetch = wrapFetch(currentFetch);
    Object.defineProperty(window, "fetch", {
      configurable: true,
      enumerable: true,
      get: function () { return wrappedFetch; },
      set: function (v) { currentFetch = v; wrappedFetch = wrapFetch(v); },
    });
  } catch (e) {
    // Fallback: plain wrap if defineProperty is blocked.
    try {
      var of = window.fetch;
      window.fetch = wrapFetch(of);
    } catch (e2) {}
  }

  // 3) Add-to-cart detection via XMLHttpRequest.
  try {
    var origOpen = XMLHttpRequest.prototype.open;
    var origSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__bokoAtc = isCartAdd(url) && /post/i.test(method || "");
      return origOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function () {
      var self = this;
      if (self.__bokoAtc) {
        self.addEventListener("load", function () {
          if (self.status >= 200 && self.status < 300) trackAtc();
        });
      }
      return origSend.apply(this, arguments);
    };
  } catch (e) {}

  // 4) Fallback: classic (non-AJAX) add-to-cart form submissions.
  try {
    document.addEventListener(
      "submit",
      function (e) {
        var form = e.target;
        if (form && form.action && isCartAdd(form.action)) trackAtc();
      },
      true
    );
  } catch (e) {}
})();
