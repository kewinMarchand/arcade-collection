# Neon Games

Monorepo des jeux d’arcade **Neon** : portail + jeux, basé sur la base technique **`boilerplate-html`** (HTML/CSS/JS natifs, sans build lourd), avec socle de composants communs et thème **Neon** attaché.

## Structure

```
neon-games/
  apps/
    portal/            # portail (ex-neon-arcade) : apps/portal/
    games/
      invaders/        # apps/games/invaders/
      breaker/         # apps/games/breaker/
      columns/         # apps/games/columns/
      drift/           # apps/games/drift/
      runner/          # apps/games/runner/
      defender/        # apps/games/defender/
      mines/           # apps/games/mines/
      serpent/         # apps/games/serpent/
      orbiter/         # apps/games/orbiter/
  packages/
    ui/                # composants commons + shell de jeu (mountGameFrame)
    theme-neon/       # tokens + overrides Neon (attaches aux tokens --bui-* de boilerplates-ui)
    shared/           # utilitaires / ressources partagés
  docs/
    adr/               # ADRs du monorepo
  demo/
    game-shell.html   # page de démo/validation du shell
```

## URLs (nouvelles — sans redirection)

- Portail : `https://kewinmarchand.github.io/neon-games/`
- Jeux : `https://kewinmarchand.github.io/neon-games/apps/games/<slug>/`

## Règles métier (ADR-004)

- Viewport jeu : `100vh` / `100dvh`, sans scroll de page, pas d’overflow.
- Cadre de jeu identique pour tous les jeux (header / zone centrale / panneaux latéraux).
- Zone centrale (canvas/plateau) centrée ; éléments spécifiques (score, niveau, prochain élément, contrôles) dans les panneaux latéraux.

## Déploiement

GitHub Pages du monorepo (`main` → `/`). Voir l’ADR-0004 du chantier de consolidation (`boilerplates-commun/doc/adr/0004-deploiement-nouvelles-urls-coexistence.md`).

## ADRs

- `docs/adr/0001-base-boilerplate-html-shell-100vh-cadre-identique.md`
