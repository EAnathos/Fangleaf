#!/usr/bin/env bash
# Reporte sur GitHub ce qu'un déploiement vient de mettre en ligne. Lancé par cd-staging.yml et cd.yml après un
# déploiement réussi ; DRY_RUN=1 affiche les actions sans rien modifier.
#
#   .github/scripts/suivi-deploiement.sh staging|production <sha déployé>
#
# Une PR est « déployée » quand son commit de fusion est un ancêtre du commit en ligne. Les PR suivent la convention
# de CONTRIBUTING.md : `Termine #N` si elle finit l'issue, `Refs #N` sinon.
#   staging     PR et issues ouvertes reçoivent le label sur-staging ; un commentaire sur la PR donne la version.
#   production  PR : en-production (et plus sur-staging). Issues : plus sur-staging ; fermées si une PR les marque
#               Termine, sinon un commentaire dit ce qui est en ligne.
#
# Les labels servent aussi de mémoire : une PR déjà marquée n'est plus traitée, donc un redéploiement ne répète rien
# et un déploiement raté est rattrapé par le suivant.
#
# Variables : GITHUB_REPOSITORY, GH_TOKEN (issues et pull-requests en écriture), STAGING_URL (facultative),
# SUIVI_DEPUIS (AAAA-MM-JJ : les PR fusionnées avant n'ont jamais été suivies et ne le seront pas).
set -euo pipefail

CIBLE=${1:?staging ou production attendu}
SHA=${2:?commit déployé attendu}
R=${GITHUB_REPOSITORY:?}
export GH_REPO=$R
DEPUIS=${SUIVI_DEPUIS:?date de début du suivi attendue}
# Même motif que le contrôle des descriptions de PR (pr-description.yml).
MOTIF='(termine|refs)[[:space:]]*:?[[:space:]]*#[0-9]+'

faire() {
  if [ "${DRY_RUN:-}" = 1 ]; then echo "[essai] $*"; else "$@"; fi
}

case $CIBLE in
  staging) label_pr=sur-staging; recherche="-label:sur-staging -label:en-production" ;;
  production) label_pr=en-production; recherche="-label:en-production" ;;
  *) echo "cible inconnue : $CIBLE" >&2; exit 1 ;;
esac

version=$(gh api "repos/$R/contents/package.json?ref=$SHA" --jq .content | base64 -d | jq -r .version)
court=${SHA:0:7}

if [ "${DRY_RUN:-}" != 1 ]; then
  gh label create sur-staging --color FBCA04 --description "Sur le staging, pas encore en production" --force >/dev/null
  gh label create en-production --color 0E8A16 --description "En production" --force >/dev/null
fi

# La recherche écarte le gros des PR déjà traitées ; les labels relus ensuite font foi (l'index de recherche peut
# avoir un temps de retard). Promotions, retours de main dans dev et PR de version n'ont pas d'issue à suivre.
candidates=$(gh pr list --state merged --limit 200 --search "merged:>=$DEPUIS $recherche" \
  --json number,baseRefName,headRefName,mergeCommit,labels,body --jq '
    .[] | select(.baseRefName == "dev" or .baseRefName == "main")
        | select(.headRefName | IN("dev", "main", "automation/version-changelog") | not)
        | select([.labels[].name] | index("'"$label_pr"'") | not)
        | [.number, .mergeCommit.oid, ("," + ([.labels[].name] | join(",")) + ","), (.body // "" | @base64)] | @tsv')

declare -A termine=() refs=()
deployees=()
# Labels encadrés de virgules : jamais vides, sinon read fusionnerait les tabulations et décalerait les colonnes.
# Lu sur le descripteur 3 : les commandes gh de la boucle ne peuvent pas consommer la liste.
while IFS=$'\t' read -r -u 3 pr fusion labels corps; do
  [ -n "$pr" ] || continue
  # ahead : la fusion est un ancêtre du commit déployé ; identical : c'est lui.
  statut=$(gh api "repos/$R/compare/$fusion...$SHA?per_page=1" --jq .status 2>/dev/null) || statut=inconnu
  case $statut in identical | ahead) ;; *) continue ;; esac
  deployees+=("#$pr")

  corps=$(base64 -d <<<"$corps")
  while read -r mot n; do
    [ -n "$n" ] || continue
    if [ "$mot" = termine ]; then termine[$n]+=" #$pr"; else refs[$n]+=" #$pr"; fi
  done < <(grep -oiE "\\b$MOTIF" <<<"$corps" | tr 'A-Z' 'a-z' | sed -E 's/^(termine|refs).*#([0-9]+)$/\1 \2/' || true)

  if [ "$CIBLE" = staging ]; then
    faire gh pr edit "$pr" --add-label sur-staging
    faire gh pr comment "$pr" --body "Déployé sur le staging en v$version (\`$court\`)${STAGING_URL:+ : $STAGING_URL}"
  elif [[ $labels == *,sur-staging,* ]]; then
    faire gh pr edit "$pr" --add-label en-production --remove-label sur-staging
  else
    faire gh pr edit "$pr" --add-label en-production
  fi
done 3<<<"$candidates"

echo "PR déployées sur $CIBLE en v$version : ${deployees[*]:-aucune}"

for n in $(printf '%s\n' "${!termine[@]}" "${!refs[@]}" | sort -un); do
  # Le numéro peut désigner une PR ou ne pas exister : seules les vraies issues sont suivies.
  info=$(gh api "repos/$R/issues/$n" --jq 'if .pull_request then "pr" else .state + " " + ([.labels[].name] | join(",")) end' 2>/dev/null) \
    || { echo "#$n introuvable, ignorée"; continue; }
  [ "$info" != pr ] || continue
  etat=${info%% *}
  labels=${info#* }
  prs=$(tr ' ' '\n' <<<"${termine[$n]:-} ${refs[$n]:-}" | sed '/^$/d' | sort -u | paste -sd, - | sed 's/,/, /g')

  if [ "$CIBLE" = staging ]; then
    [ "$etat" = open ] && faire gh issue edit "$n" --add-label sur-staging
    continue
  fi

  [[ ",$labels," == *,sur-staging,* ]] && faire gh issue edit "$n" --remove-label sur-staging
  [ "$etat" = open ] || continue
  if [ -n "${termine[$n]:-}" ]; then
    faire gh issue close "$n" --reason completed --comment "Terminée par $prs, en production dans v$version."
  else
    faire gh issue comment "$n" --body "En production dans v$version : $prs. L'issue reste ouverte, aucune PR ne la marque \`Termine\`."
  fi
done
