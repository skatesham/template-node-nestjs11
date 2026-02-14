import { registerAs } from '@nestjs/config';

export const cryptoConfig = registerAs('crypto', () => ({
  key: process.env.CRYPTO_KEY,
  ivLength: parseInt(process.env.CRYPTO_IV_LENGTH || '16', 10),
  enabled: !!process.env.CRYPTO_KEY,
}));
