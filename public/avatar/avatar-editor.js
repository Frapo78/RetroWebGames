(() => {
  'use strict';

  const A = window.RWGAvatar;
  const P = window.RWGProfile;
  if (!A) return;

  const preview = document.getElementById('avatarPreview');
  const stage = document.getElementById('avatarStage');
  const saveBtn = document.getElementById('saveBtn');
  const randomizeBtn = document.getElementById('randomizeBtn');
  const restoreBtn = document.getElementById('restoreBtn');
  const resetViewBtn = document.getElementById('resetViewBtn');
  const status = document.getElementById('saveStatus');
  const avatarId = document.getElementById('avatarId');
  const summary = document.getElementById('loadoutSummary');

  const labels = {
    bodyStyle: { classic:'CLASSIC', slim:'SLIM', strong:'POWER' },
    faceStyle: { smile:'SMILE', grin:'GRIN', cool:'COOL', serious:'SERIOUS', cheeky:'CHEEKY', focus:'FOCUS' },
    hairStyle: { short:'SHORT', spikes:'SPIKES', bob:'BOB', mohawk:'MOHAWK', buzz:'BUZZ', curly:'CURLY' },
    topStyle: { tee:'T-SHIRT', hoodie:'HOODIE', jacket:'JACKET', jersey:'JERSEY' },
    bottomStyle: { jeans:'JEANS', shorts:'SHORTS', joggers:'JOGGERS', cargo:'CARGO' },
    eyewear: { none:'NESSUNO', glasses:'GLASSES', visor:'NEON VISOR' },
    headgear: { none:'NESSUNO', cap:'CAP', headphones:'HEADSET', crown:'ARCADE CROWN' },
    emblem: { none:'NESSUNO', bolt:'BOLT', star:'STAR', pixel:'PIXEL', shield:'SHIELD' },
    aura: { cyan:'CYAN', magenta:'MAGENTA', gold:'GOLD', green:'GREEN', violet:'VIOLET' }
  };

  const auraColors = { cyan:'#65e7ff', magenta:'#ff5ecf', gold:'#ffe45b', green:'#7cffb2', violet:'#9a78ff' };
  let saved = A.get();
  let draft = A.get();
  let yaw = -7;
  let pitch = -2;
  let pointer = null;

  const iconSvg = body => `<svg viewBox="0 0 40 40" aria-hidden="true" focusable="false">${body}</svg>`;

  function optionIcon(key, value) {
    const stroke = 'currentColor';
    if (key === 'bodyStyle') {
      const width = value === 'slim' ? 8 : value === 'strong' ? 15 : 11;
      return iconSvg(`<circle cx="20" cy="8" r="5" fill="none" stroke="${stroke}" stroke-width="2"/><path d="M20 13v11M12 17l8 4 8-4M20 24l-7 10M20 24l7 10" fill="none" stroke="${stroke}" stroke-width="${width/5}" stroke-linecap="round"/>`);
    }
    if (key === 'faceStyle') {
      const mouth = value === 'serious' ? 'M15 29q5-4 10 0' : value === 'cool' || value === 'focus' ? 'M15 28h10' : 'M14 26q6 7 12 0';
      return iconSvg(`<circle cx="20" cy="20" r="14" fill="none" stroke="${stroke}" stroke-width="2"/><circle cx="15" cy="18" r="2" fill="${stroke}"/><circle cx="25" cy="18" r="2" fill="${stroke}"/><path d="${mouth}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round"/>`);
    }
    if (key === 'hairStyle') {
      const hair = {
        spikes:'M8 17 11 6l5 7 4-10 5 10 5-7 2 12',
        bob:'M8 21Q9 6 20 6q12 0 13 15v9l-5-4-2-10q-6-5-12 0l-2 10-4 4Z',
        mohawk:'M16 16 20 2l4 14 4-7 1 10',
        buzz:'M9 18Q11 7 20 7q10 0 12 11',
        curly:'M8 18q0-8 7-8 2-7 8-4 8-2 9 7 6 1 5 9',
        short:'M9 18Q11 6 20 6q11 0 12 12'
      }[value] || '';
      return iconSvg(`<circle cx="20" cy="21" r="12" fill="none" stroke="${stroke}" stroke-width="2"/><path d="${hair}" fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
    if (key === 'topStyle') {
      return iconSvg(`<path d="M13 9 7 15l5 5 3-3v16h10V17l3 3 5-5-6-6-4 3h-6Z" fill="none" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/><path d="${value === 'jacket' ? 'M20 12v21' : value === 'hoodie' ? 'M15 12q5 7 10 0' : value === 'jersey' ? 'M16 22h8' : 'M15 14h10'}" fill="none" stroke="${stroke}" stroke-width="1.7"/>`);
    }
    if (key === 'bottomStyle') {
      const short = value === 'shorts';
      return iconSvg(`<path d="M13 7h14l-2 13-5-2-5 2Z" fill="none" stroke="${stroke}" stroke-width="2"/><path d="M15 ${short?20:18} 12 ${short?28:34}M25 ${short?20:18}l3 ${short?28:34}" stroke="${stroke}" stroke-width="3" stroke-linecap="round"/><path d="M9 35h7M25 35h7" stroke="${stroke}" stroke-width="2"/>`);
    }
    if (key === 'eyewear') {
      if (value === 'none') return iconSvg('<path d="M8 20h24" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/>');
      if (value === 'visor') return iconSvg('<rect x="7" y="14" width="26" height="12" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 18h20" stroke="currentColor" stroke-width="1" opacity=".55"/>');
      return iconSvg('<rect x="7" y="14" width="11" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="22" y="14" width="11" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M18 18h4" stroke="currentColor" stroke-width="2"/>');
    }
    if (key === 'headgear') {
      if (value === 'cap') return iconSvg('<path d="M8 21q2-12 13-12 10 0 13 12Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M21 21q9-2 15 3" fill="none" stroke="currentColor" stroke-width="2"/>');
      if (value === 'headphones') return iconSvg('<path d="M9 23q0-14 11-14t11 14" fill="none" stroke="currentColor" stroke-width="3"/><rect x="6" y="21" width="7" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2"/><rect x="27" y="21" width="7" height="11" rx="3" fill="none" stroke="currentColor" stroke-width="2"/>');
      if (value === 'crown') return iconSvg('<path d="M8 26 12 10l8 8 8-9 5 17Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>');
      return iconSvg('<path d="M8 20h24" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/>');
    }
    if (key === 'emblem') {
      const shape = {
        bolt:'<path d="m23 6-10 14h7l-4 14 12-18h-7Z" fill="none" stroke="currentColor" stroke-width="2"/>',
        star:'<path d="m20 6 4 9 10 1-8 7 2 10-8-5-9 5 3-10-8-7 10-1Z" fill="none" stroke="currentColor" stroke-width="2"/>',
        pixel:'<path d="M10 13h6V8h8v5h6v6h4v10h-7v-5H13v5H6V19h4Z" fill="none" stroke="currentColor" stroke-width="2"/>',
        shield:'<path d="M20 7 31 11v8q0 9-11 14Q9 28 9 19v-8Z" fill="none" stroke="currentColor" stroke-width="2"/>',
        none:'<path d="M8 20h24" stroke="currentColor" stroke-width="2" stroke-dasharray="3 3"/>'
      }[value];
      return iconSvg(shape);
    }
    if (key === 'aura') {
      const color = auraColors[value] || '#65e7ff';
      return iconSvg(`<circle cx="20" cy="20" r="11" fill="${color}" opacity=".22"/><circle cx="20" cy="20" r="14" fill="none" stroke="${color}" stroke-width="2"/><circle cx="20" cy="20" r="5" fill="${color}"/>`);
    }
    return iconSvg('<path d="M8 20h24M20 8v24" stroke="currentColor" stroke-width="2"/>');
  }

  function currentLabel(key) {
    const value = draft[key];
    return labels[key]?.[value] || String(value || '').toUpperCase();
  }

  function isDirty() {
    return JSON.stringify(draft) !== JSON.stringify(saved);
  }

  function renderSummary() {
    if (!summary) return;
    const gear = [draft.eyewear !== 'none' ? currentLabel('eyewear') : '', draft.headgear !== 'none' ? currentLabel('headgear') : '']
      .filter(Boolean).join(' + ') || 'BASE';
    summary.innerHTML = `
      <div class="loadout-chip"><span>BODY</span><strong>${currentLabel('bodyStyle')}</strong></div>
      <div class="loadout-chip"><span>OUTFIT</span><strong>${currentLabel('topStyle')} / ${currentLabel('bottomStyle')}</strong></div>
      <div class="loadout-chip"><span>GEAR</span><strong>${gear}</strong></div>
      <div class="loadout-chip"><span>AURA</span><strong>${currentLabel('aura')}</strong></div>`;
  }

  function render() {
    A.renderInto(preview, { avatar: draft, mode: 'full' });
    applyView();
    document.querySelectorAll('.editor-section').forEach(section => {
      const key = section.dataset.section;
      section.querySelectorAll('[data-value]').forEach(control => {
        const active = control.dataset.value === draft[key];
        control.classList.toggle('active', active);
        control.setAttribute('aria-pressed', String(active));
      });
    });
    renderSummary();
    setDirtyState();
  }

  function applyView() {
    const person = preview.querySelector('.rwg-avatar-person');
    if (person) person.style.transform = `translateX(-50%) rotateX(${pitch}deg) rotateY(${yaw}deg)`;
  }

  function setDirtyState() {
    const dirty = isDirty();
    status.textContent = dirty ? 'MODIFICHE NON SALVATE' : 'SALVATO';
    status.style.color = dirty ? '#ffe45b' : '';
    saveBtn.classList.toggle('is-dirty', dirty);
    restoreBtn.disabled = !dirty;
    restoreBtn.style.opacity = dirty ? '' : '.45';
  }

  function buildControls() {
    document.querySelectorAll('.editor-section').forEach(section => {
      const key = section.dataset.section;
      const values = A.options[key] || [];
      const host = section.querySelector('.choice-grid, .swatches');
      const isColor = host?.classList.contains('swatches');
      if (!host) return;
      host.innerHTML = '';
      values.forEach(value => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.value = value;
        btn.setAttribute('aria-pressed', 'false');
        const heading = section.querySelector('h2')?.textContent || key;
        btn.setAttribute('aria-label', isColor ? `${heading}: ${value}` : (labels[key]?.[value] || value));
        if (isColor) {
          btn.className = 'swatch';
          btn.style.setProperty('--sw', value);
        } else {
          btn.className = 'choice';
          btn.innerHTML = `<span class="choice-icon">${optionIcon(key, value)}</span><span class="choice-label">${labels[key]?.[value] || value.toUpperCase()}</span>`;
          if (key === 'aura') btn.style.color = auraColors[value] || '';
        }
        btn.addEventListener('click', () => {
          draft = A.normalize({ ...draft, [key]: value });
          render();
        });
        host.appendChild(btn);
      });
    });
  }

  function activateTab(tabName, focus = false) {
    const tabs = [...document.querySelectorAll('.editor-tab')];
    tabs.forEach(tab => {
      const active = tab.dataset.tab === tabName;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (active && focus) tab.focus();
    });
    document.querySelectorAll('.editor-panel').forEach(panel => {
      const active = panel.dataset.panel === tabName;
      panel.classList.toggle('active', active);
      panel.hidden = !active;
    });
  }

  function setupTabs() {
    const tabs = [...document.querySelectorAll('.editor-tab')];
    tabs.forEach((tab, index) => {
      tab.addEventListener('click', () => activateTab(tab.dataset.tab));
      tab.addEventListener('keydown', event => {
        if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
        event.preventDefault();
        let next = index;
        if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = tabs.length - 1;
        activateTab(tabs[next].dataset.tab, true);
      });
    });
  }

  randomizeBtn.addEventListener('click', () => {
    draft = A.randomAvatar(`${P?.getFingerprint?.() || 'guest'}:${Date.now()}:${Math.random()}`);
    render();
  });

  restoreBtn.addEventListener('click', () => {
    draft = A.get();
    saved = A.get();
    render();
  });

  saveBtn.addEventListener('click', () => {
    draft = A.save(draft, { reason: 'editor-v2' });
    saved = A.get();
    render();
    saveBtn.textContent = 'PLAYER SALVATO ✓';
    setTimeout(() => { saveBtn.textContent = 'SALVA PLAYER'; }, 1200);
  });

  resetViewBtn.addEventListener('click', () => {
    yaw = -7;
    pitch = -2;
    applyView();
  });

  stage.addEventListener('pointerdown', event => {
    if (event.button != null && event.button !== 0) return;
    pointer = { id:event.pointerId, x:event.clientX, y:event.clientY, yaw, pitch };
    stage.setPointerCapture?.(event.pointerId);
    stage.classList.add('dragging');
  });

  stage.addEventListener('pointermove', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    yaw = Math.max(-42, Math.min(42, pointer.yaw + (event.clientX - pointer.x) * .24));
    pitch = Math.max(-10, Math.min(8, pointer.pitch - (event.clientY - pointer.y) * .12));
    applyView();
  });

  const stopPointer = event => {
    if (!pointer || (event?.pointerId != null && pointer.id !== event.pointerId)) return;
    pointer = null;
    stage.classList.remove('dragging');
  };
  stage.addEventListener('pointerup', stopPointer);
  stage.addEventListener('pointercancel', stopPointer);

  avatarId.textContent = `PLAYER ${String(P?.getFingerprint?.() || '').replace('rwg_','').slice(0,18).toUpperCase()}`;
  buildControls();
  setupTabs();
  activateTab('body');
  render();
})();
