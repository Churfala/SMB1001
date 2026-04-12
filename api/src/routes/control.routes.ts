import { FastifyInstance } from 'fastify';
import { controlController } from '../controllers/control.controller';
import { authenticate } from '../middleware/authenticate';

export async function controlRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get('/', controlController.list);
  app.get('/:id', controlController.getOne);
}
