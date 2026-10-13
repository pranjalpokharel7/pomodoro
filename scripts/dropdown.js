// Themed dropdown over a <select> (the native popup can't be styled). The select stays the
// source of truth and is hidden: pick sets select.value and fires its 'change'.
// Call syncDropdown(sel) after changing the select's options or value from code.
function syncDropdown(sel) {
  const dd = sel.nextElementSibling;
  if (!dd?.classList.contains('dd')) return;
  const cur = sel.selectedOptions[0];
  dd.querySelector('.dd-btn').textContent = cur ? cur.textContent : '';
  const list = dd.querySelector('.dd-list');
  list.replaceChildren(...[...sel.options].map(o => {
    const li = document.createElement('li');
    li.textContent = o.textContent;
    li.dataset.v = o.value;
    return li;
  }));
}

function makeDropdown(sel) {
  const dd = document.createElement('div');
  dd.className = 'dd';
  dd.innerHTML = '<button type="button" class="dd-btn"></button><ul class="dd-list" hidden></ul>';
  sel.hidden = true;
  sel.after(dd);
  const list = dd.querySelector('.dd-list');
  dd.querySelector('.dd-btn').onclick = () => { list.hidden = !list.hidden; };
  list.onclick = e => {
    const li = e.target.closest('li');
    if (!li) return;
    list.hidden = true;
    if (sel.value === li.dataset.v) return;
    sel.value = li.dataset.v;
    sel.dispatchEvent(new Event('change'));
    syncDropdown(sel);
  };
  document.addEventListener('click', e => { if (!dd.contains(e.target)) list.hidden = true; });
  syncDropdown(sel);
}

document.querySelectorAll('select.themed').forEach(makeDropdown);
