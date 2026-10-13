#!/usr/bin/env bash
# Fangleaf · mise à jour sur le VPS, lancée par la CD (ou à la main) depuis le dossier du clone.
# Le code est déjà à jour (git) : dépendances, migrations, build, rechargement pm2, vérification.
set -euo pipefail
cd "$(dirname "$0")/.."

# pm2 et npm installés via nvm ou globalement : une session SSH non interactive n'a pas toujours le PATH.
export PATH="$PATH:/usr/local/bin:$HOME/.local/bin"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"

PORT=$(node -e "console.log(require('./ecosystem.config.cjs').apps[0].env.PORT)")

echo "▶ $(git log -1 --format='%h %s')"
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
    echo "✔ Fangleaf en ligne sur le port $PORT"
    exit 0
  fi
  sleep 2
done
echo "✘ Fangleaf ne répond pas sur le port $PORT" >&2
pm2 logs fangleaf --lines 30 --nostream >&2 || true
exit 1
