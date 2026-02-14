import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { ZodBodyPipe } from './zod-body.pipe';

describe('ZodBodyPipe', () => {
  const schema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
  });

  const pipe = new ZodBodyPipe(schema);

  it('should return parsed data when input is valid', () => {
    const input = { email: 'test@example.com', password: '12345678' };
    const result = pipe.transform(input);
    expect(result).toEqual(input);
  });

  it('should throw BadRequestException when input is invalid', () => {
    const input = { email: 'not-an-email', password: '123' };
    expect(() => pipe.transform(input)).toThrow(BadRequestException);
  });

  it('should include field-level error details', () => {
    const input = { email: 'bad', password: '' };
    try {
      pipe.transform(input);
      fail('Expected BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('VALIDATION_ERROR');
      expect(response.message).toBe('Body validation failed');
      expect(Array.isArray(response.details)).toBe(true);
    }
  });
});
