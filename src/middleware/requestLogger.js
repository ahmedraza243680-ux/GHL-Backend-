import { randomUUID } from 'node:crypto';

export function requestLogger(req, res, next) {
  const requestId = randomUUID();
  req.requestId = requestId;
  const started = performance.now();

  res.on('finish', () => {
    const durationMs = Math.round(performance.now() - started);
    const line = {
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs,
    };
    // Structured log for production log aggregation
    console.info(JSON.stringify(line));
  });

  next();
}
