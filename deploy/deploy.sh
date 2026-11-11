#!/usr/bin/env bash
# Fangleaf · mise à jour sur le VPS, lancée par la CD (ou à la main) depuis le dossier du clone.
# Le code est déjà à jour (git) : dépendances, migrations, build, rechargement pm2, vérification.
# Sert à la prod comme au staging : l'environnement est lu dans le .env du clone (voir ecosystem.config.cjs).
set -euo pipefail
cd "$(dirname "$0")/.."

# pm2 et npm installés via nvm ou globalement : une session SSH non interactive n'a pas toujours le PATH.
export PATH="$PATH:/usr/local/bin:$HOME/.local/bin"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"

APP=$(node -e "console.log(require('./ecosystem.config.cjs').apps[0].name)")
PORT=$(node -e "console.log(require('./ecosystem.config.cjs').apps[0].env.PORT)")

# Garde-fou du staging : il ne partage ni la base ni le projet Supabase de la prod.
# PROD_DIR : clone de prod sur la même machine (../Fangleaf par défaut) ; absent, rien à comparer.
if [ "$APP" = fangleaf-staging ]; then
  value() { { grep -E "^\s*$1\s*=" "$2" || true; } | tail -n 1 | cut -d= -f2- | tr -d " \"'\r"; }
  PROD_DIR=${PROD_DIR:-../Fangleaf}
  [ -n "$(value SUPABASE_URL .env)" ] || { echo "✘ .env du staging sans SUPABASE_URL : le staging a besoin de son propre projet Supabase" >&2; exit 1; }
  if [ -f "$PROD_DIR/.env" ]; then
    for key in SUPABASE_URL VITE_SUPABASE_URL DATABASE_URL; do
      mine=$(value "$key" .env)
      if [ -n "$mine" ] && [ "$mine" = "$(value "$key" "$PROD_DIR/.env")" ]; then
        echo "✘ $key du staging identique à celle de la prod ($PROD_DIR/.env) : déploiement refusé" >&2
        exit 1
      fi
    done
  fi
fi

echo "▶ $APP · $(git log -1 --format='%h %s')"
npm ci --no-audit --no-fund
npm run db:migrate
npm run build

# reload : le serveur sauvegarde les progressions à l'arrêt (SIGTERM) avant de redémarrer.
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save >/dev/null

# le serveur met quelques secondes à écouter après le reload : on réessaie sans bruit
for i in $(seq 1 15); do
  page=$(curl -fsS "http://127.0.0.1:$PORT/" 2>/dev/null || true) # pas de grep -q dans le tube : il couperait curl
  if grep -q '<title>Fangleaf</title>' <<<"$page"; then
    echo "✔ $APP en ligne sur le port $PORT"
    exit 0
  fi
  sleep 2
done
echo "✘ $APP ne répond pas sur le port $PORT" >&2
pm2 logs "$APP" --lines 30 --nostream >&2 || true
exit 1
