# Fangleaf · image du staging, construite par Coolify. La production, elle, reste en pm2 derrière nginx
# (ecosystem.config.cjs, deploy/deploy.sh) : cette image ne la concerne pas. Voir docs/ENVIRONNEMENTS.md.
#
# Dans Coolify : « Base Directory » = / (le contexte est la racine du dépôt) et
# « Dockerfile Location » = /deploy/Dockerfile.

FROM node:22-alpine

# Valeurs du client, figées dans dist/ au moment du build : Coolify passe en argument de construction les
# variables cochées « Build Variable », et Vite donne la priorité à ce qui est déjà dans l'environnement.
# Rien de secret ici : ces valeurs partent de toute façon dans le navigateur.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_FANGLEAF_ENV=staging

WORKDIR /app

# Les dépendances d'abord : tant que package-lock.json ne bouge pas, Docker réutilise cette couche.
# Installation complète (pas de --omit=dev) : le build a besoin de vite, les migrations de pg.
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

# Le staging tourne comme la prod : triches et raccourcis de dev désactivés.
# VITE_FANGLEAF_ENV reste aussi à l'exécution : le serveur s'en sert pour l'en-tête noindex.
ENV NODE_ENV=production \
    PORT=4311 \
    VITE_FANGLEAF_ENV=$VITE_FANGLEAF_ENV
EXPOSE 4311

# Migrations avant le serveur : une migration cassée arrête le déploiement au lieu d'attendre la prod.
# Elles ne s'appliquent qu'une fois (table _migrations), un redémarrage ne rejoue donc rien.
# exec : tsx devient le processus principal et reçoit le SIGTERM d'arrêt, qui sauvegarde les progressions.
CMD ["sh", "-c", "npm run db:migrate && exec node_modules/.bin/tsx server/index.ts"]
