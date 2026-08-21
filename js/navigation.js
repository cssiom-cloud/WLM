import { readCurrentPersonnel, signOutSession } from './session.js';
import { getLang, setLang, t } from './i18n.js';
import { showStatus } from './ui.js';

let lastActivePage = '';
let langListenerBound = false;
let navGeneration = 0;

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
            `<a href="${link.href}" data-page="${link.page}"${link.page === activePage ? ' class="is-active" aria-current="page"' : ''}>${link.label}</a>`
        )
        .join('')}
    </section>
  `;
}

let closeTimer = 0;

function syncMenuButtons(header, open) {
  header.querySelectorAll('.hamburger').forEach((button) => {
    button.classList.toggle('is-open', open);
    button.setAttribute('aria-expanded', String(open));
    button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
}

export async function initCommandNavbar(activePage) {
  lastActivePage = activePage;
  const generation = ++navGeneration;
  const header = document.querySelector('#command-header');
  if (!header) {
    return;
  }

  header.innerHTML = `
    <div class="command-navbar">
      <div class="nav-lead">
        <button class="hamburger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="command-drawer">
          ${hamburgerIcon()}
        </button>
        <a class="brand" href="./index.html">
          <img class="clan-insignia" src="./assets/1.jpg" alt="WHITE LION REGIMENT">
          <span class="clan-title">WHITE LION REGIMENT</span>
        </a>
      </div>
      <nav class="command-nav-desktop" aria-label="${t('nav.group.personnel')}"></nav>
      <div class="nav-actions">
        ${langSwitchMarkup()}
      </div>
    </div>
    <button class="drawer-backdrop" type="button" aria-label="Close menu"></button>
    <nav class="command-drawer" id="command-drawer" hidden></nav>
    <nav class="command-bottom-nav" aria-label="${t('nav.mobile')}"></nav>
  `;

  const drawer = header.querySelector('#command-drawer');
  const hamburger = header.querySelector('.hamburger');
  const backdrop = header.querySelector('.drawer-backdrop');
  const { session, personnel } = await readCurrentPersonnel().catch(() => ({
    session: null,
    personnel: null
  }));
  if (generation !== navGeneration) {
    return;
  }

  const isAdmin = personnel?.role === 'admin';
  const isAuthed = Boolean(session);

  const personnelLinks = [{ href: './index.html', page: 'home', label: t('nav.home') }];
  personnelLinks.push({ href: './directory.html', page: 'directory', label: t('nav.directory') });
  personnelLinks.push({ href: './org.html', page: 'org', label: t('nav.org') });
  if (isAuthed) {
    personnelLinks.push({ href: './units.html', page: 'units', label: t('nav.units') });
  }

  const operationsLinks = [
    { href: './operations.html', page: 'operations', label: t('nav.operations') },
    { href: './announcements.html', page: 'announcements', label: t('nav.announcements') }
  ];
  if (isAdmin) {
    operationsLinks.push({ href: './announce-create.html', page: 'announce-create', label: t('nav.createAnnouncement') });
  }

  const archiveLinks = [
    { href: './lore.html', page: 'lore', label: t('nav.lore') },
    { href: './documents.html', page: 'documents', label: t('nav.documents') }
  ];
  if (isAuthed) {
    archiveLinks.push({ href: './memo.html', page: 'memo', label: t('nav.memo') });
  }

  const supportLinks = [{ href: './tickets.html', page: 'tickets', label: t('nav.tickets') }];

  const commandLinks = [];
  if (isAdmin) {
    commandLinks.push({ href: './admin.html', page: 'admin', label: t('nav.adminPage') });
    commandLinks.push({ href: './accounts.html', page: 'accounts', label: t('nav.accounts') });
  }
  if (isAuthed) {
    commandLinks.push({ href: './profiles.html', page: 'profiles', label: t('nav.profiles') });
    commandLinks.push({ href: './settings.html', page: 'settings', label: t('nav.settings') });
    commandLinks.push({ href: './logs.html', page: 'logs', label: t('nav.logs') });
  }

  drawer.innerHTML = `
    <div class="command-drawer-body">
    ${groupMarkup(t('nav.group.personnel'), personnelLinks, activePage)}
    ${groupMarkup(t('nav.group.operations'), operationsLinks, activePage)}
    ${groupMarkup(t('nav.group.archive'), archiveLinks, activePage)}
    ${groupMarkup(t('nav.group.support'), supportLinks, activePage)}
    ${groupMarkup(t('nav.group.command'), commandLinks, activePage)}
    <button class="linkish" type="button" id="sign-out-control"${isAuthed ? '' : ' hidden'}>${t('nav.signOut')}</button>
    </div>`;

  const desktopNav = header.querySelector('.command-nav-desktop');
  const desktopLinks = [
    ...personnelLinks,
    operationsLinks[0],
    operationsLinks[1],
    archiveLinks[0]
  ].filter(Boolean);
  if (isAuthed) {
    desktopLinks.push({ href: './memo.html', page: 'memo', label: t('nav.memo') });
  }
  desktopNav.innerHTML = desktopLinks
    .map(
      (link) =>
        `<a href="${link.href}" data-page="${link.page}"${link.page === activePage ? ' class="is-active" aria-current="page"' : ''}>${link.label}</a>`
    )
    .join('');

  const bottomNav = header.querySelector('.command-bottom-nav');
  const bottomLinks = [
    { href: './index.html', page: 'home', label: t('nav.home') },
    { href: './directory.html', page: 'directory', label: t('nav.directory') },
    { href: './announcements.html', page: 'announcements', label: t('nav.announcements') }
  ];
  bottomNav.innerHTML = `${bottomLinks
    .map(
      (link) =>
        `<a href="${link.href}"${link.page === activePage ? ' class="is-active" aria-current="page"' : ''}>${link.label}</a>`
    )
    .join('')}
    <button class="hamburger hamburger-dock" type="button" data-open-drawer aria-label="${t('nav.menu')}">
      ${hamburgerIcon()}
    </button>`;

  const setOpen = (open) => {
    window.clearTimeout(closeTimer);
    document.body.classList.remove('has-nav-rail');
    drawer.classList.remove('is-rail');
    if (open) {
      drawer.hidden = false;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          drawer.classList.add('is-open');
          backdrop.classList.add('is-open');
        });
      });
    } else {
      drawer.classList.remove('is-open');
      backdrop.classList.remove('is-open');
      closeTimer = window.setTimeout(() => {
        if (!drawer.classList.contains('is-open')) {
          drawer.hidden = true;
        }
      }, 380);
    }
    syncMenuButtons(header, open);
  };

  hamburger.addEventListener('click', () => {
    setOpen(!drawer.classList.contains('is-open'));
  });
  backdrop.addEventListener('click', () => setOpen(false));
  bottomNav.querySelector('[data-open-drawer]')?.addEventListener('click', () => {
    setOpen(!drawer.classList.contains('is-open'));
  });

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

  document.body.classList.remove('has-nav-rail');
  drawer.classList.remove('is-rail');
  if (!drawer.classList.contains('is-open')) {
    drawer.hidden = true;
  }

  if (!langListenerBound) {
    langListenerBound = true;
    window.addEventListener('wlr-lang-changed', () => {
      initCommandNavbar(lastActivePage);
    });
  }
}
