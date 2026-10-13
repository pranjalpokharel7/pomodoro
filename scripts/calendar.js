// Custom date picker (the native popup can't be themed). Button .value holds "YYYY-MM-DD".
let calMonth = new Date();
function setHoursDay(key) {
  $('hoursday').value = key;
  $('hoursday').textContent = new Date(key + 'T00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  renderHours();
}
function renderCal() {
  const y = calMonth.getFullYear(), m = calMonth.getMonth();
  const first = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate();
  const sel = $('hoursday').value, now = dayKey();
  const cells = ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(d => `<i>${d}</i>`);
  for (let i = 0; i < first; i++) cells.push('<i></i>');
  for (let d = 1; d <= n; d++) {
    const k = `${y}-${pad(m + 1)}-${pad(d)}`;
    cells.push(`<button type="button" data-d="${k}"${k > now ? ' disabled' : ''}${k === sel ? ' class="on"' : ''}>${d}</button>`);
  }
  $('cal').innerHTML = `<span class="calhead"><button type="button" data-nav="-1">‹</button><b>${calMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</b><button type="button" data-nav="1"${y * 12 + m >= new Date().getFullYear() * 12 + new Date().getMonth() ? ' disabled' : ''}>›</button></span><span class="calgrid">${cells.join("")}</span>`;
}
$('hoursday').onclick = () => {
  $('cal').hidden = !$('cal').hidden;
  calMonth = new Date($('hoursday').value + 'T00:00');
  renderCal();
};
$('cal').onclick = e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.dataset.nav) { calMonth.setMonth(calMonth.getMonth() + +b.dataset.nav, 1); renderCal(); }
  else if (b.dataset.d) { $('cal').hidden = true; setHoursDay(b.dataset.d); }
};
document.addEventListener('click', e => { if (!e.target.closest('.datepick')) $('cal').hidden = true; });
setHoursDay(dayKey());
