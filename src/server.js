import { createApp } from './app.js';
import { env, validateServerEnv } from './config/env.js';
import prisma from './database/client.js';
import { startScheduledJobs } from './jobs/index.js';

validateServerEnv();
await prisma.$connect();

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.info(
    JSON.stringify({
      event: 'server_listen',
      port: env.PORT,
      environment: env.NODE_ENV,
    }),
  );
  startScheduledJobs();
});

async function shutdown(signal) {
  console.info(JSON.stringify({ event: 'shutdown', signal }));
  try {
    await prisma.$disconnect();
  } catch (e) {
    console.error(e);
  }
  server.close(() => {
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
