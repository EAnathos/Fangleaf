// Fangleaf · pm2 (prod ou staging, derrière nginx). Usage : pm2 start ecosystem.config.cjs
// Une seule instance, en mode fork : les villages vivent en mémoire du process (pas de cluster).
// Le .env est lu par le serveur lui-même depuis cwd (process.loadEnvFile).
//
// L'environnement vient du .env du clone (VITE_FANGLEAF_ENV=staging) et non de la ligne de commande :
// un clone de staging ne peut ainsi jamais démarrer l'app de prod, ni prendre son port, même lancé à la main.

const fs = require('node:fs');
const path = require('node:path');

const envFile = path.join(__dirname, '.env');
const declared = fs.existsSync(envFile) && /^\s*VITE_FANGLEAF_ENV\s*=\s*["']?(\w+)/m.exec(fs.readFileSync(envFile, 'utf8'));
const staging = !!declared && declared[1] === 'staging';

module.exports = {
  apps: [
    {
      name: staging ? 'fangleaf-staging' : 'fangleaf',
      cwd: __dirname,
      script: 'node_modules/.bin/tsx',
      args: 'server/index.ts',
      interpreter: 'none',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production', // le staging tourne comme la prod : triches et raccourcis de dev désactivés
        PORT: staging ? 4311 : 4310, // 3000 à 3010 déjà pris sur le VPS (portfolio, Ant ID Training…)
      },
      autorestart: true,
      restart_delay: 3000,
      max_memory_restart: '512M',
      kill_timeout: 5000, // laisse le temps de sauvegarder les progressions à l'arrêt
      time: true, // horodatage des logs
    },
  ],
};
