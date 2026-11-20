
const jwt = require('jsonwebtoken');

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Please log in to continue.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.sub
    };

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Your session is invalid or expired. Please log in again.'
    });
  }
}

module.exports = authenticateToken;
