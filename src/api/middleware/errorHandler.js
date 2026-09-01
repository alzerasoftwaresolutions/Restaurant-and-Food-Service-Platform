export function errorHandler(err, req, res, _next) {
  console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err.message);

  let statusCode = err.statusCode || 400;

  if (err.message) {
    const msg = err.message.toLowerCase();
    if (msg.includes('invalid credentials') || msg.includes('authorization header') || msg.includes('token') || msg.includes('authentication required')) {
      statusCode = 401;
    } else if (msg.includes('forbidden') || msg.includes('insufficient permissions')) {
      statusCode = 403;
    } else if (msg.includes('not found')) {
      statusCode = 404;
    }
  }

  return res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error occurred',
    timestamp: new Date().toISOString()
  });
}
