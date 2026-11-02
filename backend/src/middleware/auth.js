const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'rnhs-attendance-secret-2024';

// Middleware: requires a valid teacher JWT
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    if (decoded.accountType !== 'teacher')
      return res.status(403).json({ error: 'Teacher access required' });
    req.teacher = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware: requires admin role
function adminMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    if (decoded.accountType !== 'teacher' || decoded.role !== 'admin')
      return res.status(403).json({ error: 'Admin access required' });
    req.teacher = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware: requires a valid student JWT
function studentAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    if (decoded.accountType !== 'student')
      return res.status(403).json({ error: 'Student access required' });
    req.student = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Middleware: accepts EITHER teacher OR student token
function anyAuthMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided' });

  try {
    const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
    req.authUser = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

module.exports = { authMiddleware, adminMiddleware, studentAuthMiddleware, anyAuthMiddleware, JWT_SECRET };
