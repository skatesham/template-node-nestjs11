import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
});

export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export const userIdParamSchema = z.object({
  id: z.string().min(1),
});

export type UserIdParamDto = z.infer<typeof userIdParamSchema>;
