import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';

function isAppError(err) {
  return err instanceof AppError;
}

function formatAxiosError(err) {
  const status = err.response?.status;
  const data = err.response?.data;
  return { status, data };
}

export function notFoundHandler(req, res, next) {
  next(
    new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404, {
      code: 'NOT_FOUND',
    }),
  );
}

// Express requires 4 args for error handlers; `next` is unused.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err?.name === 'PrismaClientKnownRequestError') {
    const code = err.code;
    if (code === 'P2002') {
      return res.status(409).json({
        success: false,
        error: { code: 'CONFLICT', message: 'A record with this unique field already exists.' },
        requestId: req.requestId,
      });
    }
    if (code === 'P2025') {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Related record not found.' },
        requestId: req.requestId,
      });
    }
  }

  if (err?.name === 'PrismaClientValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data for database operation.',
      },
      requestId: req.requestId,
    });
  }

  if (err?.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE' ? 'File too large (max 10MB).' : err.message;
    return res.status(400).json({
      success: false,
      error: { code: 'UPLOAD_ERROR', message },
      requestId: req.requestId,
    });
  }

  if (err?.isAxiosError) {
    const { status, data } = formatAxiosError(err);
    return res.status(502).json({
      success: false,
      error: {
        code: 'UPSTREAM_ERROR',
        message: 'External request failed.',
        details: { status, data },
      },
      requestId: req.requestId,
    });
  }

  const statusCode = isAppError(err) ? err.statusCode : 500;
  const code = isAppError(err) ? (err.code ?? 'ERROR') : 'INTERNAL_ERROR';
  const message = isAppError(err)
    ? err.message
    : env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message;

  if (statusCode >= 500) {
    console.error(err);
  }

  const body = {
    success: false,
    error: {
      code,
      message,
      ...(isAppError(err) && err.details ? { details: err.details } : {}),
    },
    requestId: req.requestId,
  };

  if (env.NODE_ENV !== 'production' && !isAppError(err) && err?.stack) {
    body.error.stack = err.stack;
  }

  return res.status(statusCode).json(body);
}
