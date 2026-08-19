import { bootCommandShell, initAos } from './shell.js';
import { requireAuthenticatedPersonnel } from './session.js';
import { escapeHtml, showStatus } from './ui.js';
import {
  fetchActivityLogs,
  formatBytes,
  isAdminLog,
  isUserLog,
  measureCommandStatus
} from './command-services.js';

let statusTimer = null;

function renderStatus(status) {
  document.querySelector('#ping-value').textContent = `${status.latencyMs} ms`;
  document.querySelector('#storage-value').textContent =
    `${formatBytes(status.storage_remaining_bytes)} remaining / ${formatBytes(status.storage_limit_bytes)}`;
  document.querySelector('#storage-used').textContent = `Used ${formatBytes(status.storage_used_bytes)}`;
}

function renderLogTable(target, rows) {
  if (rows.length === 0) {
    target.innerHTML = '<p class="empty-log">No records.</p>';
    return;
  }
  target.innerHTML = `
    <div class="table-wrap">
      <table class="personnel-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Role</th>
            <th>Action</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(new Date(row.created_at).toLocaleString())}</td>
                  <td>${escapeHtml(row.role_snapshot || '')}</td>
                  <td>${escapeHtml(row.action_type || '')}</td>
                  <td>${escapeHtml(row.details || '')}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

bootCommandShell('logs');

requireAuthenticatedPersonnel()
  .then(async (result) => {
    if (!result) {
      return;
    }
    const isAdmin = result.personnel.role === 'admin';
    const adminTab = document.querySelector('#tab-admin');
    if (!isAdmin) {
      adminTab.hidden = true;
    }

    const refreshStatus = async () => {
      try {
        renderStatus(await measureCommandStatus());
      } catch (error) {
        document.querySelector('#ping-value').textContent = 'Unavailable';
        document.querySelector('#storage-value').textContent = error.message;
      }
    };

    await refreshStatus();
    statusTimer = window.setInterval(refreshStatus, 5000);

    const logs = await fetchActivityLogs(isAdmin, result.personnel.id);
    renderLogTable(
      document.querySelector('#user-log-panel'),
      logs.filter((row) => isUserLog(row.action_type))
    );
    renderLogTable(
      document.querySelector('#admin-log-panel'),
      logs.filter((row) => isAdminLog(row.action_type))
    );
    initAos();
  })
  .catch((error) => {
    showStatus(error.message, true);
  });

document.querySelectorAll('[data-log-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    const tab = button.getAttribute('data-log-tab');
    document.querySelectorAll('[data-log-tab]').forEach((item) => item.classList.toggle('is-active', item === button));
    document.querySelector('#user-log-panel').hidden = tab !== 'user';
    document.querySelector('#admin-log-panel').hidden = tab !== 'admin';
  });
});

window.addEventListener('beforeunload', () => {
  if (statusTimer) {
    window.clearInterval(statusTimer);
  }
});
