import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { requestLogger } from './middleware/requestLogger.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import healthRoutes from './routes/health.routes.js';
import authRoutes from './routes/auth.routes.js';
import locationsRoutes from './routes/locations.routes.js';
import testRoutes from './routes/test.routes.js';
import setupRoutes from './routes/setup.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  app.use('/health', healthRoutes);
  app.use('/auth', authRoutes);
  app.use('/locations', locationsRoutes);

  if (env.NODE_ENV === 'development') {
    app.use('/test', testRoutes);
  }

  app.use('/setup', setupRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
