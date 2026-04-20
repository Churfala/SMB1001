import { FastifyInstance } from 'fastify';
import { frameworkController } from '../controllers/framework.controller';

export async function frameworkRoutes(app: FastifyInstance): Promise<void> {
  // No auth required — public reference data
  app.get('/', frameworkController.list);
}
