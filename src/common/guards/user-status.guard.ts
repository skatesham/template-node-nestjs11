import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { ErrorCode } from '../constants/error-codes';

@Injectable()
export class UserStatusGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    if (!user.isActive) {
      throw new ForbiddenException({
        code: ErrorCode.ACCOUNT_INACTIVE,
        message: 'Account is inactive',
      });
    }

    if (user.blockedAt) {
      throw new ForbiddenException({
        code: ErrorCode.ACCOUNT_BLOCKED,
        message: 'Account is blocked',
      });
    }

    return true;
  }
}
