import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

const server = app.listen(env.port, '0.0.0.0', () => {
  console.info(
    `[ValenceStudio] Serveur Express actif sur http://0.0.0.0:${env.port} (env=${env.nodeEnv})`
  );
  console.info(
    `[ValenceStudio] Keepalive endpoint prêt : GET ${env.backendPublicUrl}/health`
  );
});

process.on('SIGTERM', () => {
  server.close(() => {
    process.exit(0);
  });
});
