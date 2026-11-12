// Quels panneaux restent ouverts quand on s'éloigne de l'endroit où on les a ouverts. Un panneau de bâtiment (forge,
// Tanière, marché…) se ferme dès qu'on quitte le bâtiment ; les autres ne dépendent d'aucun lieu. L'échange en fait
// partie : le fermer l'annule pour les deux dompteurs, il ne doit donc jamais se fermer tout seul (issue #58).

import type { Panel } from './hud.ts';

const ANYWHERE: ReadonlySet<Panel> = new Set<Panel>(['map', 'quit', 'settings', 'chat', 'board', 'profile', 'victory', 'trade']);

/** Ce panneau se ferme-t-il quand on n'est plus près du lieu qui l'ouvre (spot : le panneau du lieu où l'on se tient) ? */
export const closesAway = (panel: Panel, spot: Panel | undefined) => panel !== null && !ANYWHERE.has(panel) && spot !== panel;
