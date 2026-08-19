import { bootCommandShell, initAos } from './shell.js';
import { requireAuthenticatedPersonnel } from './session.js';
import { biographyParagraphs, formatPersonnelName, parsePersonnelName } from './domain.js';
import { PENCIL_ICON, PLUS_ICON, escapeHtml, initialsFromName, showStatus } from './ui.js';
import { updatePersonnelRecord, uploadPersonnelAvatar } from './personnel-service.js';
import { writeActivityLog } from './command-services.js';
import { bindTiltTargets } from './effects.js';

let actorRole = 'user';

function renderAvatar(record) {
  const name = formatPersonnelName(record);
  if (record.avatar_url) {
    return `<img class="avatar-image" src="${escapeHtml(record.avatar_url)}" alt="${escapeHtml(name || 'Personnel avatar')}">`;
  }
  return `<div class="avatar-placeholder">${escapeHtml(initialsFromName(name))}</div>`;
}

function bioText(record) {
  if (String(record.biography || '').trim()) {
    return record.biography;
  }
  const history = biographyParagraphs(record, true);
  return [history.paragraphIdentity, history.paragraphService].filter(Boolean).join('\n\n');
}

function renderHome(personnel, editing = false) {
  const name = formatPersonnelName(personnel) || 'Unassigned name';
  const history = biographyParagraphs(personnel, true);
  const root = document.querySelector('#home-root');

  root.innerHTML = `
    <section class="profile-panel${editing ? ' is-editing' : ''}" data-aos="fade-up">
      <div class="avatar-stage${editing ? ' is-editing' : ''}" id="avatar-stage">
        <button class="avatar-action avatar-plus" id="avatar-plus" type="button" title="Upload avatar">
          ${PLUS_ICON}
          <span class="visually-hidden">Upload avatar</span>
        </button>
        <button class="avatar-action avatar-pencil" id="avatar-pencil" type="button" title="Edit">
          ${PENCIL_ICON}
          <span class="visually-hidden">Edit</span>
        </button>
        <div class="avatar-frame" id="avatar-frame">
          ${renderAvatar(personnel)}
        </div>
        <input id="avatar-file" type="file" accept="image/*">
      </div>
      ${
        editing
          ? `
            <label class="visually-hidden" for="edit-name">Name</label>
            <input id="edit-name" class="text-field profile-edit-name" type="text" value="${escapeHtml(name)}">
            <p class="profile-rank">${escapeHtml(personnel.military_rank || '')}</p>
            <label class="visually-hidden" for="edit-bio">Bio</label>
            <textarea id="edit-bio" class="text-field profile-edit-bio" rows="6">${escapeHtml(bioText(personnel))}</textarea>
            <button class="btn btn-primary" id="save-profile" type="button">Save</button>
          `
          : `
            <h1 class="profile-name">${escapeHtml(name)}</h1>
            <p class="profile-rank">${escapeHtml(personnel.military_rank || '')}</p>
            ${
              Array.isArray(personnel.honor_ranks) && personnel.honor_ranks.length
                ? `<div class="medal-row profile-honor">${personnel.honor_ranks
                    .map((rank) => `<span class="honor-chip">${escapeHtml(rank)}</span>`)
                    .join('')}</div>`
                : ''
            }
            <div class="profile-history">
              <p>${escapeHtml(history.paragraphIdentity)}</p>
              ${history.paragraphService ? `<p>${escapeHtml(history.paragraphService)}</p>` : ''}
            </div>
          `
      }
    </section>
  `;

  const stage = document.querySelector('#avatar-stage');
  const pencil = document.querySelector('#avatar-pencil');
  const plus = document.querySelector('#avatar-plus');
  const fileInput = document.querySelector('#avatar-file');

  document.querySelector('#avatar-frame').addEventListener('click', () => {
    if (window.matchMedia('(hover: none), (pointer: coarse)').matches && !stage.classList.contains('is-editing')) {
      stage.classList.toggle('is-armed');
    }
  });

  pencil.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!editing) {
      renderHome(personnel, true);
    }
  });

  plus.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    fileInput.click();
  });

  fileInput.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const updated = await uploadPersonnelAvatar(personnel.id, file);
      await writeActivityLog({
        userId: personnel.id,
        roleSnapshot: actorRole,
        actionType: 'avatar_update',
        details: 'Updated profile avatar'
      });
      renderHome(updated, true);
      showStatus('Avatar uploaded.');
    } catch (error) {
      showStatus(error.message, true);
    }
  });

  const saveButton = document.querySelector('#save-profile');
  if (saveButton) {
    saveButton.addEventListener('click', async () => {
      const parsed = parsePersonnelName(document.querySelector('#edit-name').value);
      try {
        const updated = await updatePersonnelRecord(personnel.id, {
          ...parsed,
          biography: document.querySelector('#edit-bio').value
        });
        await writeActivityLog({
          userId: personnel.id,
          roleSnapshot: actorRole,
          actionType: 'profile_update',
          details: 'Updated name and biography'
        });
        renderHome(updated, false);
        showStatus('Profile saved.');
      } catch (error) {
        showStatus(error.message, true);
      }
    });
  }

  initAos();
  bindTiltTargets('.profile-panel');
}

bootCommandShell('home');

requireAuthenticatedPersonnel()
  .then((result) => {
    if (!result) {
      return;
    }
    actorRole = result.personnel.role;
    renderHome(result.personnel, false);
  })
  .catch((error) => {
    showStatus(error.message, true);
  });
