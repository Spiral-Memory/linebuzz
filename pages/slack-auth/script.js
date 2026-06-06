document.addEventListener('DOMContentLoaded', () => {
  const body = document.body;
  const urlParams = new URLSearchParams(window.location.search);
  const status = urlParams.get('status');
  const error = urlParams.get('error');
  const redirectUri = urlParams.get('redirect_uri');

  const hasError = status === 'failed' || error;
  if (hasError) {
    body.classList.add('has-error');
  }

  const pill = hasError 
    ? document.getElementById('status-pill-failed')
    : document.getElementById('status-pill-success');

  if (pill) {
    setTimeout(() => {
      pill.textContent = 'info: authenticating...';
    }, 700);

    setTimeout(() => {
      pill.classList.remove('loading');
      if (hasError) {
        pill.classList.add('failed');
        pill.textContent = 'error: connection failed';
      } else {
        pill.classList.add('success');
        pill.textContent = 'success: connection active';
      }
    }, 1400);
  }

  if (!hasError && redirectUri) {
    const redirectButtons = document.querySelectorAll('.redirect-btn');
    redirectButtons.forEach(btn => {
      btn.href = redirectUri;
    });

    setTimeout(() => {
      window.location.href = redirectUri;
    }, 2000);
  }
});
