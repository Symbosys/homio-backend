import { createServer } from './server.ts';
import { config } from './config/index.ts';

const server = createServer();

async function bootstrap() {
  try {
    const instance = await server.start();
    console.log(`=========================================`);
    console.log(`🚀 Homio CRM Server Running`);
    console.log(`📦 Active Framework : ${instance.framework.toUpperCase()}`);
    console.log(`🌐 URL              : http://localhost:${instance.port}`);
    console.log(`🩺 Health Check     : http://localhost:${instance.port}/health`);
    console.log(`📦 Sample API       : http://localhost:${instance.port}/api/v1/items`);
    console.log(`⚙️  Environment      : ${config.env}`);
    console.log(`=========================================`);
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown handling
async function shutdown(signal: string) {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  try {
    await server.stop();
    console.log('Server successfully closed.');
    process.exit(0);
  } catch (err) {
    console.error('Error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

bootstrap();
