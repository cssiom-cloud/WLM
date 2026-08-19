import { readCurrentPersonnel, signOutSession } from './session.js';
import { getLang, setLang, t } from './i18n.js';
import { showStatus } from './ui.js';

let lastActivePage = '';
let langListenerBound = false;

function hamburgerIcon() {
  return '<span></span><span></span><span></span>';
}

function langSwitchMarkup() {
  const lang = getLang();
  return `
    <div class="lang-switch" role="group" aria-label="Language">
      <button type="button" data-lang="th" class="${lang === 'th' ? 'is-active' : ''}">TH</button>
      <button type="button" data-lang="en" class="${lang === 'en' ? 'is-active' : ''}">EN</button>
    </div>
  `;
}

function groupMarkup(title, links, activePage) {
  if (!links.length) {
    return '';
  }
  return `
    <section class="drawer-group">
      <h2 class="drawer-group-title">${title}</h2>
      ${links
        .map(
          (link) =>
            `<a href="${link.href}" data-page="${link.page}"${link.page === activePage ? ' class="is-active"' : ''}>${link.label}</a>`
        )
        .join('')}
    </section>
  `;
}

export async function initCommandNavbar(activePage) {
  lastActivePage = activePage;
  const header = document.querySelector('#command-header');
  if (!header) {
    return;
  }

  header.innerHTML = `
    <div class="command-navbar">
      <a class="brand" href="./index.html">
        <img class="clan-insignia" src="./assets/1.jpg" alt="WHITE LION REGIMENT">
        <span class="clan-title">WHITE LION REGIMENT</span>
      </a>
      <div class="nav-actions">
        ${langSwitchMarkup()}
        <button class="hamburger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="command-drawer">
          ${hamburgerIcon()}
        </button>
      </div>
    </div>
    <button class="drawer-backdrop" type="button" aria-label="Close menu"></button>
    <nav class="command-drawer" id="command-drawer" hidden></nav>
  `;

  const drawer = header.querySelector('#command-drawer');
  const hamburger = header.querySelector('.hamburger');
  const backdrop = header.querySelector('.drawer-backdrop');
  const { session, personnel } = await readCurrentPersonnel().catch(() => ({
    session: null,
    personnel: null
  }));

  const isAdmin = personnel?.role === 'admin';
  const isAuthed = Boolean(session);

  const personnelLinks = [{ href: './index.html', page: 'home', label: t('nav.home') }];
  if (isAuthed) {
    personnelLinks.push({ href: './directory.html', page: 'directory', label: t('nav.directory') });
    personnelLinks.push({ href: './units.html', page: 'units', label: t('nav.units') });
  } else {
    personnelLinks.push({ href: './directory.html', page: 'directory', label: t('nav.directory') });
  }

  const operationsLinks = [{ href: './announcements.html', page: 'announcements', label: t('nav.announcements') }];
  if (isAdmin) {
    operationsLinks.push({ href: './announce-create.html', page: 'announce-create', label: t('nav.createAnnouncement') });
  }

  const archiveLinks = [
    { href: './lore.html', page: 'lore', label: t('nav.lore') },
    { href: './documents.html', page: 'documents', label: t('nav.documents') }
  ];

  const supportLinks = [{ href: './tickets.html', page: 'tickets', label: t('nav.tickets') }];

  const commandLinks = [];
  if (isAdmin) {
    commandLinks.push({ href: './admin.html', page: 'admin', label: t('nav.adminPage') });
  }
  if (isAuthed) {
    commandLinks.push({ href: './settings.html', page: 'settings', label: t('nav.settings') });
    commandLinks.push({ href: './logs.html', page: 'logs', label: t('nav.logs') });
  }

  drawer.innerHTML = `${groupMarkup(t('nav.group.personnel'), personnelLinks, activePage)}
    ${groupMarkup(t('nav.group.operations'), operationsLinks, activePage)}
    ${groupMarkup(t('nav.group.archive'), archiveLinks, activePage)}
    ${groupMarkup(t('nav.group.support'), supportLinks, activePage)}
    ${groupMarkup(t('nav.group.command'), commandLinks, activePage)}
    <button class="linkish" type="button" id="sign-out-control"${isAuthed ? '' : ' hidden'}>${t('nav.signOut')}</button>`;

  const setOpen = (open) => {
    drawer.classList.toggle('is-open', open);
    backdrop.classList.toggle('is-open', open);
    hamburger.classList.toggle('is-open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    drawer.hidden = !open;
  };

  hamburger.addEventListener('click', () => {
    setOpen(!drawer.classList.contains('is-open'));
  });
  backdrop.addEventListener('click', () => setOpen(false));

  header.querySelectorAll('.lang-switch [data-lang]').forEach((button) => {
    button.addEventListener('click', () => {
      setLang(button.getAttribute('data-lang'));
    });
  });

  const signOutControl = header.querySelector('#sign-out-control');
  if (isAuthed) {
    signOutControl.addEventListener('click', () => {
      signOutSession().catch((error) => {
        showStatus(error.message, true);
      });
    });
  }

  if (!langListenerBound) {
    langListenerBound = true;
    window.addEventListener('wlr-lang-changed', () => {
      initCommandNavbar(lastActivePage);
    });
  }
}
