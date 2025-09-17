// Authentication middleware for user management system

import { type Request, type Response, type NextFunction } from "express";
import { storage } from "./storage";
import { PasswordUtils } from "./password-utils";
import { 
  type AuthenticatedRequest, 
  type SessionUser, 
  createSessionUser,
  isAuthenticated,
  hasRole,
  hasAnyRole,
  canCreateInvoices 
} from "./session-types";

// Authentication middleware functions
export class AuthMiddleware {
  // Require authentication for protected routes
  static requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!isAuthenticated(req)) {
      res.status(401).json({
        error: "Authentication required",
        details: "Debe iniciar sesión para acceder a este recurso"
      });
      return;
    }

    // Check if account is expired
    const user = req.session.user!;
    if (user.expirationDate && user.expirationDate < new Date()) {
      res.status(403).json({
        error: "Account expired",
        details: "Su cuenta ha expirado. Contacte al administrador"
      });
      return;
    }

    // Check if account is blocked
    if (user.isBlocked) {
      res.status(403).json({
        error: "Account blocked",
        details: "Su cuenta está bloqueada. Contacte al administrador"
      });
      return;
    }

    // Check if account is active
    if (!user.isActive) {
      res.status(403).json({
        error: "Account inactive",
        details: "Su cuenta está inactiva. Contacte al administrador"
      });
      return;
    }

    next();
  };

  // Require admin role
  static requireAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!hasRole(req, 'admin')) {
      res.status(403).json({
        error: "Admin access required",
        details: "Necesita permisos de administrador para acceder a este recurso"
      });
      return;
    }
    next();
  };

  // Require admin or user role (exclude readonly)
  static requireUserOrAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!hasAnyRole(req, ['admin', 'user'])) {
      res.status(403).json({
        error: "Insufficient permissions",
        details: "No tiene permisos suficientes para realizar esta acción"
      });
      return;
    }
    next();
  };

  // Check invoice creation limits
  static checkInvoiceLimit = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!canCreateInvoices(req)) {
      const user = req.session.user!;
      
      let message = "No puede crear facturas";
      let details = "";

      if (user.currentMonthInvoices >= user.monthlyInvoiceLimit) {
        details = `Ha alcanzado su límite mensual de ${user.monthlyInvoiceLimit} facturas`;
      } else if (user.expirationDate && user.expirationDate < new Date()) {
        details = "Su cuenta ha expirado";
      } else if (user.isBlocked) {
        details = "Su cuenta está bloqueada";
      } else if (!user.isActive) {
        details = "Su cuenta está inactiva";
      }

      res.status(403).json({
        error: message,
        details,
        code: "INVOICE_LIMIT_REACHED",
        currentUsage: user.currentMonthInvoices,
        monthlyLimit: user.monthlyInvoiceLimit
      });
      return;
    }
    next();
  };

  // Optional authentication - adds user to request if authenticated but doesn't require it
  static optionalAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Just add user info if available, don't block request
    next();
  };
}

// Authentication service class
export class AuthService {
  // Login user
  static async loginUser(username: string, password: string, req: AuthenticatedRequest): Promise<{ 
    success: boolean; 
    user?: SessionUser; 
    error?: string; 
    needsPasswordChange?: boolean;
  }> {
    try {
      // Find user by username
      const user = await storage.getUserByUsername(username);
      if (!user) {
        // Track failed login attempt
        if (req.session.loginAttempts) {
          req.session.loginAttempts++;
        } else {
          req.session.loginAttempts = 1;
        }
        req.session.lastLoginAttempt = new Date();

        return { 
          success: false, 
          error: "Usuario o contraseña incorrectos" 
        };
      }

      // Check if user is active
      if (!user.isActive) {
        return { 
          success: false, 
          error: "Cuenta inactiva. Contacte al administrador" 
        };
      }

      // Check if user is blocked
      if (user.isBlocked) {
        return { 
          success: false, 
          error: "Cuenta bloqueada. Contacte al administrador" 
        };
      }

      // Check if account is expired
      if (user.expirationDate && new Date(user.expirationDate) < new Date()) {
        return { 
          success: false, 
          error: "Cuenta expirada. Contacte al administrador" 
        };
      }

      // Verify password
      const isValidPassword = await PasswordUtils.comparePassword(password, user.password);
      if (!isValidPassword) {
        // Update failed login attempts
        await storage.updateUser(user.id, {
          failedLoginAttempts: user.failedLoginAttempts + 1,
          lastFailedLogin: new Date()
        });

        // Track session-level failed attempts
        if (req.session.loginAttempts) {
          req.session.loginAttempts++;
        } else {
          req.session.loginAttempts = 1;
        }
        req.session.lastLoginAttempt = new Date();

        return { 
          success: false, 
          error: "Usuario o contraseña incorrectos" 
        };
      }

      // Check if user needs to reset usage counter (monthly)
      const now = new Date();
      const usageResetDate = new Date(user.usageResetDate);
      const monthsDiff = (now.getFullYear() - usageResetDate.getFullYear()) * 12 + 
                         (now.getMonth() - usageResetDate.getMonth());

      let updatedUser = user;
      if (monthsDiff >= 1) {
        // Reset monthly usage
        updatedUser = await storage.updateUser(user.id, {
          currentMonthInvoices: 0,
          usageResetDate: now
        }) || user;
      }

      // Update successful login
      updatedUser = await storage.updateUser(updatedUser.id, {
        lastLogin: now,
        failedLoginAttempts: 0
      }) || updatedUser;

      // Create session user
      const sessionUser = createSessionUser(updatedUser);
      
      // Store user in session
      req.session.user = sessionUser;
      
      // Clear failed login attempts from session
      delete req.session.loginAttempts;
      delete req.session.lastLoginAttempt;

      return { 
        success: true, 
        user: sessionUser
      };

    } catch (error) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: "Error interno del servidor" 
      };
    }
  }

  // Logout user
  static async logoutUser(req: AuthenticatedRequest): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          console.error('Logout error:', err);
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Get current user from session
  static getCurrentUser(req: AuthenticatedRequest): SessionUser | null {
    return req.session.user || null;
  }

  // Update session user data
  static updateSessionUser(req: AuthenticatedRequest, userData: Partial<SessionUser>): void {
    if (req.session.user) {
      req.session.user = { ...req.session.user, ...userData };
    }
  }
}