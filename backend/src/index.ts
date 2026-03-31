import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { prisma } from './lib/prisma';
import { httpLogger } from './lib/logger';
import { errorHandler } from './middleware/error-handler';
import orderRoutes from './routes/order-routes';
import productRoutes from './routes/product-routes';
import integrationRoutes from './routes/integration-routes';

dotenv.config();

const app = express();
const port = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(httpLogger);

// Health check
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', message: 'OMS Backend is running', db: 'connected' });
  } catch {
    res.status(503).json({ status: 'error', message: 'Database unreachable' });
  }
});

// Routes
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/integrations', integrationRoutes);

// Centralized error handler
app.use(errorHandler);

const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  server.close();
  await prisma.$disconnect();
  process.exit(0);
});
