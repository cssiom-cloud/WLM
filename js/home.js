import { bootCommandShell, initAos } from './shell.js';
import { requireAuthenticatedPersonnel } from './session.js';
import { GENDERS, biographyParagraphs, formatPersonnelName, parsePersonnelName } from './domain.js';
import {
  BANNER_ICON,
  PENCIL_ICON,
  PLUS_ICON,
  escapeHtml,
  initialsFromName,
  optionMarkup,
  showStatus,
  upgradeSelects,
  withOverlay
} from './ui.js';
import { updatePersonnelRecord, uploadPersonnelAvatar, uploadPersonnelImage } from './personnel-service.js';
import { writeActivityLog } from './command-services.js';
import { bindTiltTargets } from './effects.js';
import { fetchUnitBoard } from './unit-service.js';
import { t } from './i18n.js';
import { openImageEditor } from './image-editor.js';

let actorRole = 'user';
let unitBoard = { units: [], ranks: [] };
let currentPersonnel = null;
let isEditing = false;

function unitNameFor(record) {
  return unitBoard.units.find((unit) => unit.id === record.unit_id)?.name || record.wlc_agency || '';
}

function unitRankFor(record) {
  return unitBoard.ranks.find((rank) => rank.id === record.unit_rank_id)?.title || '';
}

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

function coverStyle(record) {
  const cover = String(record.cover_url || record.banner_url || '').trim();
  if (!/^https?:\/\//i.test(cover) && !cover.startsWith('data:')) {
    return '';
  }
  return `--profile-cover: url("${cover.replaceAll('\\', '').replaceAll('"', '').replaceAll("'", '')}")`;
}

function isCoarsePointer() {
  return window.matchMedia('(hover: none), (pointer: coarse)').matches;
}

