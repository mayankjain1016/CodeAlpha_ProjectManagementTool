/**
 * Central error handler.
 * All ApiErrors and unhandled errors funnel here.
 */

// eslint-disable-next-line no-unused-vars
function errorHandler(err, _req, res, _next) {
  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map((e) => e.message);
    return res.status(400).json({ message: messages.join('. ') });
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const field = Object.keys(err.keyPattern)[0];
    return res.status(409).json({ message: `${field} already exists` });
  }

  // Mongoose cast error (bad ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({ message: 'Invalid ID format' });
  }

  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 ? 'Internal server error' : err.message;

  if (statusCode === 500 && process.env.NODE_ENV === 'development') {
    console.error('[error]', err);
  }

  res.status(statusCode).json({ message });
}

module.exports = errorHandler;

