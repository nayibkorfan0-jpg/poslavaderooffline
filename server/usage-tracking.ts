// Usage tracking system for invoice limits and restrictions

import { storage } from "./storage";
import { type AuthenticatedRequest, type SessionUser } from "./session-types";
import { type Request, type Response, type NextFunction } from "express";

// Usage tracking service
export class UsageTrackingService {
  
  // Check if user can create an invoice
  static async canCreateInvoice(userId: string): Promise<{
    canCreate: boolean;
    reason?: string;
    currentUsage?: number;
    limit?: number;
    daysUntilReset?: number;
    daysUntilExpiration?: number;
  }> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return { 
          canCreate: false, 
          reason: "Usuario no encontrado" 
        };
      }

      // Check if user is active
      if (!user.isActive) {
        return { 
          canCreate: false, 
          reason: "Cuenta inactiva" 
        };
      }

      // Check if user is blocked
      if (user.isBlocked) {
        return { 
          canCreate: false, 
          reason: "Cuenta bloqueada" 
        };
      }

      // Check if account is expired
      if (user.expirationDate) {
        const now = new Date();
        const expirationDate = new Date(user.expirationDate);
        if (expirationDate < now) {
          return { 
            canCreate: false, 
            reason: "Cuenta expirada" 
          };
        }
      }

      // Check if monthly usage needs to be reset
      const now = new Date();
      const usageResetDate = new Date(user.usageResetDate);
      const monthsDiff = (now.getFullYear() - usageResetDate.getFullYear()) * 12 + 
                         (now.getMonth() - usageResetDate.getMonth());

      let currentUsage = user.currentMonthInvoices;
      
      // Reset usage if a month has passed
      if (monthsDiff >= 1) {
        await storage.resetMonthlyUsage(userId);
        currentUsage = 0;
      }

      // Check if user has reached monthly limit
      if (currentUsage >= user.monthlyInvoiceLimit) {
        // Calculate days until reset
        const nextResetDate = new Date(usageResetDate);
        nextResetDate.setMonth(nextResetDate.getMonth() + 1);
        const daysUntilReset = Math.ceil((nextResetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        return { 
          canCreate: false, 
          reason: `Ha alcanzado su límite mensual de ${user.monthlyInvoiceLimit} facturas`,
          currentUsage,
          limit: user.monthlyInvoiceLimit,
          daysUntilReset
        };
      }

      // Calculate days until expiration (if applicable)
      let daysUntilExpiration: number | undefined;
      if (user.expirationDate) {
        const expirationDate = new Date(user.expirationDate);
        daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      return { 
        canCreate: true,
        currentUsage,
        limit: user.monthlyInvoiceLimit,
        daysUntilExpiration
      };

    } catch (error) {
      console.error('Error checking invoice creation permission:', error);
      return { 
        canCreate: false, 
        reason: "Error interno del servidor" 
      };
    }
  }

  // Increment user's invoice count (call after successful invoice creation)
  static async incrementInvoiceCount(userId: string): Promise<{
    success: boolean;
    newCount?: number;
    remaining?: number;
  }> {
    try {
      const updatedUser = await storage.incrementUserInvoiceCount(userId);
      if (!updatedUser) {
        return { success: false };
      }

      return {
        success: true,
        newCount: updatedUser.currentMonthInvoices,
        remaining: updatedUser.monthlyInvoiceLimit - updatedUser.currentMonthInvoices
      };

    } catch (error) {
      console.error('Error incrementing invoice count:', error);
      return { success: false };
    }
  }

  // Decrement user's invoice count (call after invoice deletion)
  static async decrementInvoiceCount(userId: string): Promise<{
    success: boolean;
    newCount?: number;
    remaining?: number;
  }> {
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return { success: false };
      }

      // Don't decrement below 0
      const newCount = Math.max(0, user.currentMonthInvoices - 1);
      
      const updatedUser = await storage.updateUser(userId, {
        currentMonthInvoices: newCount,
        updatedAt: new Date()
      });

      if (!updatedUser) {
        return { success: false };
      }

      return {
        success: true,
        newCount: updatedUser.currentMonthInvoices,
        remaining: updatedUser.monthlyInvoiceLimit - updatedUser.currentMonthInvoices
      };

    } catch (error) {
      console.error('Error decrementing invoice count:', error);
      return { success: false };
    }
  }

  // Get user usage statistics
  static async getUserUsageStats(userId: string): Promise<{
    currentMonthInvoices: number;
    monthlyLimit: number;
    remainingInvoices: number;
    usagePercentage: number;
    daysUntilReset?: number;
    daysUntilExpiration?: number;
    subscriptionType: string;
    accountStatus: string;
  } | null> {
    try {
      const user = await storage.getUser(userId);
      if (!user) return null;

      const now = new Date();
      const usageResetDate = new Date(user.usageResetDate);
      
      // Calculate days until next reset
      const nextResetDate = new Date(usageResetDate);
      nextResetDate.setMonth(nextResetDate.getMonth() + 1);
      const daysUntilReset = Math.ceil((nextResetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Calculate days until expiration
      let daysUntilExpiration: number | undefined;
      if (user.expirationDate) {
        const expirationDate = new Date(user.expirationDate);
        daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Determine account status
      let accountStatus = 'active';
      if (!user.isActive) {
        accountStatus = 'inactive';
      } else if (user.isBlocked) {
        accountStatus = 'blocked';
      } else if (user.expirationDate && new Date(user.expirationDate) < now) {
        accountStatus = 'expired';
      } else if (user.currentMonthInvoices >= user.monthlyInvoiceLimit) {
        accountStatus = 'limit_reached';
      }

      const remainingInvoices = Math.max(0, user.monthlyInvoiceLimit - user.currentMonthInvoices);
      const usagePercentage = (user.currentMonthInvoices / user.monthlyInvoiceLimit) * 100;

      return {
        currentMonthInvoices: user.currentMonthInvoices,
        monthlyLimit: user.monthlyInvoiceLimit,
        remainingInvoices,
        usagePercentage: Math.round(usagePercentage * 100) / 100,
        daysUntilReset,
        daysUntilExpiration,
        subscriptionType: user.subscriptionType,
        accountStatus
      };

    } catch (error) {
      console.error('Error getting user usage stats:', error);
      return null;
    }
  }

  // Get all users with usage warnings (admin only)
  static async getUsersWithWarnings(): Promise<{
    usersNearLimit: any[];
    usersOverLimit: any[];
    expiringSoon: any[];
    expired: any[];
  }> {
    try {
      const users = await storage.getUsers();
      const now = new Date();

      const usersNearLimit: any[] = [];
      const usersOverLimit: any[] = [];
      const expiringSoon: any[] = [];
      const expired: any[] = [];

      for (const user of users) {
        if (!user.isActive) continue;

        // Check usage limits (80% threshold)
        const usagePercentage = (user.currentMonthInvoices / user.monthlyInvoiceLimit) * 100;
        
        if (user.currentMonthInvoices >= user.monthlyInvoiceLimit) {
          usersOverLimit.push({
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            currentUsage: user.currentMonthInvoices,
            limit: user.monthlyInvoiceLimit
          });
        } else if (usagePercentage >= 80) {
          usersNearLimit.push({
            id: user.id,
            username: user.username,
            fullName: user.fullName,
            currentUsage: user.currentMonthInvoices,
            limit: user.monthlyInvoiceLimit,
            usagePercentage: Math.round(usagePercentage)
          });
        }

        // Check expiration dates
        if (user.expirationDate) {
          const expirationDate = new Date(user.expirationDate);
          const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

          if (daysUntilExpiration < 0) {
            expired.push({
              id: user.id,
              username: user.username,
              fullName: user.fullName,
              expirationDate: user.expirationDate,
              daysPastExpiration: Math.abs(daysUntilExpiration)
            });
          } else if (daysUntilExpiration <= 7) {
            expiringSoon.push({
              id: user.id,
              username: user.username,
              fullName: user.fullName,
              expirationDate: user.expirationDate,
              daysUntilExpiration
            });
          }
        }
      }

      return {
        usersNearLimit,
        usersOverLimit,
        expiringSoon,
        expired
      };

    } catch (error) {
      console.error('Error getting users with warnings:', error);
      return {
        usersNearLimit: [],
        usersOverLimit: [],
        expiringSoon: [],
        expired: []
      };
    }
  }
}

// Middleware to enforce usage limits before invoice creation
export function enforceUsageLimit(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const userId = req.session.user?.id;
  
  if (!userId) {
    return res.status(401).json({
      error: "Authentication required",
      details: "Usuario no autenticado"
    });
  }

  UsageTrackingService.canCreateInvoice(userId).then(result => {
    if (!result.canCreate) {
      return res.status(403).json({
        error: "Usage limit exceeded",
        details: result.reason,
        code: "USAGE_LIMIT_EXCEEDED",
        currentUsage: result.currentUsage,
        limit: result.limit,
        daysUntilReset: result.daysUntilReset,
        daysUntilExpiration: result.daysUntilExpiration
      });
    }
    
    // Add usage info to request for use in routes
    (req as any).usageInfo = result;
    next();
  }).catch(error => {
    console.error('Error enforcing usage limit:', error);
    res.status(500).json({
      error: "Internal server error",
      details: "Error verificando límites de uso"
    });
  });
}