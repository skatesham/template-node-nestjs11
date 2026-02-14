import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { ErrorCode } from '../constants/error-codes';

interface UserRoleWithPermissions {
  role: {
    permissions: Array<{ permission: { name: string } }>;
  };
}

@Injectable()
export class OwnerOrPermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const paramId = request.params?.id;

    if (!user) {
      throw new ForbiddenException({
        code: ErrorCode.FORBIDDEN,
        message: 'Access denied',
      });
    }

    if (paramId && paramId === user.id) {
      return true;
    }

    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const userPermissions: string[] = (user.roles || []).flatMap((r: UserRoleWithPermissions) =>
      r.role.permissions.map((p) => p.permission.name),
    );

    const hasPermission = requiredPermissions.every((perm) => userPermissions.includes(perm));

    if (!hasPermission) {
      throw new ForbiddenException({
        code: ErrorCode.INSUFFICIENT_PERMISSIONS,
        message: 'You do not own this resource and lack the required permissions',
      });
    }

    return true;
  }
}
