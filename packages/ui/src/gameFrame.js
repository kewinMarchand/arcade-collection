/*
 * UI commons Arcade — composants + shell de jeu.
 *
 * Règle du domaine : pas de composant « Arcade ». Le shell de jeu est un COMPOSANT
 * générique (contenu central + panneaux latéraux) rendu avec le thème Arcade.
 */

const FRAME_TESTIDS = {
  frame: 'game-frame',
  header: 'game-header',
  screen: 'game-screen',
  panelLeft: 'game-panel-left',
  panelRight: 'game-panel-right',
  footer: 'game-footer',
};

function inferSourceUrl() {
  try {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const idx = parts.lastIndexOf('apps');
    if (idx !== -1 && parts[idx + 1]) {
      const slug = parts[idx + 1];
      return `https://github.com/kewinMarchand/arcade-collection/tree/main/apps/${slug}`;
    }
  } catch (_) {}
  return 'https://github.com/kewinMarchand/arcade-collection';
}

function inferLandingUrl() {
  try {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const idx = parts.lastIndexOf('apps');
    if (idx !== -1) {
      const base = parts.slice(0, idx).join('/');
      return `${window.location.origin}/${base ? base + '/' : ''}`;
    }
  } catch (_) {}
  return '../../';
}

function createFullscreenButton(target) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'arcade-frame__action arcade-frame__action--fullscreen';
  const sync = () => {
    const active = typeof document !== 'undefined' && document.fullscreenElement === target;
    btn.textContent = active ? 'Quitter plein écran' : 'Plein écran';
    btn.setAttribute('aria-label', active ? 'Quitter le plein écran' : 'Passer en plein écran');
    btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    target.classList.toggle('is-fullscreen', active);
  };
  btn.addEventListener('click', async () => {
    try {
      if (!document.fullscreenElement) await target.requestFullscreen();
      else if (document.fullscreenElement === target) await document.exitFullscreen();
      else {
        await document.exitFullscreen();
        await target.requestFullscreen();
      }
      sync();
    } catch (_) {}
  });
  document.addEventListener('fullscreenchange', sync);
  sync();
  return btn;
}

/**
 * Monte le cadre de jeu identique pour tous les jeux du monorepo.
 *
 * Structure commune (ADR-004) :
 *   header (titre / sous-titre / options) > corps (panneau gauche | zone jeu | panneau droit) > footer.
 */
