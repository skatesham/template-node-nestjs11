import { registerAs } from '@nestjs/config';

export const corsConfig = registerAs('cors', () => ({
  origins: (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',').map((o) => o.trim()),
}));
