/*
 * UI commons Neon — composants + shell de jeu.
 *
 * Règle du domaine : pas de composant « Neon ». Le shell de jeu est un COMPOSANT
 * générique (contenu central + panneaux latéraux) rendu avec le thème Neon.
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
      return `https://github.com/kewinMarchand/neon-games/tree/main/apps/${slug}`;
    }
  } catch (_) {}
  return 'https://github.com/kewinMarchand/neon-games';
}

function createFullscreenButton(target) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'neon-frame__action neon-frame__action--fullscreen';
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
  frame.className = 'neon-frame neon-frame--game';
  frame.dataset.testid = FRAME_TESTIDS.frame;
  frame.setAttribute('data-title', title);

  const header = document.createElement('header');
  header.className = 'neon-frame__header';
  header.dataset.testid = FRAME_TESTIDS.header;
  const brand = document.createElement('div');
  brand.className = 'neon-frame__brand';
  const mark = document.createElement('span');
  mark.className = 'neon-frame__mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = '◆';
  const titles = document.createElement('div');
  titles.className = 'neon-frame__titles';
  const h1 = document.createElement('h1');
  h1.className = 'neon-frame__title';
  h1.textContent = title;
  titles.append(h1);
  if (subtitle) {
    const p = document.createElement('p');
    p.className = 'neon-frame__subtitle';
    p.textContent = subtitle;
    titles.append(p);
  }
  const markClose = mark.cloneNode(true);
  brand.append(mark, titles, markClose);
  header.append(brand);

  const actions = document.createElement('div');
  actions.className = 'neon-frame__actions';
  if (config.showFullscreenToggle !== false) actions.append(createFullscreenButton(frame));
  const sourceUrl = config.sourceUrl || inferSourceUrl();
  if (config.showSourceLink !== false && sourceUrl) {
    const sourceLink = document.createElement('a');
    sourceLink.className = 'neon-frame__action neon-frame__action--source';
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
  body.className = 'neon-frame__body';
  const left = document.createElement('aside');
  left.className = 'neon-side neon-side--left';
  left.dataset.testid = FRAME_TESTIDS.panelLeft;
  const right = document.createElement('aside');
  right.className = 'neon-side neon-side--right';
  right.dataset.testid = FRAME_TESTIDS.panelRight;

  const screenEl = document.createElement('section');
  screenEl.className = 'neon-screen';
  screenEl.dataset.testid = FRAME_TESTIDS.screen;
  if (screen && typeof screen.mount === 'function') screen.mount(screenEl);

  body.append(left, screenEl, right);
  frame.append(header, body);

  const footerEl = document.createElement('footer');
  footerEl.className = 'neon-frame__footer';
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
        rendered.classList.add('neon-panel--slot');
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
