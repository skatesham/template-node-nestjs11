import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ErrorCode } from '../constants/error-codes';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<T>(err: Error | null, user: T, info: Error | undefined): T {
    if (err || !user) {
      const message = info?.message === 'jwt expired' ? 'Token expired' : 'Invalid token';
      const code = info?.message === 'jwt expired' ? ErrorCode.TOKEN_EXPIRED : ErrorCode.TOKEN_INVALID;

      throw new UnauthorizedException({ code, message });
    }

    return user;
  }
}
