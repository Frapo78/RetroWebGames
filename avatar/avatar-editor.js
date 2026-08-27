(() => {
  'use strict';

  const A = window.RWGAvatar;
  const P = window.RWGProfile;
  if (!A) return;

  const preview = document.getElementById('avatarPreview');
  const stage = document.getElementById('avatarStage');
  const saveBtn = document.getElementById('saveBtn');
  const randomizeBtn = document.getElementById('randomizeBtn');
  const resetViewBtn = document.getElementById('resetViewBtn');
  const status = document.getElementById('saveStatus');
  const avatarId = document.getElementById('avatarId');

  const labels = {
    bodyStyle: { classic:'CLASSIC', slim:'SLIM', strong:'STRONG' },
    faceStyle: { smile:'SMILE', grin:'GRIN', cool:'COOL', serious:'SERIOUS', cheeky:'CHEEKY', focus:'FOCUS' },
    hairStyle: { short:'SHORT', spikes:'SPIKES', bob:'BOB', mohawk:'MOHAWK', buzz:'BUZZ', curly:'CURLY' },
    topStyle: { tee:'T-SHIRT', hoodie:'HOODIE', jacket:'JACKET', jersey:'JERSEY' },
    bottomStyle: { jeans:'JEANS', shorts:'SHORTS', joggers:'JOGGERS', cargo:'CARGO' },
    accessory: { none:'NESSUNO', glasses:'OCCHIALI', visor:'VISOR', cap:'CAP', headphones:'CUFFIE' }
  };

  let draft = A.get();
  let yaw = -8;
  let pitch = -4;
  let pointer = null;

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
  }

  function applyView() {
    const person = preview.querySelector('.rwg-avatar-person');
    if (person) person.style.transform = `translateX(-50%) rotateX(${pitch}deg) rotateY(${yaw}deg)`;
  }

  function setDirty(dirty = true) {
    status.textContent = dirty ? 'DA SALVARE' : 'SALVATO';
    status.style.color = dirty ? '#ffe45b' : '';
  }

  function buildControls() {
    document.querySelectorAll('.editor-section').forEach(section => {
      const key = section.dataset.section;
      const values = A.options[key] || [];
      const host = section.querySelector('.choice-row, .swatches');
      const isColor = host.classList.contains('swatches');
      host.innerHTML = '';
      values.forEach(value => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.dataset.value = value;
        btn.setAttribute('aria-label', isColor ? `${section.querySelector('h2').textContent}: ${value}` : (labels[key]?.[value] || value));
        if (isColor) {
          btn.className = 'swatch';
          btn.style.setProperty('--sw', value);
        } else {
          btn.className = 'choice';
          btn.textContent = labels[key]?.[value] || value.toUpperCase();
        }
        btn.addEventListener('click', () => {
          draft = { ...draft, [key]: value };
          setDirty(true);
          render();
        });
        host.appendChild(btn);
      });
    });
  }

  randomizeBtn.addEventListener('click', () => {
    draft = A.randomAvatar(`${P?.getFingerprint?.() || 'guest'}:${Date.now()}:${Math.random()}`);
    setDirty(true);
    render();
  });

  saveBtn.addEventListener('click', () => {
    draft = A.save(draft, { reason: 'editor' });
    setDirty(false);
    saveBtn.textContent = 'SALVATO ✓';
    setTimeout(() => { saveBtn.textContent = 'SALVA AVATAR'; }, 1200);
  });

  resetViewBtn.addEventListener('click', () => { yaw = -8; pitch = -4; applyView(); });

  stage.addEventListener('pointerdown', e => {
    pointer = { id:e.pointerId, x:e.clientX, y:e.clientY, yaw, pitch };
    stage.setPointerCapture?.(e.pointerId);
    stage.classList.add('dragging');
  });
  stage.addEventListener('pointermove', e => {
    if (!pointer || pointer.id !== e.pointerId) return;
    yaw = Math.max(-70, Math.min(70, pointer.yaw + (e.clientX - pointer.x) * .45));
    pitch = Math.max(-20, Math.min(14, pointer.pitch - (e.clientY - pointer.y) * .22));
    applyView();
  });
  const stop = e => {
    if (!pointer || (e?.pointerId != null && pointer.id !== e.pointerId)) return;
    pointer = null;
    stage.classList.remove('dragging');
  };
  stage.addEventListener('pointerup', stop);
  stage.addEventListener('pointercancel', stop);

  avatarId.textContent = `PLAYER ${String(P?.getFingerprint?.() || '').replace('rwg_','').slice(0, 18).toUpperCase()}`;
  buildControls();
  render();
  setDirty(false);
})();