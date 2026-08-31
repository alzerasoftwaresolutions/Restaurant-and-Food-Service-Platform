import { identityService } from '../../platform/identity/identityService.js';

export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  let token = null;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.rfsp_token) {
    token = req.cookies.rfsp_token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please provide a valid token.'
    });
  }

  try {
    const decoded = await identityService.verifyToken(token);
    req.user = {
      id: decoded.userId || decoded.sub,
      userId: decoded.userId || decoded.sub,
      username: decoded.username,
      email: decoded.email,
      roles: decoded.roles || []
    };
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      error: err.message || 'Invalid or expired authentication token'
    });
  }
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const hasRole = req.user.roles.some(role => allowedRoles.includes(role));
    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: `Access denied. Requires one of roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
}
