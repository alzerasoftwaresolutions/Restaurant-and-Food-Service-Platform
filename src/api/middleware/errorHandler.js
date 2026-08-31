export function errorHandler(err, req, res, _next) {
  console.error(`[API Error] ${req.method} ${req.originalUrl}:`, err);

  const statusCode = err.statusCode || (err.message.includes('not found') ? 404 : 400);

  return res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal server error occurred',
    timestamp: new Date().toISOString()
  });
}