export function mountGameFrame({ mount, config }) {
  const { title, subtitle, panels = [], screen, footer } = config;
  if (!mount) throw new Error('gameFrame: mount requis');
  if (mount.firstChild) mount.replaceChildren();

  const frame = document.createElement('main');
  frame.className = 'arcade-frame arcade-frame--game';
  frame.dataset.testid = FRAME_TESTIDS.frame;
  frame.setAttribute('data-title', title);

  const header = document.createElement('header');
  header.className = 'arcade-frame__header';
  header.dataset.testid = FRAME_TESTIDS.header;
  const brand = document.createElement('div');
  brand.className = 'arcade-frame__brand';
  const mark = document.createElement('span');
  mark.className = 'arcade-frame__mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = '◆';
  const titles = document.createElement('div');
  titles.className = 'arcade-frame__titles';
  const h1 = document.createElement('h1');
  h1.className = 'arcade-frame__title';
  h1.textContent = title;
  titles.append(h1);
  if (subtitle) {
    const p = document.createElement('p');
    p.className = 'arcade-frame__subtitle';
    p.textContent = subtitle;
    titles.append(p);
  }
  const markClose = mark.cloneNode(true);
  brand.append(mark, titles, markClose);
  header.append(brand);

  const actions = document.createElement('div');
  actions.className = 'arcade-frame__actions';
  const landingUrl = config.landingUrl || inferLandingUrl();
  if (config.showLandingLink !== false && landingUrl) {
    const homeLink = document.createElement('a');
    homeLink.className = 'arcade-frame__action arcade-frame__action--home';
    homeLink.href = landingUrl;
    homeLink.setAttribute('aria-label', 'Retour à l’accueil');
    homeLink.title = 'Accueil';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M7.5 8.25A1.75 1.75 0 0 0 5.75 10v1.25h-.5A2.25 2.25 0 0 0 3 13.5v1.25A3.25 3.25 0 0 0 6.25 18h11.5A3.25 3.25 0 0 0 21 14.75V13.5a2.25 2.25 0 0 0-2.25-2.25h-.5V10a1.75 1.75 0 0 0-1.75-1.75h-9ZM7 10c0-.138.112-.25.25-.25h9.5c.138 0 .25.112.25.25v1.25H7V10Zm-1.75 2.75h13.5c.414 0 .75.336.75.75v1.25a1.75 1.75 0 0 1-1.75 1.75H6.25a1.75 1.75 0 0 1-1.75-1.75V13.5c0-.414.336-.75.75-.75Zm3.25 1.25a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm-1.5-.25a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm1.5-1.25a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25 1.5a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Zm.75 1.25a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Zm-.75-2.75a.75.75 0 1 0-1.5 0 .75.75 0 0 0 1.5 0Z');
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    homeLink.appendChild(svg);
    actions.append(homeLink);
  }
  if (config.showFullscreenToggle !== false) actions.append(createFullscreenButton(frame));
  const sourceUrl = config.sourceUrl || inferSourceUrl();
  if (config.showSourceLink !== false && sourceUrl) {
    const sourceLink = document.createElement('a');
    sourceLink.className = 'arcade-frame__action arcade-frame__action--source';
    sourceLink.href = sourceUrl;
    sourceLink.target = '_blank';
    sourceLink.rel = 'noopener noreferrer';
    sourceLink.setAttribute('aria-label', `Voir le code source de ${title} sur GitHub`);
    sourceLink.title = 'Code source (GitHub)';
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12');
    path.setAttribute('fill', 'currentColor');
    svg.appendChild(path);
    sourceLink.appendChild(svg);
    actions.append(sourceLink);
  }
  if (actions.childNodes.length) header.append(actions);

  if (typeof config.renderHeader === 'function') header.append(config.renderHeader());

  const body = document.createElement('div');
  body.className = 'arcade-frame__body';
  const left = document.createElement('aside');
  left.className = 'arcade-side arcade-side--left';
  left.dataset.testid = FRAME_TESTIDS.panelLeft;
  const right = document.createElement('aside');
  right.className = 'arcade-side arcade-side--right';
  right.dataset.testid = FRAME_TESTIDS.panelRight;

  const screenEl = document.createElement('section');
  screenEl.className = 'arcade-screen';
  screenEl.dataset.testid = FRAME_TESTIDS.screen;
  if (screen && typeof screen.mount === 'function') screen.mount(screenEl);

  body.append(left, screenEl, right);
  frame.append(header, body);

  const footerEl = document.createElement('footer');
  footerEl.className = 'arcade-frame__footer';
  footerEl.dataset.testid = FRAME_TESTIDS.footer;
  if (typeof footer === 'function') footerEl.append(footer());
  else if (typeof footer === 'string') footerEl.textContent = footer;
  if (footerEl.childNodes.length || footerEl.textContent) frame.append(footerEl);

  mount.append(frame);

  for (const panel of panels) {
    const slot = panel.side === 'left' ? left : right;
    if (typeof panel.render === 'function') {
      const rendered = panel.render();
      if (rendered) {
        rendered.dataset.testid = rendered.dataset.testid || `game-panel-${panel.side}`;
        rendered.classList.add('arcade-panel--slot');
        slot.append(rendered);
      }
    }
  }

  return { frame, header, body, screen: screenEl, panels: { left, right }, footer: footerEl, mount, actions };
}

/**
 * Lien dépôt GitHub (composant utilitaire).
 */
export function createRepoLink({ href, label, className = 'bui-link' } = {}) {
  const a = document.createElement('a');
  a.className = `${className} repo-link`;
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.setAttribute('aria-label', label ?? 'Voir le code source sur GitHub');
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '16');
  svg.setAttribute('height', '16');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M12 .297c6.63 0 12 5.373 12 12 0 5.303-3.438 9.8-8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12');
  path.setAttribute('fill', 'currentColor');
  svg.appendChild(path);
  a.appendChild(svg);
  return a;
}
