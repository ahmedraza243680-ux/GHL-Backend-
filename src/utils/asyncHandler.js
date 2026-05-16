/**
 * Wraps route handlers so sync and async errors propagate to the global error middleware.
 */
export function asyncHandler(fn) {
  return (req, res, next) => {
    try {
      const out = fn(req, res, next);
      if (out && typeof out.catch === 'function') {
        out.catch(next);
      }
    } catch (e) {
      next(e);
    }
  };
}
