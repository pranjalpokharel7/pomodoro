try {
  const r = JSON.parse(localStorage.getItem('pomo-running'));
  if (r?.endAt > Date.now()) {
    mode = r.mode || 'focus';
    endAt = r.endAt;
    remaining = endAt - Date.now();
    document.body.dataset.mode = mode;
    $('skip').hidden = mode === 'focus';
    document.querySelectorAll('.modes button').forEach(b =>
      b.classList.toggle('active', b.dataset.mode === mode));
    lastTick = Date.now();
    timer = setInterval(tick, 250);
    $('toggle').textContent = 'Pause';
    show();
  } else {
    localStorage.removeItem('pomo-running');
    setMode('focus');
  }
} catch {
  setMode('focus');
}
