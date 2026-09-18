const grid = document.getElementById('grid');
const shareButton = document.getElementById('share');
const audioOption = document.getElementById('audio-option');
const audioCheckbox = document.getElementById('audio');

let sources = [];
let kind = 'screen';
let selectedId = null;

function share() {
  if (selectedId) window.picker.choose(selectedId, audioCheckbox.checked);
}

function render() {
  grid.replaceChildren();
  const visible = sources.filter((s) => s.kind === kind);
  if (visible.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = kind === 'screen' ? 'Nenhuma tela encontrada.' : 'Nenhuma janela aberta.';
    grid.append(empty);
  }
  for (const source of visible) {
    const card = document.createElement('button');
    card.className = 'card' + (source.id === selectedId ? ' selected' : '');
    card.dataset.id = source.id;

    const thumb = document.createElement('img');
    thumb.className = 'thumb';
    thumb.src = source.thumbnail;
    thumb.alt = '';

    const name = document.createElement('div');
    name.className = 'name';
    if (source.icon) {
      const icon = document.createElement('img');
      icon.src = source.icon;
      icon.alt = '';
      name.append(icon);
    }
    const label = document.createElement('span');
    label.textContent = source.kind === 'screen' && sources.filter((s) => s.kind === 'screen').length === 1 ? 'Tela inteira' : source.name;
    name.append(label);

    card.append(thumb, name);
    card.addEventListener('click', () => {
      selectedId = source.id;
      shareButton.disabled = false;
      render();
    });
    card.addEventListener('dblclick', () => {
      selectedId = source.id;
      share();
    });
    grid.append(card);
  }
}

for (const tab of document.querySelectorAll('.tab')) {
  tab.addEventListener('click', () => {
    kind = tab.dataset.kind;
    for (const t of document.querySelectorAll('.tab')) t.classList.toggle('active', t === tab);
    render();
  });
}

shareButton.addEventListener('click', share);
document.getElementById('cancel').addEventListener('click', () => window.picker.cancel());
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') window.picker.cancel();
  if (event.key === 'Enter') share();
});

window.picker.onSources((data) => {
  sources = data.sources;
  audioOption.hidden = !data.audioSupported;
  const screens = sources.filter((s) => s.kind === 'screen');
  document.querySelector('[data-kind="screen"]').textContent = `Telas (${screens.length})`;
  document.querySelector('[data-kind="window"]').textContent = `Janelas (${sources.length - screens.length})`;
  // Com uma tela só, já deixa selecionada: basta clicar em Compartilhar.
  if (screens.length === 1) {
    selectedId = screens[0].id;
    shareButton.disabled = false;
  }
  render();
});
