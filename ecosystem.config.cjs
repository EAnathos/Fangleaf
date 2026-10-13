// Fangleaf · pm2 (prod, derrière nginx). Usage : pm2 start ecosystem.config.cjs
// Une seule instance, en mode fork : les villages vivent en mémoire du process (pas de cluster).
// Le .env est lu par le serveur lui-même depuis cwd (process.loadEnvFile).

module.exports = {
  apps: [
    {
      name: 'fangleaf',
      cwd: __dirname,
      script: 'node_modules/.bin/tsx',
      args: 'server/index.ts',
      interpreter: 'none',
      exec_mode: 'fork',
      instances: 1,
      env: {
        NODE_ENV: 'production',
        PORT: 3010, // 3000 à 3005 déjà pris sur le VPS
      },
      autorestart: true,
      restart_delay: 3000,
      max_memory_restart: '512M',
      kill_timeout: 5000, // laisse le temps de sauvegarder les progressions à l'arrêt
      time: true, // horodatage des logs
    },
  ],
};
