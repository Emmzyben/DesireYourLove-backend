import jwt from 'jsonwebtoken';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    res.status(401).json({ message: 'Access token required' });
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      res.status(403).json({ message: 'Invalid or expired token' });
      return;
    }

    req.user = user;
    next();
  });
};

export const generateToken = (user) => {
  return jwt.sign(user, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
};
