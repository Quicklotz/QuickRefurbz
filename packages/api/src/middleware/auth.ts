import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { AuthenticatedRequest, JwtPayload, JwtConfig, ErrorCode } from '../types';
import { sendError } from '../utils/response';

/**
 * Default JWT configuration
 */
const DEFAULT_JWT_CONFIG: JwtConfig = {
  secret: process.env.JWT_SECRET || 'change-this-secret-in-production',
  expiresIn: '24h',
  algorithm: 'HS256',
};

let jwtConfig: JwtConfig = DEFAULT_JWT_CONFIG;

/**
 * Configure JWT settings
 */
export function configureJwt(config: Partial<JwtConfig>): void {
  jwtConfig = { ...DEFAULT_JWT_CONFIG, ...config };
}

/**
 * Generate a JWT token
 */
export function generateToken(payload: Omit<JwtPayload, 'iat' | 'exp'>): string {
  const options: jwt.SignOptions = {
    expiresIn: jwtConfig.expiresIn as jwt.SignOptions['expiresIn'],
    algorithm: jwtConfig.algorithm,
  };

  if (jwtConfig.issuer) {
    options.issuer = jwtConfig.issuer;
  }

  if (jwtConfig.audience) {
    options.audience = jwtConfig.audience;
  }

  return jwt.sign(payload, jwtConfig.secret, options);
}

/**
 * Verify a JWT token
 */
export function verifyToken(token: string): JwtPayload {
  const options: jwt.VerifyOptions = {
    algorithms: [jwtConfig.algorithm || 'HS256'],
  };

  if (jwtConfig.issuer) {
    options.issuer = jwtConfig.issuer;
  }

  if (jwtConfig.audience) {
    options.audience = jwtConfig.audience;
  }

  return jwt.verify(token, jwtConfig.secret, options) as JwtPayload;
}

/**
 * Decode a JWT token without verification (for debugging)
 */
export function decodeToken(token: string): JwtPayload | null {
  return jwt.decode(token) as JwtPayload | null;
}

/**
 * Hash a password
 */
export async function hashPassword(password: string, rounds: number = 12): Promise<string> {
  return bcrypt.hash(password, rounds);
}

/**
 * Compare a password with a hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Extract token from Authorization header
 */
export function extractToken(authHeader: string | undefined): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0]?.toLowerCase() !== 'bearer') {
    return null;
  }

  return parts[1] || null;
}

/**
 * Authentication middleware
 * Requires a valid JWT token in the Authorization header
 */
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const token = extractToken(req.headers.authorization);

  if (!token) {
    sendError(res, ErrorCode.UNAUTHORIZED, 'No authentication token provided');
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      sendError(res, ErrorCode.TOKEN_EXPIRED, 'Authentication token has expired');
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      sendError(res, ErrorCode.TOKEN_INVALID, 'Invalid authentication token');
      return;
    }

    sendError(res, ErrorCode.UNAUTHORIZED, 'Authentication failed');
  }
}

/**
 * Optional authentication middleware
 * Attaches user to request if valid token is present, but doesn't require it
 */
export function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): void {
  const token = extractToken(req.headers.authorization);

  if (token) {
    try {
      const payload = verifyToken(token);
      req.user = payload;
    } catch {
      // Token is invalid, but we don't fail - just proceed without user
    }
  }

  next();
}

/**
 * Create a middleware that requires specific roles
 */
export function requireRoles(...requiredRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, ErrorCode.UNAUTHORIZED, 'Authentication required');
      return;
    }

    const userRoles = req.user.roles || [];
    const hasRole = requiredRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      sendError(
        res,
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        `Required role: ${requiredRoles.join(' or ')}`
      );
      return;
    }

    next();
  };
}

/**
 * Create a middleware that requires specific permissions
 */
export function requirePermissions(...requiredPermissions: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      sendError(res, ErrorCode.UNAUTHORIZED, 'Authentication required');
      return;
    }

    const userPermissions = req.user.permissions || [];
    const hasAllPermissions = requiredPermissions.every((perm) =>
      userPermissions.includes(perm)
    );

    if (!hasAllPermissions) {
      sendError(
        res,
        ErrorCode.INSUFFICIENT_PERMISSIONS,
        `Required permissions: ${requiredPermissions.join(', ')}`
      );
      return;
    }

    next();
  };
}

/**
 * Create a middleware that requires the user to own the resource
 */
export function requireOwnership(
  getResourceOwnerId: (req: AuthenticatedRequest) => string | Promise<string>
) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      sendError(res, ErrorCode.UNAUTHORIZED, 'Authentication required');
      return;
    }

    try {
      const ownerId = await getResourceOwnerId(req);

      if (ownerId !== req.user.userId) {
        // Check if user is an admin (bypass ownership check)
        const isAdmin = req.user.roles?.includes('admin');

        if (!isAdmin) {
          sendError(res, ErrorCode.FORBIDDEN, 'You do not have access to this resource');
          return;
        }
      }

      next();
    } catch {
      sendError(res, ErrorCode.INTERNAL_ERROR, 'Failed to verify resource ownership');
    }
  };
}

/**
 * Refresh token configuration
 */
export interface RefreshTokenConfig {
  secret: string;
  expiresIn: string | number;
}

let refreshTokenConfig: RefreshTokenConfig = {
  secret: process.env.REFRESH_TOKEN_SECRET || 'change-this-refresh-secret',
  expiresIn: '7d',
};

/**
 * Configure refresh token settings
 */
export function configureRefreshToken(config: Partial<RefreshTokenConfig>): void {
  refreshTokenConfig = { ...refreshTokenConfig, ...config };
}

/**
 * Generate a refresh token
 */
export function generateRefreshToken(userId: string): string {
  return jwt.sign(
    { userId, type: 'refresh' },
    refreshTokenConfig.secret,
    { expiresIn: refreshTokenConfig.expiresIn as jwt.SignOptions['expiresIn'] }
  );
}

/**
 * Verify a refresh token
 */
export function verifyRefreshToken(token: string): { userId: string } {
  const payload = jwt.verify(token, refreshTokenConfig.secret) as { userId: string; type: string };

  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }

  return { userId: payload.userId };
}

/**
 * Token pair result
 */
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * Generate both access and refresh tokens
 */
export function generateTokenPair(payload: Omit<JwtPayload, 'iat' | 'exp'>): TokenPair {
  const accessToken = generateToken(payload);
  const refreshToken = generateRefreshToken(payload.userId);

  // Calculate expiration in seconds
  let expiresIn = 86400; // default 24 hours
  if (typeof jwtConfig.expiresIn === 'number') {
    expiresIn = jwtConfig.expiresIn;
  } else if (typeof jwtConfig.expiresIn === 'string') {
    // Parse string format (e.g., '24h', '7d')
    const match = jwtConfig.expiresIn.match(/^(\d+)([smhd])$/);
    if (match && match[1] && match[2]) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
      expiresIn = value * (multipliers[unit] || 1);
    }
  }

  return { accessToken, refreshToken, expiresIn };
}
