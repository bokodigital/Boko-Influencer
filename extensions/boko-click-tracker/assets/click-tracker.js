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

  // 1) Landing click: when the storefront loads with ?ref=, log the click and
  //    set the attribution cookie (the app proxy handles both).
  try {
    var p = new URLSearchParams(window.location.search);
    var urlRef = p.get("ref") || p.get("boko_ref");
    if (urlRef) {
      fetch("/apps/boko-influencer/track?ref=" + encodeURIComponent(urlRef), {
        method: "GET",
        credentials: "same-origin",
      }).catch(function () {});
    }
  } catch (e) {}

  // 2) Add-to-cart tracking, attributed to the influencer if we have a ref.
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

  function isCartAdd(url) {
    try {
      return /\/cart\/add(\.js)?($|\?)/.test(String(url));
    } catch (e) {
      return false;
    }
  }

  // Intercept AJAX add-to-cart via fetch()
  try {
    var origFetch = window.fetch;
    if (origFetch) {
      window.fetch = function (input, init) {
        var url = typeof input === "string" ? input : input && input.url;
        var method = (init && init.method) || (input && input.method) || "GET";
        var res = origFetch.apply(this, arguments);
        if (isCartAdd(url) && /post/i.test(method)) {
          res.then(function (r) { if (r && r.ok) trackAtc(); }).catch(function () {});
        }
        return res;
      };
    }
  } catch (e) {}

  // Intercept AJAX add-to-cart via XMLHttpRequest
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

  // Fallback: classic (non-AJAX) add-to-cart form submissions
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
