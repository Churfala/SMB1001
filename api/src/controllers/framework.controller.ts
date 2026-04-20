import { FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../config/database';

export const frameworkController = {
  async list(_request: FastifyRequest, reply: FastifyReply) {
    const frameworks = await query<{
      id: string;
      code: string;
      name: string;
      version: string | null;
      description: string | null;
      tier_config: object[];
      domain_label: string;
      is_active: boolean;
    }>('SELECT id, code, name, version, description, tier_config, domain_label, is_active FROM frameworks WHERE is_active = true ORDER BY name');

    return reply.send({ frameworks });
  },
};
