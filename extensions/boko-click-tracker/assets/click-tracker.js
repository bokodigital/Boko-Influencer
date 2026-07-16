(function () {
  try {
    var params = new URLSearchParams(window.location.search);
    var ref = params.get("ref") || params.get("boko_ref");
    if (!ref) return;

    fetch("/apps/boko-influencer/track?ref=" + encodeURIComponent(ref), {
      method: "GET",
      credentials: "same-origin",
    }).catch(function () {
      // Fail silently - never block the storefront on tracking errors.
    });
  } catch (e) {
    // no-op
  }
})();
