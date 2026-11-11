# Déclarer une nouveauté

Pour chaque PR qui apporte un changement visible par les joueurs, ajouter **son propre fichier JSON** dans ce dossier. Ne modifier ni `package.json`, ni `package-lock.json`, ni `client/src/changelog.json`.

Nommer le fichier avec un identifiant unique et parlant, par exemple `123-cycle-jour-nuit.json` :

```json
{
  "bump": "minor",
  "date": "2026-11-11",
  "title": "Des jours et des nuits plus courts",
  "items": [
    "Le cycle jour/nuit dure désormais 14 minutes au lieu de 20."
  ]
}
```

- `bump` : `patch` pour une correction, `minor` pour une nouveauté, `major` pour une rupture majeure.
- `date` : date prévue de publication, au format `AAAA-MM-JJ`.
- `title` : titre court affiché dans le lobby.
- `items` : une ou plusieurs phrases destinées aux joueurs.

Chaque fichier est indépendant : plusieurs PR peuvent ajouter leur JSON sans modifier un fichier central. À la publication sur `main`, le workflow consolide les changements, applique le plus haut niveau SemVer demandé, met à jour le changelog et les versions npm, puis supprime les fragments traités.
