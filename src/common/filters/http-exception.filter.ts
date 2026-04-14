import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type ExceptionResponsePayload = {
  message?: string | string[];
};

const hasMessagePayload = (value: unknown): value is ExceptionResponsePayload =>
  typeof value === 'object' && value !== null && 'message' in value;

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse: unknown =
      exception instanceof HttpException ? exception.getResponse() : null;

    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : hasMessagePayload(exceptionResponse)
          ? Array.isArray(exceptionResponse.message)
            ? exceptionResponse.message[0]
            : String(exceptionResponse.message)
          : status === 500
            ? '服务异常，请稍后重试'
            : '请求失败';

    const errorResponse = {
      code: status,
      message,
      data: null,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    response.status(status).json(errorResponse);
  }
}
