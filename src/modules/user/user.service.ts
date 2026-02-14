import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ErrorCode } from '../../common/constants/error-codes';
import {
  buildCursorQuery,
  buildCursorResult,
  CursorPaginationParams,
  buildOffsetQuery,
  buildOffsetResult,
  OffsetPaginationParams,
} from '../../common/utils/pagination.util';
import { UpdateUserDto } from './schemas/user.schema';

const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  isActive: true,
  isVerified: true,
  blockedAt: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
  roles: {
    include: {
      role: {
        include: {
          permissions: {
            include: { permission: true },
          },
        },
      },
    },
  },
};

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllCursor(params: CursorPaginationParams) {
    const query = buildCursorQuery(params);
    const users = await this.prisma.user.findMany({
      ...query,
      select: USER_SELECT,
      orderBy: { createdAt: 'desc' },
    });

    return buildCursorResult(users, params.take);
  }

  async findAllOffset(params: OffsetPaginationParams) {
    const query = buildOffsetQuery(params);
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        ...query,
        select: USER_SELECT,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ]);

    return buildOffsetResult(users, total, params);
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });

    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.NOT_FOUND,
        message: 'User not found',
      });
    }

    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    await this.findById(id);

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: USER_SELECT,
    });
  }

  async softDelete(id: string) {
    await this.findById(id);

    return this.prisma.user.update({
      where: { id },
      data: { blockedAt: new Date(), isActive: false },
      select: USER_SELECT,
    });
  }
}
