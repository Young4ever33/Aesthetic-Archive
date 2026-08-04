(() => {
  window.__AA_REVIEW_ACCESS__ = fetch('/api/profile', {
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  })
    .then(async response => {
      const payload = await response.json().catch(() => ({}));
      const profile = response.ok ? payload.data : null;
      const allowed = Boolean(profile && (profile.role === 'reviewer' || profile.role === 'admin'));
      document.documentElement.dataset.reviewAccess = allowed ? 'granted' : 'denied';
      document.querySelectorAll('.reviewer-only').forEach(node => { node.hidden = !allowed; });
      window.dispatchEvent(new CustomEvent('aa:review-access', { detail: { allowed, profile } }));
      return { allowed, profile };
    })
    .catch(error => {
      document.documentElement.dataset.reviewAccess = 'denied';
      document.querySelectorAll('.reviewer-only').forEach(node => { node.hidden = true; });
      window.dispatchEvent(new CustomEvent('aa:review-access', { detail: { allowed: false, profile: null } }));
      console.error('REVIEW_ACCESS_BOOTSTRAP_FAILED', error);
      return { allowed: false, profile: null };
    });
})();