function renderHome(personnel, editing = false) {
  currentPersonnel = personnel;
  isEditing = editing;
  const name = formatPersonnelName(personnel) || 'Unassigned name';
  const history = biographyParagraphs(personnel, true);
  const root = document.querySelector('#home-root');

  root.innerHTML = `
    <section class="profile-panel${editing ? ' is-editing' : ''}" data-aos="fade-up">
      <div class="profile-hero">
        <div
          class="profile-banner${personnel.cover_url || personnel.banner_url ? ' has-image' : ''}"
          id="profile-banner"
          style="${coverStyle(personnel)}"
        >
          <button class="avatar-action profile-banner-edit" id="profile-banner-edit" type="button" title="${escapeHtml(t('home.editCover'))}">
            ${BANNER_ICON}
            <span class="visually-hidden">${escapeHtml(t('home.editCover'))}</span>
          </button>
        </div>
        <div class="avatar-stage${editing ? ' is-editing' : ''}" id="avatar-stage">
          <button class="avatar-action avatar-plus" id="avatar-plus" type="button" title="${escapeHtml(t('home.uploadPhoto'))}">
            ${PLUS_ICON}
            <span class="visually-hidden">${escapeHtml(t('home.uploadPhoto'))}</span>
          </button>
          <button class="avatar-action avatar-pencil" id="avatar-pencil" type="button" title="${escapeHtml(t('home.editProfile'))}">
            ${PENCIL_ICON}
            <span class="visually-hidden">${escapeHtml(t('home.editProfile'))}</span>
          </button>
          <div class="avatar-frame" id="avatar-frame">
            ${renderAvatar(personnel)}
          </div>
        </div>
      </div>
      ${
        editing
          ? `
            <label class="visually-hidden" for="edit-name">Name</label>
            <input id="edit-name" class="text-field profile-edit-name" type="text" value="${escapeHtml(name)}">
            <p class="profile-rank">${escapeHtml(personnel.military_rank || '')}</p>
            <div class="profile-edit-fields">
              <label>${escapeHtml(t('home.age'))}
                <input id="edit-age" class="text-field" type="number" min="17" value="${escapeHtml(personnel.age ?? '')}">
              </label>
              <label>${escapeHtml(t('home.gender'))}
                <select id="edit-gender" class="select-field">${optionMarkup(GENDERS, personnel.gender || '')}</select>
              </label>
            </div>
            <label class="visually-hidden" for="edit-bio">Bio</label>
            <textarea id="edit-bio" class="text-field profile-edit-bio" rows="6">${escapeHtml(bioText(personnel))}</textarea>
            <button class="btn btn-primary" id="save-profile" type="button">Save</button>
          `
          : `
            <h1 class="profile-name">${escapeHtml(name)}</h1>
            <p class="profile-rank">${escapeHtml(personnel.military_rank || '')}</p>
            ${
              unitNameFor(personnel)
                ? `<p class="profile-unit">${escapeHtml(t('home.unit'))}: ${escapeHtml(unitNameFor(personnel))}${
                    unitRankFor(personnel) ? ` · ${escapeHtml(unitRankFor(personnel))}` : ''
                  }</p>`
                : ''
            }
            <p class="profile-facts">${escapeHtml(t('home.age'))}: ${escapeHtml(personnel.age ?? '-')} · ${escapeHtml(t('home.gender'))}: ${escapeHtml(personnel.gender || '-')}</p>
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
  const banner = document.querySelector('#profile-banner');
  const bannerEdit = document.querySelector('#profile-banner-edit');

  async function applyAvatar(source, autoPick = false) {
    const result = await openImageEditor({
      source: source || null,
      aspect: '1:1',
      previewMask: 'circle',
      filename: 'avatar.jpg',
      size: 768,
      autoPick
    });
    if (!result?.file) {
      return;
    }
    try {
      const updated = await uploadPersonnelAvatar(personnel.id, result.file);
      await writeActivityLog({
        userId: personnel.id,
        roleSnapshot: actorRole,
        actionType: 'avatar_update',
        details: 'Updated profile avatar'
      });
      renderHome(updated, isEditing);
      showStatus(t('img.saved'));
    } catch (error) {
      showStatus(error.message, true);
    }
  }

  async function applyCover() {
    const source = personnel.cover_url || personnel.banner_url || null;
    const result = await openImageEditor({
      source,
      aspect: '16:9',
      previewMask: 'rect',
      filename: 'cover.jpg',
      size: 1280,
      autoPick: !source
    });
    if (!result?.file) {
      return;
    }
    try {
      const updated = await uploadPersonnelImage(personnel.id, result.file, 'cover_url');
      renderHome(updated, isEditing);
      showStatus(t('img.saved'));
    } catch (error) {
      showStatus(error.message, true);
    }
  }

  document.querySelector('#avatar-frame').addEventListener('click', () => {
    if (isCoarsePointer() && !stage.classList.contains('is-editing')) {
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
    applyAvatar(personnel.avatar_url || null, !personnel.avatar_url);
  });

  bannerEdit.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    applyCover();
  });
  banner.addEventListener('click', (event) => {
    if (event.target.closest('.avatar-stage')) {
      return;
    }
    applyCover();
  });

  const saveButton = document.querySelector('#save-profile');
  if (saveButton) {
    saveButton.addEventListener('click', async () => {
      const parsed = parsePersonnelName(document.querySelector('#edit-name').value);
      const ageValue = String(document.querySelector('#edit-age').value || '').trim();
      const age = ageValue === '' ? null : Number(ageValue);
      if (age != null && (!Number.isFinite(age) || age < 17)) {
        showStatus('Age must be 17 or older.', true);
        return;
      }
      try {
        const updated = await updatePersonnelRecord(personnel.id, {
          ...parsed,
          biography: document.querySelector('#edit-bio').value,
          age,
          gender: document.querySelector('#edit-gender').value || null
        });
        await writeActivityLog({
          userId: personnel.id,
          roleSnapshot: actorRole,
          actionType: 'profile_update',
          details: 'Updated name, biography, age, and gender'
        });
        renderHome(updated, false);
        showStatus(t('common.save'));
      } catch (error) {
        showStatus(error.message, true);
      }
    });
  }

  upgradeSelects(root);
  initAos();
  bindTiltTargets('.profile-panel');
}

bootCommandShell('home');

requireAuthenticatedPersonnel()
  .then(async (result) => {
    if (!result) {
      return;
    }
    actorRole = result.personnel.role;
    try {
      unitBoard = await withOverlay(() => fetchUnitBoard(), t('notice.loading'));
    } catch {
      unitBoard = { units: [], ranks: [] };
    }
    renderHome(result.personnel, false);
  })
  .catch((error) => {
    showStatus(error.message, true);
  });

window.addEventListener('wlr-lang-changed', () => {
  if (currentPersonnel) {
    renderHome(currentPersonnel, isEditing);
  }
});
