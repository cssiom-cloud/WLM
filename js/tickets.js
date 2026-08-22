import { bootCommandShell, initAos } from './shell.js';
import { readCurrentPersonnel } from './session.js';
import { TICKET_CATEGORIES, formatPersonnelName } from './domain.js';
import { escapeHtml, showStatus, upgradeSelects } from './ui.js';
import { getLang, t } from './i18n.js';
import { createTicket, deleteTicket, fetchTickets, updateTicket } from './ticket-service.js';
import { fetchPersonnelRoster } from './personnel-service.js';

let actor = null;
let tickets = [];
let roster = [];

function isAdmin() {
  return actor?.role === 'admin';
}

function isGuest() {
  return !actor;
}

function categoryLabel(id) {
  const row = TICKET_CATEGORIES.find((item) => item.id === id);
  if (!row) {
    return id;
  }
  return getLang() === 'th' ? row.th : row.en;
}

function fillCategorySelect() {
  const select = document.querySelector('#ticket-category');
  const options = isGuest() ? TICKET_CATEGORIES.filter((item) => item.id === 'forgot_password') : TICKET_CATEGORIES;
  select.innerHTML = options
    .map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(categoryLabel(item.id))}</option>`)
    .join('');
  upgradeSelects(select.parentElement || document);
}

function configureGuestForm() {
  const wrap = document.querySelector('#ticket-email-wrap');
  const email = document.querySelector('#ticket-email');
  wrap.hidden = !isGuest();
  email.required = isGuest();
  fillCategorySelect();
}

function statusLabel(status) {
  return t(`tickets.status.${status}`) || status;
}

function submitterName(ticket) {
  if (ticket.contact_email) {
    return ticket.contact_email;
  }
  const person = roster.find((row) => row.id === ticket.user_id);
  return person ? formatPersonnelName(person) || ticket.user_id : ticket.user_id || t('units.unnamed');
}

function renderTickets() {
  const list = document.querySelector('#ticket-list');
  const empty = document.querySelector('#ticket-empty');
  empty.hidden = tickets.length > 0;
  list.innerHTML = tickets
    .map((ticket) => {
      const adminPanel = isAdmin()
        ? `
          <div class="ticket-admin">
            <label>${escapeHtml(t('tickets.reply'))}
              <textarea class="text-field" data-reply="${escapeHtml(ticket.id)}" rows="3">${escapeHtml(ticket.admin_reply || '')}</textarea>
            </label>
            <label>${escapeHtml(t('tickets.statusLabel'))}
              <select class="select-field" data-status="${escapeHtml(ticket.id)}">
                <option value="open"${ticket.status === 'open' ? ' selected' : ''}>${escapeHtml(t('tickets.status.open'))}</option>
                <option value="in_progress"${ticket.status === 'in_progress' ? ' selected' : ''}>${escapeHtml(t('tickets.status.in_progress'))}</option>
                <option value="closed"${ticket.status === 'closed' ? ' selected' : ''}>${escapeHtml(t('tickets.status.closed'))}</option>
              </select>
            </label>
            <button class="btn btn-primary" type="button" data-action="save-ticket" data-id="${escapeHtml(ticket.id)}">${escapeHtml(t('common.save'))}</button>
          </div>
        `
        : ticket.admin_reply
          ? `<p class="ticket-reply"><strong>${escapeHtml(t('tickets.reply'))}:</strong> ${escapeHtml(ticket.admin_reply)}</p>`
          : '';

      return `
        <article class="ticket-card" data-aos="fade-up">
          <header>
            <h3>${escapeHtml(ticket.custom_topic || categoryLabel(ticket.category))}</h3>
            <span class="unit-status">${escapeHtml(statusLabel(ticket.status))}</span>
          </header>
          <p class="ticket-meta">${escapeHtml(categoryLabel(ticket.category))}${isAdmin() ? ` · ${escapeHtml(submitterName(ticket))}` : ''}</p>
          <p>${escapeHtml(ticket.body)}</p>
          ${adminPanel}
          ${isAdmin() || ticket.user_id === actor?.id ? `<button class="btn btn-danger" type="button" data-action="delete-ticket" data-id="${escapeHtml(ticket.id)}">${escapeHtml(t('tickets.delete'))}</button>` : ''}
        </article>
      `;
    })
    .join('');
  upgradeSelects(list);
  initAos();
}

async function reload() {
  if (isGuest()) {
    tickets = [];
    renderTickets();
    return;
  }
  tickets = await fetchTickets(isAdmin(), actor.id);
  renderTickets();
}

bootCommandShell('tickets');

readCurrentPersonnel()
  .then(async (result) => {
    actor = result?.personnel || null;
    configureGuestForm();
    if (isGuest()) {
      renderTickets();
      return;
    }
    if (isAdmin()) {
      roster = await fetchPersonnelRoster().catch(() => []);
    }
    await reload();
  })
  .catch((error) => {
    showStatus(error.message, true);
  });

document.querySelector('#ticket-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const category = isGuest() ? 'forgot_password' : document.querySelector('#ticket-category').value;
  const customTopic = String(document.querySelector('#ticket-topic').value || '').trim();
  const body = String(document.querySelector('#ticket-body').value || '').trim();
  const contactEmail = String(document.querySelector('#ticket-email').value || '').trim();
  if (!customTopic || !body || (isGuest() && !contactEmail)) {
    showStatus(t('tickets.invalid'), true);
    return;
  }
  try {
    await createTicket({
      userId: actor?.id || null,
      category,
      customTopic,
      body,
      contactEmail: isGuest() ? contactEmail : null
    });
    document.querySelector('#ticket-topic').value = '';
    document.querySelector('#ticket-body').value = '';
    document.querySelector('#ticket-email').value = '';
    await reload();
    showStatus(t('tickets.sent'));
  } catch (error) {
    showStatus(error.message, true);
  }
});

document.querySelector('#ticket-list').addEventListener('click', async (event) => {
  const deleteButton = event.target.closest('[data-action="delete-ticket"]');
  if (deleteButton) {
    const ticketId = deleteButton.getAttribute('data-id');
    const ticket = tickets.find((row) => row.id === ticketId);
    if (!ticket || !(isAdmin() || ticket.user_id === actor?.id)) {
      return;
    }
    if (!window.confirm(t('tickets.confirmDelete'))) {
      return;
    }
    try {
      await deleteTicket(ticketId);
      await reload();
      showStatus(t('tickets.deleted'));
    } catch (error) {
      showStatus(error.message, true);
    }
    return;
  }
  const button = event.target.closest('[data-action="save-ticket"]');
  if (!button || !isAdmin()) {
    return;
  }
  const ticketId = button.getAttribute('data-id');
  const adminReply = document.querySelector(`[data-reply="${ticketId}"]`).value;
  const status = document.querySelector(`[data-status="${ticketId}"]`).value;
  try {
    await updateTicket(ticketId, { admin_reply: adminReply, status });
    await reload();
    showStatus(t('tickets.updated'));
  } catch (error) {
    showStatus(error.message, true);
  }
});

window.addEventListener('wlr-lang-changed', () => {
  fillCategorySelect();
  if (tickets.length) {
    renderTickets();
  }
});
