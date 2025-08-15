/**
 * Timeout middleware to prevent hanging requests
 * @param {number} timeout - Timeout in milliseconds (default: 30000)
 */
const timeout = (timeout = 30000) => {
  return (req, res, next) => {
    const timer = setTimeout(() => {
      if (!res.headersSent) {
        res.status(408).json({
          success: false,
          message: 'Request timeout',
          timestamp: new Date().toISOString()
        });
      }
    }, timeout);

    // Clear timeout when response is sent
    res.on('finish', () => clearTimeout(timer));
    res.on('close', () => clearTimeout(timer));

    next();
  };
};

module.exports = timeout;
