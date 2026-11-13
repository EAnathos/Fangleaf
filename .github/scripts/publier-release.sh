#!/usr/bin/env bash
# Publie la Release de la version mise en production : tag vX.Y.Z sur le commit déployé, notes tirées du
# changelog du lobby. Lancé par cd.yml après un déploiement réussi ; DRY_RUN=1 affiche sans rien créer.
#
#   .github/scripts/publier-release.sh <sha déployé>
#
# Variables : GITHUB_REPOSITORY (proprietaire/depot), GH_TOKEN (droit contents: write).
set -euo pipefail

SHA=${1:?commit déployé attendu}
R=${GITHUB_REPOSITORY:?}
export GH_REPO=$R

# Lu au commit déployé, pas sur la branche : la version et le changelog sont ceux qui tournent en production.
fichier() { gh api "repos/$R/contents/$1?ref=$SHA" --jq .content | base64 -d; }

version=$(fichier package.json | jq -r .version)
tag="v$version"

# Un tag existant n'est jamais déplacé : il désigne ce qui a tourné en production sous ce numéro.
# En cas d'erreur (404 : pas de tag), gh affiche quand même le corps de la réponse : on ne le garde pas.
existant=$(gh api "repos/$R/git/ref/tags/$tag" --jq .object.sha 2>/dev/null) || existant=
if [ "$existant" = "$SHA" ]; then
  echo "$tag est déjà publiée sur ce commit (redéploiement) : rien à faire"
  exit 0
elif [ -n "$existant" ]; then
  # Le déploiement a réussi, on ne le fait pas échouer pour autant : on le signale dans le résumé du run.
  echo "::warning title=Release non publiée::$tag existe déjà sur ${existant:0:7}, pas sur ${SHA:0:7}. La PR de version n'a sans doute pas été fusionnée avant la promotion."
  exit 0
fi

# Version précédente : celle de la dernière Release publiée, pour reprendre toutes les nouveautés depuis.
precedent=$(gh release list --exclude-drafts --limit 1 --json tagName --jq '.[0].tagName // empty')

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
fichier client/src/changelog.json > "$tmp/changelog.json"
notes=$(jq -r --arg cur "$version" --arg prev "${precedent#v}" '
  def num: split(".") | map(tonumber);
  [ .[] | select((.version | num) <= ($cur | num)
                 and (if $prev == "" then .version == $cur else (.version | num) > ($prev | num) end)) ]
  | map("### v\(.version) · \(.title)\n\n" + (.items | map("- " + .) | join("\n")))
  | join("\n\n")' "$tmp/changelog.json")
titre=$(jq -r --arg cur "$version" '.[] | select(.version == $cur) | .title' "$tmp/changelog.json" | head -1)

{
  if [ -n "$notes" ]; then printf '## Nouveautés\n\n%s\n' "$notes"; else printf 'Aucune nouveauté visible par les joueurs.\n'; fi
  if [ -n "$precedent" ]; then
    printf '\n**Tous les changements** : https://github.com/%s/compare/%s...%s\n' "$R" "$precedent" "$tag"
  fi
} > "$tmp/notes.md"

# Les titres consolidés du changelog peuvent être très longs : on garde un titre de Release lisible.
titre="$tag${titre:+ · $titre}"
[ ${#titre} -le 100 ] || titre="${titre:0:99}…"

if [ "${DRY_RUN:-}" = 1 ]; then
  echo "[essai] gh release create $tag --target $SHA --title \"$titre\""
  cat "$tmp/notes.md"
else
  gh release create "$tag" --target "$SHA" --title "$titre" --notes-file "$tmp/notes.md" --latest
  echo "Release $tag publiée"
fi
