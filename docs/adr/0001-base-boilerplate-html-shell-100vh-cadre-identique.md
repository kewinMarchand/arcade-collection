# ADR-0001. Base `boilerplate-html` et shell de jeu 100vh / cadre identique

- **Statut** : Acceptée
- **Date** : 2026-11-18
- **Contexte** : plan de consolidation `PLAN-CONSOLIDATION-Arcade.md`, Phase 2 (jeux)

## Contexte

Les jeux doivent migrer dans le monorepo `arcade-collection`, à partir de la base technique `boilerplate-html`, avec une intégration canvas/vanilla et un **shell** commun.

## Décision

1. **Base** : `boilerplate-html` (HTML/CSS/JS natifs, sans build lourd, conventions QA/a11y/SEO/outillage natif).
2. **Shell** : cadre de jeu identique pour tous les jeux — viewport `100vh` (et `100dvh`), sans scroll de page, pas d'overflow, zone centrale (canvas/plateau) centrée, panneaux latéraux pour les options spécifiques (score, niveau, prochain élément, contrôles, aide).

## Alternatives envisagées

- **Base Next.js** : rejetée (le plan retient `boilerplate-html`, plus adapté aux jeux canvas).
- **Cadre par jeu** : rejetée (le cadre doit être identique).

## Conséquences

- Tous les jeux du monorepo passent par le composant générique de shell (`packages/ui`) + thème Arcade (`packages/theme-arcade`).
- Les éléments spécifiques à un jeu (ex. « prochain élément » de Columns) vivent dans les panneaux latéraux, sans modifier le cadre.

## Suivi

Référence : [ADR-0002](../../boilerplates-commun/doc/adr/0002-composants-communs-et-theme-arcade.md) (composants communs + thème), [ADR-0003](../../boilerplates-commun/doc/adr/0003-structure-des-monorepos.md) (structure).

## Statut

Acceptée — 2026-11-18
