document.addEventListener('DOMContentLoaded', () => {
  const selectionState = document.getElementById('selection-state');
  const redirectState = document.getElementById('redirect-state');
  const saveBtn = document.getElementById('save-btn');
  const cancelBtn = document.getElementById('cancel-btn');
  const countdownVal = document.getElementById('countdown-val');
  const redirectTitle = document.getElementById('redirect-title');
  const redirectSubtitle = document.getElementById('redirect-subtitle');
  const progressIndicator = document.querySelector('.progress-ring-indicator');
  const cards = document.querySelectorAll('.editor-card');

  const urlParams = new URLSearchParams(window.location.search);
  const filePath = urlParams.get('filePath') || urlParams.get('file_path');
  const startLine = urlParams.get('startLine') || urlParams.get('start_line') || '1';
  const endLine = urlParams.get('endLine') || urlParams.get('end_line') || '1';
  const remoteUrl = urlParams.get('remoteUrl') || urlParams.get('remote_url') || '';

  let selectedEditor = null;
  let countdownTimer = null;
  let countdownSeconds = 3;
  const totalOffset = 326.72;

  const editorNames = {
    vscode: 'VS Code',
    antigravity: 'Antigravity',
    cursor: 'Cursor',
    windsurf: 'Windsurf'
  };

  const savedPref = localStorage.getItem('linebuzz_preferred_editor');

  if (savedPref && filePath) {
    showRedirect(savedPref);
  } else {
    showSelection(savedPref);
  }

  cards.forEach(card => {
    card.addEventListener('click', () => {
      cards.forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedEditor = card.getAttribute('data-editor');
      saveBtn.removeAttribute('disabled');
      
      const saveText = saveBtn.querySelector('span');
      if (filePath) {
        saveText.textContent = `CONFIRM & OPEN IN ${editorNames[selectedEditor].toUpperCase()}`;
      } else {
        saveText.textContent = 'SAVE PREFERENCE';
      }
    });
  });

  saveBtn.addEventListener('click', () => {
    if (!selectedEditor) return;
    localStorage.setItem('linebuzz_preferred_editor', selectedEditor);
    
    if (filePath) {
      showRedirect(selectedEditor);
    } else {
      const btnSpan = saveBtn.querySelector('span');
      const originalText = btnSpan.textContent;
      btnSpan.textContent = 'PREFERENCE SAVED!';
      saveBtn.style.borderColor = 'var(--color-success)';
      saveBtn.style.color = 'var(--color-success)';
      
      setTimeout(() => {
        btnSpan.textContent = originalText;
        saveBtn.style.borderColor = '';
        saveBtn.style.color = '';
      }, 2000);
    }
  });

  cancelBtn.addEventListener('click', () => {
    stopRedirect();
    localStorage.removeItem('linebuzz_preferred_editor');
    showSelection(null);
  });

  function showSelection(preselect) {
    redirectState.classList.remove('active');
    selectionState.classList.add('active');
    
    if (preselect) {
      const targetCard = document.querySelector(`.editor-card[data-editor="${preselect}"]`);
      if (targetCard) {
        targetCard.click();
      }
    } else {
      cards.forEach(c => c.classList.remove('selected'));
      selectedEditor = null;
      saveBtn.setAttribute('disabled', 'true');
      saveBtn.querySelector('span').textContent = 'CONFIRM PREFERENCE';
    }
  }

  function showRedirect(editor) {
    selectionState.classList.remove('active');
    redirectState.classList.add('active');

    const targetCard = document.querySelector(`.editor-card[data-editor="${editor}"]`);
    const logoBox = document.getElementById('redirect-logo-box');
    if (targetCard) {
      const cardLogo = targetCard.querySelector('.card-logo');
      logoBox._sourceCard = targetCard;
      logoBox._sourceLogo = cardLogo;
      logoBox.appendChild(cardLogo);
    }

    redirectTitle.textContent = `Opening in ${editorNames[editor]}`;
    redirectSubtitle.textContent = `Launching your preference. Hold tight!`;

    const displaySeconds = 3;
    const durationMs = 1500;
    countdownSeconds = displaySeconds;
    countdownVal.textContent = displaySeconds;
    progressIndicator.style.strokeDashoffset = 0;

    const tickMs = 30;
    const totalTicks = durationMs / tickMs;
    let currentTick = 0;

    clearInterval(countdownTimer);
    countdownTimer = setInterval(() => {
      currentTick++;

      const offset = (currentTick / totalTicks) * totalOffset;
      progressIndicator.style.strokeDashoffset = offset;

      const elapsed = currentTick * tickMs;
      const currentSec = Math.ceil(displaySeconds - (elapsed / durationMs) * displaySeconds);
      countdownVal.textContent = Math.max(1, currentSec);

      if (currentTick >= totalTicks) {
        clearInterval(countdownTimer);
        countdownVal.classList.add('fade-out');
        setTimeout(() => {
          countdownVal.innerHTML = `<svg class="checkmark-svg" viewBox="0 0 52 52" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline class="checkmark-path" points="10,28 21,39 42,14" stroke="var(--color-success)" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
          countdownVal.classList.remove('fade-out');
          countdownVal.classList.add('checkmark');
          progressIndicator.classList.add('success');
          requestAnimationFrame(() => requestAnimationFrame(() => {
            countdownVal.classList.add('pop-in');
          }));
          setTimeout(() => triggerDeepLink(editor), 500);
        }, 200);
      }
    }, tickMs);
  }

  function stopRedirect() {
    clearInterval(countdownTimer);
    countdownVal.innerHTML = '3';
    countdownVal.classList.remove('fade-out', 'checkmark', 'pop-in');
    progressIndicator.classList.remove('success');
    const logoBox = document.getElementById('redirect-logo-box');
    if (logoBox._sourceLogo && logoBox._sourceCard) {
      logoBox._sourceCard.insertBefore(logoBox._sourceLogo, logoBox._sourceCard.firstChild);
      logoBox._sourceCard = null;
      logoBox._sourceLogo = null;
    }
  }

  function triggerDeepLink(editor) {
    const scheme = editor;
    const protocolLink = `${scheme}://SpiralMemory.linebuzz/open?filePath=${encodeURIComponent(filePath)}&startLine=${startLine}&endLine=${endLine}&remoteUrl=${encodeURIComponent(remoteUrl)}`;
    window.location.href = protocolLink;
  }
});
