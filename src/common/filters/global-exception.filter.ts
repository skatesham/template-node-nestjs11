import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { ErrorCode } from '../constants/error-codes';

interface PrismaClientKnownRequestError {
  code: string;
  meta?: Record<string, unknown>;
  message: string;
}

function isPrismaError(error: unknown): error is PrismaClientKnownRequestError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as PrismaClientKnownRequestError).code === 'string' &&
    (error as PrismaClientKnownRequestError).code.startsWith('P')
  );
}

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const requestId = (request as unknown as Record<string, unknown>).requestId as string || 'unknown';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code: string = ErrorCode.INTERNAL_ERROR;
    let message = 'Internal server error';
    let details: unknown = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exResponse = exception.getResponse();

      if (typeof exResponse === 'object' && exResponse !== null) {
        const obj = exResponse as Record<string, unknown>;
        code = (obj.code as string) || this.httpStatusToErrorCode(status);
        message = (obj.message as string) || exception.message;
        details = obj.details || undefined;
      } else {
        message = exResponse as string;
        code = this.httpStatusToErrorCode(status);
      }
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = ErrorCode.VALIDATION_ERROR;
      message = 'Validation failed';
      details = exception.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      }));
    } else if (isPrismaError(exception)) {
      const prismaResult = this.handlePrismaError(exception);
      status = prismaResult.status;
      code = prismaResult.code;
      message = prismaResult.message;
      details = prismaResult.details;
    } else {
      this.logger.error('Unhandled exception', exception);
    }

    response.status(status).send({
      code,
      message,
      details,
      requestId,
    });
  }

  private handlePrismaError(error: PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        return {
          status: HttpStatus.CONFLICT,
          code: ErrorCode.CONFLICT,
          message: 'Resource already exists',
          details: { fields: error.meta?.target },
        };
      case 'P2025':
        return {
          status: HttpStatus.NOT_FOUND,
          code: ErrorCode.NOT_FOUND,
          message: 'Resource not found',
          details: error.meta?.cause || error.meta?.modelName
            ? { cause: error.meta?.cause, model: error.meta?.modelName }
            : undefined,
        };
      case 'P2003':
        return {
          status: HttpStatus.BAD_REQUEST,
          code: ErrorCode.BAD_REQUEST,
          message: 'Invalid reference',
          details: { field: error.meta?.field_name },
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: ErrorCode.INTERNAL_ERROR,
          message: 'Database error',
          details: undefined,
        };
    }
  }

  private httpStatusToErrorCode(status: number): string {
    switch (status) {
      case 400:
        return ErrorCode.BAD_REQUEST;
      case 401:
        return ErrorCode.INVALID_CREDENTIALS;
      case 403:
        return ErrorCode.FORBIDDEN;
      case 404:
        return ErrorCode.NOT_FOUND;
      case 409:
        return ErrorCode.CONFLICT;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }
}
