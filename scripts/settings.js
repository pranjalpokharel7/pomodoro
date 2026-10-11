// Restore saved minutes, ignoring anything missing or out of range.
try {
  const saved = JSON.parse(localStorage.getItem('pomo-mins'));
  Object.keys(inputs).forEach(m => {
    const v = Math.round(Number(saved?.[m]));
    if (v >= inputs[m].min && v <= inputs[m].max) inputs[m].value = v;
  });
} catch {}

Object.keys(inputs).forEach(m => {
  inputs[m].onchange = () => {
    const i = inputs[m];
    i.value = Math.min(+i.max, Math.max(+i.min, Math.round(+i.value) || +i.defaultValue));
    localStorage.setItem('pomo-mins', JSON.stringify({ focus: inputs.focus.value, short: inputs.short.value, long: inputs.long.value }));
    if (!timer && mode === m) setMode(m);
  };
});

// Close the settings panel when clicking elsewhere. The leaderboard stays put — it only
// collapses when its own trophy icon is clicked.
document.addEventListener('click', e => {
  document.querySelectorAll('.settings').forEach(d => {
    if (!d.contains(e.target)) d.open = false;
  });
});
