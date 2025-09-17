import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  insertCompanyConfigSchema, 
  insertDnitConfigSchema,
  insertCategorySchema,
  insertServiceSchema, 
  insertServiceComboSchema, 
  insertServiceComboItemSchema,
  insertSaleSchema,
  insertSaleItemSchema,
  insertUserSchema,
  updateUserSchema,
  loginSchema,
  changePasswordSchema,
  saleWithItemsSchema,
  frontendSaleItemSchema,
  insertWorkOrderSchema,
  insertWorkOrderItemSchema,
  insertVehicleSchema,
  type SafeDnitConfig,
  type User,
  type PublicUser
} from "@shared/schema";
import { validateRUC, validateTimbradoDates, validateActiveTimbrado } from "./utils/paraguayan-validators";
import type { Request, Response, NextFunction } from "express";
import { 
  AuthMiddleware, 
  AuthService
} from "./auth-middleware";
import { PasswordUtils } from "./password-utils";
import { type AuthenticatedRequest, type SessionUser } from "./session-types";
import { 
  UsageTrackingService, 
  enforceUsageLimit 
} from "./usage-tracking";
import { EncryptionService } from "./encryption";

/**
 * SECURITY: Convert User to PublicUser, excluding sensitive fields
 * CRITICAL: This ensures passwords and internal auth data never reach the frontend
 */
function toPublicUser(user: User): PublicUser {
  const { 
    password, 
    failedLoginAttempts, 
    lastFailedLogin, 
    ...publicUser 
  } = user;
  return publicUser;
}

/**
 * SECURITY: Convert SessionUser to PublicUser format
 * Used when we have a SessionUser from AuthService and need to return it to frontend
 */
function sessionUserToPublicUser(sessionUser: SessionUser): PublicUser {
  return {
    id: sessionUser.id,
    username: sessionUser.username,
    fullName: sessionUser.fullName || null,
    email: sessionUser.email || null,
    role: sessionUser.role as "admin" | "user" | "readonly",
    subscriptionType: sessionUser.subscriptionType as "free" | "basic" | "premium" | "enterprise",
    monthlyInvoiceLimit: sessionUser.monthlyInvoiceLimit,
    currentMonthInvoices: sessionUser.currentMonthInvoices,
    isActive: sessionUser.isActive,
    isBlocked: sessionUser.isBlocked,
    expirationDate: sessionUser.expirationDate ? sessionUser.expirationDate : null,
    usageResetDate: new Date(), // Default value since SessionUser doesn't have this
    lastLogin: null, // SessionUser doesn't have this
    createdAt: new Date(), // Default value since SessionUser doesn't have this
    updatedAt: new Date(), // Default value since SessionUser doesn't have this
    createdBy: null // SessionUser doesn't have this
  };
}

/**
 * Middleware to validate active timbrado for billing operations
 * Blocks requests if timbrado is expired or not configured
 */
async function requireActiveTimbrado(req: Request, res: Response, next: NextFunction) {
  try {
    const config = await storage.getCompanyConfig();
    const validation = validateActiveTimbrado(config ?? null);

    if (!validation.isValid) {
      return res.status(403).json({
        error: "Operación de facturación bloqueada",
        details: validation.error,
        code: "TIMBRADO_INVALID",
        daysLeft: validation.daysLeft
      });
    }

    // Add config to request for use in routes
    (req as any).companyConfig = config;
    (req as any).timbradoStatus = validation;
    next();
  } catch (error) {
    console.error("Error validating timbrado:", error);
    res.status(500).json({
      error: "Error validating timbrado",
      details: "No se pudo verificar el estado del timbrado"
    });
  }
}

/**
 * Middleware to validate sale edit/delete operations
 * Ensures only admins can edit/delete and within 24-hour window
 */
async function validateSaleModification(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const saleId = req.params.id;
    if (!saleId) {
      return res.status(400).json({
        error: "Sale ID required",
        details: "ID de venta requerido"
      });
    }

    // Get the sale to validate
    const sale = await storage.getSale(saleId);
    if (!sale) {
      return res.status(404).json({
        error: "Sale not found",
        details: "Venta no encontrada"
      });
    }

    // Check 24-hour rule for fiscal compliance
    const now = new Date();
    const saleDate = new Date(sale.createdAt);
    const hoursDifference = (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursDifference > 24) {
      return res.status(403).json({
        error: "Modification window expired",
        details: "No se pueden modificar facturas después de 24 horas (cumplimiento fiscal)",
        code: "FISCAL_COMPLIANCE_VIOLATION",
        hoursElapsed: Math.round(hoursDifference),
        maxHours: 24
      });
    }

    // Add sale to request for use in routes
    (req as any).existingSale = sale;
    (req as any).hoursElapsed = hoursDifference;
    next();
  } catch (error) {
    console.error("Error validating sale modification:", error);
    res.status(500).json({
      error: "Error validating modification",
      details: "Error validando la modificación"
    });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Authentication Routes
  app.post("/api/auth/login", async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = loginSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      const { username, password } = validation.data;
      const loginResult = await AuthService.loginUser(username, password, req);

      if (!loginResult.success) {
        return res.status(401).json({
          error: loginResult.error
        });
      }

      res.json({
        message: "Login successful",
        user: sessionUserToPublicUser(loginResult.user!)
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/auth/logout", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      await AuthService.logoutUser(req);
      res.json({ message: "Logout successful" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ error: "Failed to logout" });
    }
  });

  app.get("/api/auth/me", AuthMiddleware.requireAuth, (req: AuthenticatedRequest, res: Response) => {
    const user = AuthService.getCurrentUser(req);
    res.json({
      user: sessionUserToPublicUser(user!)
    });
  });

  // User Management Routes (Admin only)
  app.get("/api/users", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const users = await storage.getUsers();
      res.json(users.map(user => toPublicUser(user)));
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.get("/api/users/:id", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(toPublicUser(user));
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  app.post("/api/users", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = insertUserSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      const userData = validation.data;
      
      // Set created by current user
      userData.createdBy = req.session.user!.id;
      
      // Check for duplicate username
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({
          error: "Username already exists",
          details: "Este nombre de usuario ya está en uso"
        });
      }

      // Check for duplicate email if provided
      if (userData.email) {
        const existingEmail = await storage.getUserByEmail(userData.email);
        if (existingEmail) {
          return res.status(400).json({
            error: "Email already exists",
            details: "Este email ya está en uso"
          });
        }
      }

      const user = await storage.createUser(userData);
      
      res.json({
        message: "User created successfully",
        user: toPublicUser(user)
      });
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).json({ error: "Failed to create user" });
    }
  });

  app.put("/api/users/:id", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = updateUserSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      const updates = validation.data;
      
      // Check for duplicate email if being updated
      if (updates.email) {
        const existingUser = await storage.getUserByEmail(updates.email);
        if (existingUser && existingUser.id !== req.params.id) {
          return res.status(400).json({
            error: "Email already exists",
            details: "Este email ya está en uso por otro usuario"
          });
        }
      }

      const user = await storage.updateUser(req.params.id, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Update session if updating current user
      if (user.id === req.session.user!.id) {
        AuthService.updateSessionUser(req, {
          fullName: user.fullName || undefined,
          email: user.email || undefined,
          role: user.role,
          subscriptionType: user.subscriptionType,
          monthlyInvoiceLimit: user.monthlyInvoiceLimit,
          currentMonthInvoices: user.currentMonthInvoices,
          isActive: user.isActive,
          isBlocked: user.isBlocked,
          expirationDate: user.expirationDate || undefined
        });
      }

      res.json({
        message: "User updated successfully",
        user: toPublicUser(user)
      });
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  app.post("/api/users/:id/change-password", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = changePasswordSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      const { currentPassword, newPassword } = validation.data;
      const targetUserId = req.params.id;
      const currentUserId = req.session.user!.id;

      // Users can only change their own password unless they're admin
      if (targetUserId !== currentUserId && req.session.user!.role !== 'admin') {
        return res.status(403).json({
          error: "Insufficient permissions",
          details: "Solo puede cambiar su propia contraseña"
        });
      }

      const user = await storage.getUser(targetUserId);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }

      // Verify current password (skip for admin changing other user's password)
      if (targetUserId === currentUserId) {
        const isValidPassword = await PasswordUtils.comparePassword(currentPassword, user.password);
        if (!isValidPassword) {
          return res.status(400).json({
            error: "Invalid current password",
            details: "La contraseña actual es incorrecta"
          });
        }
      }

      // Update password using internal update method (storage layer will handle hashing)
      // Use direct type assertion since we know password updates are allowed internally
      await storage.updateUser(targetUserId, { password: newPassword } as any);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      res.status(500).json({ error: "Failed to change password" });
    }
  });

  // Usage Tracking Routes
  app.get("/api/usage/stats", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.session.user!.id;
      const stats = await UsageTrackingService.getUserUsageStats(userId);
      
      if (!stats) {
        return res.status(404).json({ error: "User not found" });
      }

      res.json(stats);
    } catch (error) {
      console.error("Error fetching usage stats:", error);
      res.status(500).json({ error: "Failed to fetch usage statistics" });
    }
  });

  app.get("/api/usage/can-create-invoice", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.session.user!.id;
      const canCreate = await UsageTrackingService.canCreateInvoice(userId);
      res.json(canCreate);
    } catch (error) {
      console.error("Error checking invoice permission:", error);
      res.status(500).json({ error: "Failed to check invoice permission" });
    }
  });

  app.get("/api/usage/warnings", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const warnings = await UsageTrackingService.getUsersWithWarnings();
      res.json(warnings);
    } catch (error) {
      console.error("Error fetching usage warnings:", error);
      res.status(500).json({ error: "Failed to fetch usage warnings" });
    }
  });

  app.post("/api/usage/increment/:userId", AuthMiddleware.requireAuth, AuthMiddleware.requireUserOrAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const targetUserId = req.params.userId;
      const currentUserId = req.session.user!.id;

      // Users can only increment their own usage unless they're admin
      if (targetUserId !== currentUserId && req.session.user!.role !== 'admin') {
        return res.status(403).json({
          error: "Insufficient permissions",
          details: "Solo puede gestionar su propio uso"
        });
      }

      const result = await UsageTrackingService.incrementInvoiceCount(targetUserId);
      
      if (!result.success) {
        return res.status(500).json({ error: "Failed to increment invoice count" });
      }

      // Update session if incrementing current user's count
      if (targetUserId === currentUserId) {
        if (req.session.user) {
          req.session.user.currentMonthInvoices = result.newCount!;
        }
      }

      res.json({
        message: "Invoice count incremented successfully",
        newCount: result.newCount,
        remaining: result.remaining
      });
    } catch (error) {
      console.error("Error incrementing invoice count:", error);
      res.status(500).json({ error: "Failed to increment invoice count" });
    }
  });

  // Company Configuration Routes
  app.get("/api/company-config", AuthMiddleware.requireAuth, async (req, res) => {
    try {
      const config = await storage.getCompanyConfig();
      res.json(config || null);
    } catch (error) {
      console.error("Error fetching company config:", error);
      res.status(500).json({ error: "Failed to fetch company configuration" });
    }
  });

  app.put("/api/company-config", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req, res) => {
    try {
      // Validate request body
      const validation = insertCompanyConfigSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      const data = validation.data;

      // Basic RUC validation - allow free format as requested by user
      if (!data.ruc || data.ruc.trim().length === 0) {
        return res.status(400).json({
          error: "RUC requerido",
          details: "Debe ingresar un número de RUC"
        });
      }

      // Validate timbrado dates
      const timbradoValidation = validateTimbradoDates(data.timbradoDesde, data.timbradoHasta);
      if (!timbradoValidation.isValid) {
        return res.status(400).json({
          error: "Fechas de timbrado inválidas",
          details: timbradoValidation.error
        });
      }

      // Check if configuration exists
      const existingConfig = await storage.getCompanyConfig();
      
      let result;
      if (existingConfig) {
        result = await storage.updateCompanyConfig(existingConfig.id, data);
      } else {
        result = await storage.createCompanyConfig(data);
      }

      if (!result) {
        return res.status(500).json({ error: "Failed to save company configuration" });
      }

      res.json(result);
    } catch (error) {
      console.error("Error saving company config:", error);
      res.status(500).json({ error: "Failed to save company configuration" });
    }
  });

  // Timbrado validation status endpoint
  app.get("/api/timbrado/status", AuthMiddleware.requireAuth, async (req, res) => {
    try {
      const config = await storage.getCompanyConfig();
      const validation = validateActiveTimbrado(config ?? null);
      
      res.json({
        isValid: validation.isValid,
        blocksInvoicing: validation.blocksInvoicing,
        daysLeft: validation.daysLeft,
        error: validation.error
      });
    } catch (error) {
      console.error("Error checking timbrado status:", error);
      res.status(500).json({ error: "Failed to check timbrado status" });
    }
  });

  // DNIT Configuration Routes
  app.get("/api/dnit-config", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req, res) => {
    try {
      const config = await storage.getDnitConfig();
      
      if (config) {
        // Create safe config response without exposing sensitive data
        const { authToken, certificatePassword, ...safeConfig } = config;
        const safeResponse: SafeDnitConfig = {
          ...safeConfig,
          hasAuthToken: !!authToken && authToken.trim() !== '',
          hasCertificatePassword: !!certificatePassword && certificatePassword.trim() !== ''
        };
        res.json(safeResponse);
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("Error fetching DNIT config:", error);
      res.status(500).json({ error: "Failed to fetch DNIT configuration" });
    }
  });

  app.put("/api/dnit-config", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req, res) => {
    try {
      // Handle placeholder values for sensitive fields
      const processedBody = { ...req.body };
      
      // Replace placeholders with existing values if they exist
      const existingConfig = await storage.getDnitConfig();
      if (existingConfig) {
        // If authToken is a placeholder, keep existing encrypted value
        if (processedBody.authToken && EncryptionService.isPlaceholder(processedBody.authToken)) {
          processedBody.authToken = existingConfig.authToken; // Already decrypted from storage
        }
        
        // If certificatePassword is a placeholder, keep existing encrypted value
        if (processedBody.certificatePassword && EncryptionService.isPlaceholder(processedBody.certificatePassword)) {
          processedBody.certificatePassword = existingConfig.certificatePassword; // Already decrypted from storage
        }
      }

      // Validate processed request body
      const validation = insertDnitConfigSchema.safeParse(processedBody);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      const data = validation.data;
      
      let result;
      if (existingConfig) {
        result = await storage.updateDnitConfig(existingConfig.id, data);
      } else {
        result = await storage.createDnitConfig(data);
      }

      if (!result) {
        return res.status(500).json({ error: "Failed to save DNIT configuration" });
      }

      // Return safe config without sensitive data
      const { authToken, certificatePassword, ...safeResult } = result;
      const safeResponse: SafeDnitConfig = {
        ...safeResult,
        hasAuthToken: !!authToken && authToken.trim() !== '',
        hasCertificatePassword: !!certificatePassword && certificatePassword.trim() !== ''
      };
      
      res.json(safeResponse);
    } catch (error) {
      console.error("Error saving DNIT config:", error);
      res.status(500).json({ error: "Failed to save DNIT configuration" });
    }
  });

  app.delete("/api/dnit-config", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req, res) => {
    try {
      const existingConfig = await storage.getDnitConfig();
      if (!existingConfig) {
        return res.status(404).json({ error: "DNIT configuration not found" });
      }

      const success = await storage.deleteDnitConfig(existingConfig.id);
      if (!success) {
        return res.status(500).json({ error: "Failed to delete DNIT configuration" });
      }

      res.json({ message: "DNIT configuration deleted successfully" });
    } catch (error) {
      console.error("Error deleting DNIT config:", error);
      res.status(500).json({ error: "Failed to delete DNIT configuration" });
    }
  });

  app.post("/api/dnit-config/test-connection", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req, res) => {
    try {
      const config = await storage.getDnitConfig();
      if (!config) {
        return res.status(404).json({ 
          error: "DNIT configuration not found",
          details: "Debe configurar DNIT antes de probar la conexión"
        });
      }

      // Test connection with decrypted config (storage automatically decrypts)
      const testResult = await storage.testDnitConnection(config);
      
      // Update connection status in database
      await storage.updateDnitConfig(config.id, {
        lastConnectionTest: new Date(),
        lastConnectionStatus: testResult.success ? "success" : "failed",
        lastConnectionError: testResult.error || null
      });

      res.json(testResult);
    } catch (error) {
      console.error("Error testing DNIT connection:", error);
      res.status(500).json({ 
        error: "Error testing connection",
        details: "Error interno al probar la conexión DNIT"
      });
    }
  });

  // Services Routes
  app.get("/api/services", async (req, res) => {
    try {
      const services = await storage.getServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ error: "Failed to fetch services" });
    }
  });

  app.get("/api/services/active", async (req, res) => {
    try {
      const services = await storage.getActiveServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching active services:", error);
      res.status(500).json({ error: "Failed to fetch active services" });
    }
  });

  app.get("/api/services/:id", async (req, res) => {
    try {
      const service = await storage.getService(req.params.id);
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      console.error("Error fetching service:", error);
      res.status(500).json({ error: "Failed to fetch service" });
    }
  });

  app.post("/api/services", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req, res) => {
    try {
      const validation = insertServiceSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      const service = await storage.createService(validation.data);
      res.json(service);
    } catch (error) {
      console.error("Error creating service:", error);
      res.status(500).json({ error: "Failed to create service" });
    }
  });

  app.put("/api/services/:id", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req, res) => {
    try {
      const validation = insertServiceSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      const service = await storage.updateService(req.params.id, validation.data);
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(500).json({ error: "Failed to update service" });
    }
  });

  app.delete("/api/services/:id", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req, res) => {
    try {
      // Soft delete - deactivate the service
      const service = await storage.updateService(req.params.id, { activo: false });
      if (!service) {
        return res.status(404).json({ error: "Service not found" });
      }
      res.json({ message: "Service deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating service:", error);
      res.status(500).json({ error: "Failed to deactivate service" });
    }
  });

  // ========================
  // CATEGORY ROUTES
  // ========================

  app.get("/api/categories", AuthMiddleware.requireAuth, async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: "Failed to fetch categories" });
    }
  });

  app.get("/api/categories/active", AuthMiddleware.requireAuth, async (req, res) => {
    try {
      const categories = await storage.getActiveCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching active categories:", error);
      res.status(500).json({ error: "Failed to fetch active categories" });
    }
  });

  app.get("/api/categories/by-type/:type", AuthMiddleware.requireAuth, async (req, res) => {
    try {
      const tipo = req.params.type as "servicios" | "productos" | "ambos";
      if (!["servicios", "productos", "ambos"].includes(tipo)) {
        return res.status(400).json({
          error: "Invalid type",
          details: "Type must be 'servicios', 'productos', or 'ambos'"
        });
      }
      const categories = await storage.getCategoriesByType(tipo);
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories by type:", error);
      res.status(500).json({ error: "Failed to fetch categories by type" });
    }
  });

  app.post("/api/categories", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req, res) => {
    try {
      const validation = insertCategorySchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      const category = await storage.createCategory(validation.data);
      res.json(category);
    } catch (error) {
      console.error("Error creating category:", error);
      res.status(500).json({ error: "Failed to create category" });
    }
  });

  app.put("/api/categories/:id", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req, res) => {
    try {
      const validation = insertCategorySchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      const category = await storage.updateCategory(req.params.id, validation.data);
      if (!category) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json(category);
    } catch (error) {
      console.error("Error updating category:", error);
      res.status(500).json({ error: "Failed to update category" });
    }
  });

  app.delete("/api/categories/:id", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req, res) => {
    try {
      const success = await storage.deleteCategory(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Category not found" });
      }
      res.json({ message: "Category deleted successfully" });
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: "Failed to delete category" });
    }
  });

  // ========================
  // CUSTOMER ROUTES
  // ========================

  app.get("/api/customers", AuthMiddleware.requireAuth, async (req, res) => {
    try {
      const customers = await storage.getCustomers();
      res.json(customers);
    } catch (error) {
      console.error("Error fetching customers:", error);
      res.status(500).json({ error: "Failed to fetch customers" });
    }
  });

  app.post("/api/customers", AuthMiddleware.requireAuth, async (req, res) => {
    try {
      console.log("POST /api/customers - Received data:", JSON.stringify(req.body, null, 2));
      
      // Basic validation - ensure required fields are present
      if (!req.body.nombre || req.body.nombre.trim() === '') {
        console.log("Validation failed - missing nombre");
        return res.status(400).json({
          error: "Validation failed",
          details: "El nombre del cliente es requerido"
        });
      }

      console.log("Creating customer with storage.createCustomer()");
      const customer = await storage.createCustomer(req.body);
      console.log("Customer created successfully:", customer);
      res.json(customer);
    } catch (error) {
      console.error("Error creating customer:", error);
      res.status(500).json({ 
        error: "Failed to create customer",
        details: (error as any).message || String(error)
      });
    }
  });

  app.put("/api/customers/:id", AuthMiddleware.requireAuth, async (req, res) => {
    try {
      const customer = await storage.updateCustomer(req.params.id, req.body);
      if (!customer) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json(customer);
    } catch (error) {
      console.error("Error updating customer:", error);
      res.status(500).json({ 
        error: "Failed to update customer",
        details: (error as any).message || String(error)
      });
    }
  });

  app.delete("/api/customers/:id", AuthMiddleware.requireAuth, async (req, res) => {
    try {
      const success = await storage.deleteCustomer(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Customer not found" });
      }
      res.json({ message: "Customer deleted successfully" });
    } catch (error) {
      console.error("Error deleting customer:", error);
      res.status(500).json({ 
        error: "Failed to delete customer",
        details: (error as any).message || String(error)
      });
    }
  });

  // ========================
  // VEHICLE ROUTES
  // ========================

  app.get("/api/vehicles", AuthMiddleware.requireAuth, async (req, res) => {
    try {
      const vehicles = await storage.getAllVehicles();
      res.json(vehicles);
    } catch (error) {
      console.error("Error fetching vehicles:", error);
      res.status(500).json({ error: "Failed to fetch vehicles" });
    }
  });

  app.get("/api/vehicles/by-customer/:customerId", AuthMiddleware.requireAuth, async (req, res) => {
    try {
      const { customerId } = req.params;
      if (!customerId) {
        return res.status(400).json({ error: "Customer ID is required" });
      }

      const vehicles = await storage.getVehiclesByCustomer(customerId);
      res.json(vehicles);
    } catch (error) {
      console.error("Error fetching vehicles by customer:", error);
      res.status(500).json({ error: "Failed to fetch vehicles by customer" });
    }
  });

  app.post("/api/vehicles", AuthMiddleware.requireAuth, async (req, res) => {
    try {
      const validation = insertVehicleSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      // Verify customer exists
      const customer = await storage.getCustomer(validation.data.customerId);
      if (!customer) {
        return res.status(400).json({
          error: "Invalid customer",
          details: "Customer not found"
        });
      }

      const vehicle = await storage.createVehicle(validation.data);
      res.json(vehicle);
    } catch (error) {
      console.error("Error creating vehicle:", error);
      res.status(500).json({ error: "Failed to create vehicle" });
    }
  });

  app.put("/api/vehicles/:id", AuthMiddleware.requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const validation = insertVehicleSchema.partial().safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      // If customerId is being updated, verify it exists
      if (validation.data.customerId) {
        const customer = await storage.getCustomer(validation.data.customerId);
        if (!customer) {
          return res.status(400).json({
            error: "Invalid customer",
            details: "Customer not found"
          });
        }
      }

      const vehicle = await storage.updateVehicle(id, validation.data);
      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      res.json(vehicle);
    } catch (error) {
      console.error("Error updating vehicle:", error);
      res.status(500).json({ error: "Failed to update vehicle" });
    }
  });

  app.delete("/api/vehicles/:id", AuthMiddleware.requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if vehicle is used in any work orders
      const workOrders = await storage.getWorkOrders();
      const vehicleInUse = workOrders.some(order => order.vehicleId === id);
      
      if (vehicleInUse) {
        return res.status(400).json({
          error: "Cannot delete vehicle",
          details: "Vehicle is referenced in existing work orders"
        });
      }

      const success = await storage.deleteVehicle(id);
      if (!success) {
        return res.status(404).json({ error: "Vehicle not found" });
      }

      res.json({ message: "Vehicle deleted successfully" });
    } catch (error) {
      console.error("Error deleting vehicle:", error);
      res.status(500).json({ error: "Failed to delete vehicle" });
    }
  });

  // ========================
  // INVENTORY ROUTES
  // ========================

  app.get("/api/inventory", AuthMiddleware.requireAuth, async (req, res) => {
    try {
      const inventory = await storage.getInventoryItems();
      res.json(inventory);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      res.status(500).json({ error: "Failed to fetch inventory" });
    }
  });

  app.post("/api/inventory", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req, res) => {
    try {
      // Basic validation
      if (!req.body.nombre || req.body.nombre.trim() === '') {
        return res.status(400).json({
          error: "Validation failed",
          details: "El nombre del producto es requerido"
        });
      }
      if (!req.body.precio || parseFloat(req.body.precio) <= 0) {
        return res.status(400).json({
          error: "Validation failed",
          details: "El precio debe ser mayor a 0"
        });
      }

      const item = await storage.createInventoryItem(req.body);
      res.json(item);
    } catch (error) {
      console.error("Error creating inventory item:", error);
      res.status(500).json({ error: "Failed to create inventory item" });
    }
  });

  app.put("/api/inventory/:id", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req, res) => {
    try {
      const item = await storage.updateInventoryItem(req.params.id, req.body);
      if (!item) {
        return res.status(404).json({ error: "Inventory item not found" });
      }
      res.json(item);
    } catch (error) {
      console.error("Error updating inventory item:", error);
      res.status(500).json({ error: "Failed to update inventory item" });
    }
  });

  // Service Combos Routes
  app.get("/api/service-combos", async (req, res) => {
    try {
      const combos = await storage.getServiceCombos();
      res.json(combos);
    } catch (error) {
      console.error("Error fetching service combos:", error);
      res.status(500).json({ error: "Failed to fetch service combos" });
    }
  });

  app.get("/api/service-combos/active", async (req, res) => {
    try {
      const combos = await storage.getActiveServiceCombos();
      res.json(combos);
    } catch (error) {
      console.error("Error fetching active service combos:", error);
      res.status(500).json({ error: "Failed to fetch active service combos" });
    }
  });

  app.get("/api/service-combos/:id", async (req, res) => {
    try {
      const combo = await storage.getServiceCombo(req.params.id);
      if (!combo) {
        return res.status(404).json({ error: "Service combo not found" });
      }
      
      // Get combo items with service details
      const comboItems = await storage.getServiceComboItems(combo.id);
      const serviceIds = comboItems.map(item => item.serviceId);
      const services = [];
      
      for (const serviceId of serviceIds) {
        const service = await storage.getService(serviceId);
        if (service) {
          services.push(service);
        }
      }

      res.json({
        ...combo,
        services
      });
    } catch (error) {
      console.error("Error fetching service combo:", error);
      res.status(500).json({ error: "Failed to fetch service combo" });
    }
  });

  app.post("/api/service-combos", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req, res) => {
    try {
      const { serviceIds, ...comboData } = req.body;

      // Validate combo data
      const validation = insertServiceComboSchema.safeParse(comboData);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      // Validate service IDs
      if (!serviceIds || !Array.isArray(serviceIds) || serviceIds.length < 2) {
        return res.status(400).json({
          error: "Validation failed",
          details: "A combo must include at least 2 services"
        });
      }

      // Create the combo
      const combo = await storage.createServiceCombo(validation.data);

      // Add service items to combo
      for (const serviceId of serviceIds) {
        await storage.createServiceComboItem({
          comboId: combo.id,
          serviceId
        });
      }

      res.json(combo);
    } catch (error) {
      console.error("Error creating service combo:", error);
      res.status(500).json({ error: "Failed to create service combo" });
    }
  });

  app.put("/api/service-combos/:id", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req, res) => {
    try {
      const { serviceIds, ...comboData } = req.body;

      // Validate combo data
      const validation = insertServiceComboSchema.partial().safeParse(comboData);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      // Update the combo
      const combo = await storage.updateServiceCombo(req.params.id, validation.data);
      if (!combo) {
        return res.status(404).json({ error: "Service combo not found" });
      }

      // Update service items if provided
      if (serviceIds && Array.isArray(serviceIds)) {
        if (serviceIds.length < 2) {
          return res.status(400).json({
            error: "Validation failed",
            details: "A combo must include at least 2 services"
          });
        }

        // Remove existing combo items
        await storage.deleteServiceComboItemsByCombo(combo.id);

        // Add new service items
        for (const serviceId of serviceIds) {
          await storage.createServiceComboItem({
            comboId: combo.id,
            serviceId
          });
        }
      }

      res.json(combo);
    } catch (error) {
      console.error("Error updating service combo:", error);
      res.status(500).json({ error: "Failed to update service combo" });
    }
  });

  app.delete("/api/service-combos/:id", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req, res) => {
    try {
      // Soft delete - deactivate the combo
      const combo = await storage.updateServiceCombo(req.params.id, { activo: false });
      if (!combo) {
        return res.status(404).json({ error: "Service combo not found" });
      }
      res.json({ message: "Service combo deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating service combo:", error);
      res.status(500).json({ error: "Failed to deactivate service combo" });
    }
  });

  // ========================
  // WORK ORDER ROUTES - NO TIMBRADO CHECKS
  // Work orders are operational, not fiscal documents
  // ========================

  // Get all work orders
  app.get("/api/work-orders", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workOrders = await storage.getWorkOrders();
      res.json(workOrders);
    } catch (error) {
      console.error("Error fetching work orders:", error);
      res.status(500).json({ error: "Failed to fetch work orders" });
    }
  });

  // Get work orders by status
  app.get("/api/work-orders/by-status/:status", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status } = req.params;
      const workOrders = await storage.getWorkOrdersByStatus(status);
      res.json(workOrders);
    } catch (error) {
      console.error("Error fetching work orders by status:", error);
      res.status(500).json({ error: "Failed to fetch work orders" });
    }
  });

  // Get work orders by customer
  app.get("/api/work-orders/by-customer/:customerId", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { customerId } = req.params;
      const workOrders = await storage.getWorkOrdersByCustomer(customerId);
      res.json(workOrders);
    } catch (error) {
      console.error("Error fetching work orders by customer:", error);
      res.status(500).json({ error: "Failed to fetch work orders" });
    }
  });

  // Get next work order number
  app.get("/api/work-orders/next-number", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const nextNumber = await storage.getNextWorkOrderNumber();
      res.json({ nextNumber });
    } catch (error) {
      console.error("Error fetching next work order number:", error);
      res.status(500).json({ error: "Failed to fetch next work order number" });
    }
  });

  // Get specific work order
  app.get("/api/work-orders/:id", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workOrder = await storage.getWorkOrder(req.params.id);
      if (!workOrder) {
        return res.status(404).json({ error: "Work order not found" });
      }
      
      // Get work order items
      const items = await storage.getWorkOrderItems(req.params.id);
      
      res.json({
        ...workOrder,
        items
      });
    } catch (error) {
      console.error("Error fetching work order:", error);
      res.status(500).json({ error: "Failed to fetch work order" });
    }
  });

  // Create work order
  app.post("/api/work-orders", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = insertWorkOrderSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      const workOrder = await storage.createWorkOrder(validation.data);
      res.json(workOrder);
    } catch (error) {
      console.error("Error creating work order:", error);
      res.status(500).json({ error: "Failed to create work order" });
    }
  });

  // Update work order
  app.put("/api/work-orders/:id", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const validation = insertWorkOrderSchema.partial().safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      const workOrder = await storage.updateWorkOrder(req.params.id, validation.data);
      if (!workOrder) {
        return res.status(404).json({ error: "Work order not found" });
      }

      res.json(workOrder);
    } catch (error) {
      console.error("Error updating work order:", error);
      res.status(500).json({ error: "Failed to update work order" });
    }
  });

  // Update work order status
  app.put("/api/work-orders/:id/status", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { status } = req.body;
      if (!status) {
        return res.status(400).json({
          error: "Status is required",
          details: "Estado requerido"
        });
      }

      const workOrder = await storage.updateWorkOrderStatus(req.params.id, status);
      if (!workOrder) {
        return res.status(404).json({ error: "Work order not found" });
      }

      res.json(workOrder);
    } catch (error) {
      console.error("Error updating work order status:", error);
      res.status(500).json({ error: "Failed to update work order status" });
    }
  });

  // Add item to work order
  app.post("/api/work-orders/:id/items", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workOrderId = req.params.id;
      const itemData = { ...req.body, workOrderId };
      
      const validation = insertWorkOrderItemSchema.safeParse(itemData);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      const item = await storage.addWorkOrderItem(workOrderId, validation.data);
      res.json(item);
    } catch (error) {
      console.error("Error adding work order item:", error);
      res.status(500).json({ error: "Failed to add work order item" });
    }
  });

  // Remove item from work order
  app.delete("/api/work-orders/:id/items/:itemId", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { id: workOrderId, itemId } = req.params;
      
      const success = await storage.removeWorkOrderItem(workOrderId, itemId);
      if (!success) {
        return res.status(404).json({ error: "Work order item not found" });
      }

      res.json({ message: "Work order item removed successfully" });
    } catch (error) {
      console.error("Error removing work order item:", error);
      res.status(500).json({ error: "Failed to remove work order item" });
    }
  });

  // Delete work order
  app.delete("/api/work-orders/:id", AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const success = await storage.deleteWorkOrder(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Work order not found" });
      }

      res.json({ message: "Work order deleted successfully" });
    } catch (error) {
      console.error("Error deleting work order:", error);
      res.status(500).json({ error: "Failed to delete work order" });
    }
  });

  // ========================
  // PRINT ROUTES
  // ========================

  // Get work order print data (NO timbrado check - operational document)
  app.get("/api/print/work-orders/:id", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const workOrder = await storage.getWorkOrder(req.params.id);
      if (!workOrder) {
        return res.status(404).json({ error: "Work order not found" });
      }

      const items = await storage.getWorkOrderItems(req.params.id);
      const customer = await storage.getCustomer(workOrder.customerId);
      const vehicle = await storage.getVehicle(workOrder.vehicleId);
      const companyConfig = await storage.getCompanyConfig();

      res.json({
        workOrder,
        items,
        customer,
        vehicle,
        companyConfig
      });
    } catch (error) {
      console.error("Error fetching work order for printing:", error);
      res.status(500).json({ error: "Failed to fetch work order for printing" });
    }
  });

  // Get invoice print data (WITH timbrado check - fiscal document)
  app.get("/api/print/invoices/:id", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sale = await storage.getSale(req.params.id);
      if (!sale) {
        return res.status(404).json({ error: "Invoice not found" });
      }

      const saleItems = await storage.getSaleItems(req.params.id);
      const customer = sale.customerId ? await storage.getCustomer(sale.customerId) : null;
      const companyConfig = await storage.getCompanyConfig();

      // Validate timbrado for printing invoices
      const timbradoValidation = validateActiveTimbrado(companyConfig ?? null);
      if (!timbradoValidation.isValid && timbradoValidation.blocksInvoicing) {
        return res.status(403).json({
          error: "Cannot print invoice - Timbrado invalid",
          details: timbradoValidation.error,
          code: "TIMBRADO_INVALID"
        });
      }

      res.json({
        sale,
        items: saleItems,
        customer,
        companyConfig,
        timbradoStatus: timbradoValidation
      });
    } catch (error) {
      console.error("Error fetching invoice for printing:", error);
      res.status(500).json({ error: "Failed to fetch invoice for printing" });
    }
  });

  // Enhanced billing routes with both timbrado validation and usage limits
  
  // Create invoice route (protected by both timbrado validation and usage limits)
  app.post("/api/sales/invoice", 
    AuthMiddleware.requireAuth, 
    AuthMiddleware.requireUserOrAdmin,
    enforceUsageLimit,
    requireActiveTimbrado, 
    async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Both timbrado and usage limits have been validated by middleware
      const config = (req as any).companyConfig;
      const usageInfo = (req as any).usageInfo;
      const userId = req.session.user!.id;

      // Increment user's invoice count
      const incrementResult = await UsageTrackingService.incrementInvoiceCount(userId);
      if (!incrementResult.success) {
        return res.status(500).json({ 
          error: "Failed to update usage counter",
          details: "No se pudo actualizar el contador de uso"
        });
      }

      // Update session with new invoice count
      if (req.session.user) {
        req.session.user.currentMonthInvoices = incrementResult.newCount!;
      }

      // Future implementation would create actual invoices here
      res.json({
        message: "Factura creada exitosamente",
        invoiceNumber: `${config.establecimiento}-${config.puntoExpedicion}-${Date.now()}`,
        timbrado: {
          numero: config.timbradoNumero,
          establecimiento: config.establecimiento,
          puntoExpedicion: config.puntoExpedicion
        },
        usage: {
          currentCount: incrementResult.newCount,
          remaining: incrementResult.remaining,
          monthlyLimit: usageInfo.limit
        },
        note: "Factura registrada - funcionalidad completa pendiente de implementación"
      });
    } catch (error) {
      console.error("Error creating invoice:", error);
      res.status(500).json({ error: "Failed to create invoice" });
    }
  });

  // Create receipt route (protected by both timbrado validation and usage limits)
  app.post("/api/sales/receipt", 
    AuthMiddleware.requireAuth,
    AuthMiddleware.requireUserOrAdmin,
    enforceUsageLimit,
    requireActiveTimbrado, 
    async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Both timbrado and usage limits have been validated by middleware
      const config = (req as any).companyConfig;
      const usageInfo = (req as any).usageInfo;
      const userId = req.session.user!.id;

      // Increment user's invoice count
      const incrementResult = await UsageTrackingService.incrementInvoiceCount(userId);
      if (!incrementResult.success) {
        return res.status(500).json({ 
          error: "Failed to update usage counter",
          details: "No se pudo actualizar el contador de uso"
        });
      }

      // Update session with new invoice count
      if (req.session.user) {
        req.session.user.currentMonthInvoices = incrementResult.newCount!;
      }

      // Future implementation would create actual receipts here
      res.json({
        message: "Recibo creado exitosamente",
        receiptNumber: `REC-${config.establecimiento}-${config.puntoExpedicion}-${Date.now()}`,
        timbrado: {
          numero: config.timbradoNumero,
          establecimiento: config.establecimiento,
          puntoExpedicion: config.puntoExpedicion
        },
        usage: {
          currentCount: incrementResult.newCount,
          remaining: incrementResult.remaining,
          monthlyLimit: usageInfo.limit
        },
        note: "Recibo registrado - funcionalidad completa pendiente de implementación"
      });
    } catch (error) {
      console.error("Error creating receipt:", error);
      res.status(500).json({ error: "Failed to create receipt" });
    }
  });

  // ========================
  // SALES ROUTES - WITH TIMBRADO CHECKS
  // Sales are fiscal documents requiring valid timbrado
  // ========================

  // Get all sales
  app.get("/api/sales", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sales = await storage.getSales();
      res.json(sales);
    } catch (error) {
      console.error("Error fetching sales:", error);
      res.status(500).json({ error: "Failed to fetch sales" });
    }
  });

  // Get specific sale
  app.get("/api/sales/:id", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sale = await storage.getSale(req.params.id);
      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }
      res.json(sale);
    } catch (error) {
      console.error("Error fetching sale:", error);
      res.status(500).json({ error: "Failed to fetch sale" });
    }
  });

  // Create standalone sale (WITH timbrado checks - fiscal document)
  app.post("/api/sales", 
    AuthMiddleware.requireAuth,
    AuthMiddleware.requireUserOrAdmin,
    enforceUsageLimit,
    requireActiveTimbrado,
    async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Timbrado and usage limits have been validated by middleware
      const companyConfig = (req as any).companyConfig;
      const userId = req.session.user!.id;
      
      // Validate sale data
      const validation = saleWithItemsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      // Generate sequential invoice number
      const lastSale = await storage.getLastSale();
      const nextNumber = lastSale ? extractInvoiceNumber(lastSale.numeroFactura) + 1 : 1;
      const numeroFactura = generateInvoiceNumber(
        companyConfig.establecimiento,
        companyConfig.puntoExpedicion,
        nextNumber
      );

      // Create sale with generated invoice number and creator tracking
      const saleToCreate = {
        ...validation.data,
        numeroFactura,
        timbradoUsado: companyConfig.timbradoNumero,
        createdBy: userId,
      };

      const sale = await storage.createSale(saleToCreate);
      
      // Create sale items if provided
      if (req.body.items && Array.isArray(req.body.items)) {
        for (const item of req.body.items) {
          // Validate each item individually
          const itemValidation = frontendSaleItemSchema.safeParse(item);
          if (!itemValidation.success) {
            return res.status(400).json({
              error: "Invalid item data",
              details: `Item validation failed: ${itemValidation.error.errors.map(e => e.message).join(', ')}`
            });
          }

          await storage.createSaleItem({
            saleId: sale.id,
            serviceId: item.type === 'service' ? item.id : null,
            comboId: item.type === 'combo' ? item.id : null,
            inventoryItemId: item.type === 'product' ? item.id : null,
            nombre: item.name,
            precioUnitario: item.price.toString(),
            cantidad: item.quantity,
            subtotal: (item.price * item.quantity).toString(),
          });
        }
      }

      // Increment user's invoice count after successful creation
      const incrementResult = await UsageTrackingService.incrementInvoiceCount(userId);
      if (incrementResult.success && req.session.user) {
        req.session.user.currentMonthInvoices = incrementResult.newCount!;
      }

      res.json({
        message: "Sale created successfully",
        sale,
        invoiceNumber: numeroFactura,
        timbrado: {
          numero: companyConfig.timbradoNumero,
          establecimiento: companyConfig.establecimiento,
          puntoExpedicion: companyConfig.puntoExpedicion
        }
      });
    } catch (error) {
      console.error("Error creating sale:", error);
      res.status(500).json({ error: "Failed to create sale" });
    }
  });

  app.post("/api/sales/create-from-order", 
    AuthMiddleware.requireAuth,
    AuthMiddleware.requireUserOrAdmin,
    enforceUsageLimit,
    requireActiveTimbrado, 
    async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { saleData, action } = req.body;
      
      // Validate sale data with new enhanced validation
      const validation = saleWithItemsSchema.safeParse(saleData);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      const companyConfig = (req as any).companyConfig;
      const userId = req.session.user!.id;
      
      // Generate sequential invoice number
      const lastSale = await storage.getLastSale();
      const nextNumber = lastSale ? extractInvoiceNumber(lastSale.numeroFactura) + 1 : 1;
      const numeroFactura = generateInvoiceNumber(
        companyConfig.establecimiento,
        companyConfig.puntoExpedicion,
        nextNumber
      );

      // Create sale with generated invoice number and creator tracking
      const saleToCreate = {
        ...validation.data,
        numeroFactura,
        timbradoUsado: companyConfig.timbradoNumero,
        createdBy: userId, // Track who created the sale
      };

      const sale = await storage.createSale(saleToCreate);
      
      // Create sale items with proper type mapping
      if (saleData.items && Array.isArray(saleData.items)) {
        for (const item of saleData.items) {
          // Validate each item individually
          const itemValidation = frontendSaleItemSchema.safeParse(item);
          if (!itemValidation.success) {
            return res.status(400).json({
              error: "Invalid item data",
              details: `Item validation failed: ${itemValidation.error.errors.map(e => e.message).join(', ')}`
            });
          }

          await storage.createSaleItem({
            saleId: sale.id,
            serviceId: item.type === 'service' ? item.id : null,
            comboId: item.type === 'combo' ? item.id : null,
            inventoryItemId: item.type === 'product' ? item.id : null,
            nombre: item.name,
            precioUnitario: item.price.toString(),
            cantidad: item.quantity,
            subtotal: (item.price * item.quantity).toString(),
          });
        }
      }

      // Update work order status if needed (mark as invoiced)
      if (saleData.workOrderId) {
        await storage.updateWorkOrder(saleData.workOrderId, {
          estado: "entregado" // Mark as delivered when invoiced
        });
      }

      // Increment user's invoice count for usage tracking
      const incrementResult = await UsageTrackingService.incrementInvoiceCount(userId);
      if (!incrementResult.success) {
        return res.status(500).json({ 
          error: "Failed to update usage counter",
          details: "No se pudo actualizar el contador de uso"
        });
      }

      // Audit log for sale creation
      console.log(`AUDIT_LOG: Sale created - ID: ${sale.id}, Invoice: ${sale.numeroFactura}, User: ${userId}, Items: ${saleData.items?.length || 0}`);

      res.json({
        ...sale,
        items: saleData.items,
        action
      });
    } catch (error) {
      console.error("Error creating sale from order:", error);
      res.status(500).json({ error: "Failed to create sale" });
    }
  });

  // Legacy print route - use GET /api/print/invoices/:id instead
  app.get("/api/sales/:id/print", AuthMiddleware.requireAuth, async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sale = await storage.getSale(req.params.id);
      if (!sale) {
        return res.status(404).json({ error: "Sale not found" });
      }

      const saleItems = await storage.getSaleItems(req.params.id);
      const customer = sale.customerId ? await storage.getCustomer(sale.customerId) : null;
      const companyConfig = await storage.getCompanyConfig();

      // NOTE: This legacy route does not check timbrado - use /api/print/invoices/:id for fiscal compliance
      res.json({
        sale,
        items: saleItems,
        customer,
        companyConfig
      });
    } catch (error) {
      console.error("Error fetching sale for printing:", error);
      res.status(500).json({ error: "Failed to fetch sale for printing" });
    }
  });

  // Edit invoice route - Admin only with 24-hour window
  app.put("/api/sales/:id", 
    AuthMiddleware.requireAuth, 
    AuthMiddleware.requireAdmin,
    validateSaleModification,
    // Note: Removed requireActiveTimbrado to allow admin corrections even with expired timbrado
    async (req: AuthenticatedRequest, res: Response) => {
    try {
      const saleId = req.params.id;
      const existingSale = (req as any).existingSale;
      const updateData = req.body;

      // Validate update data with items validation
      const validation = saleWithItemsSchema.partial().safeParse(updateData);
      if (!validation.success) {
        return res.status(400).json({
          error: "Validation failed",
          details: validation.error.errors
        });
      }

      // Backup original data for audit log
      const originalSaleItems = await storage.getSaleItems(saleId);
      const auditLog = {
        action: 'UPDATE_SALE',
        saleId,
        adminUserId: req.session.user!.id,
        adminUserName: req.session.user!.fullName,
        timestamp: new Date().toISOString(),
        original: {
          sale: existingSale,
          items: originalSaleItems
        },
        new: {
          sale: updateData,
          items: updateData.items
        }
      };

      // Remove items from updateData as they should be handled separately
      const { items, ...saleUpdateData } = updateData;

      // Update the sale
      const updatedSale = await storage.updateSale(saleId, {
        ...saleUpdateData,
        updatedAt: new Date().toISOString()
      });

      if (!updatedSale) {
        return res.status(500).json({
          error: "Failed to update sale",
          details: "Error al actualizar la venta"
        });
      }

      // Handle sale items update if provided
      if (items && Array.isArray(items)) {
        // Validate each item
        for (const item of items) {
          const itemValidation = frontendSaleItemSchema.safeParse(item);
          if (!itemValidation.success) {
            return res.status(400).json({
              error: "Invalid item data",
              details: `Item validation failed: ${itemValidation.error.errors.map(e => e.message).join(', ')}`
            });
          }
        }

        // Delete existing items
        await storage.deleteSaleItemsBySale(saleId);
        
        // Create new items with correct type mapping
        for (const item of items) {
          await storage.createSaleItem({
            saleId: updatedSale.id,
            serviceId: item.type === 'service' ? item.id : null,
            comboId: item.type === 'combo' ? item.id : null,
            inventoryItemId: item.type === 'product' ? item.id : null,
            nombre: item.name,
            precioUnitario: item.price.toString(),
            cantidad: item.quantity,
            subtotal: (item.price * item.quantity).toString(),
          });
        }
      }

      // Enhanced audit trail logging
      console.log('AUDIT_LOG:', JSON.stringify(auditLog, null, 2));

      res.json({
        message: "Factura actualizada exitosamente",
        sale: updatedSale,
        hoursElapsed: Math.round((req as any).hoursElapsed),
        modifiedBy: req.session.user!.fullName
      });
    } catch (error) {
      console.error("Error updating sale:", error);
      res.status(500).json({ 
        error: "Failed to update sale",
        details: "Error al actualizar la factura"
      });
    }
  });

  // Delete invoice route - Admin only with 24-hour window
  app.delete("/api/sales/:id", 
    AuthMiddleware.requireAuth, 
    AuthMiddleware.requireAdmin,
    validateSaleModification,
    // Note: Removed requireActiveTimbrado to allow admin corrections even with expired timbrado
    async (req: AuthenticatedRequest, res: Response) => {
    try {
      const saleId = req.params.id;
      const existingSale = (req as any).existingSale;

      // Get sale items for audit log before deletion
      const saleItems = await storage.getSaleItems(saleId);

      // Enhanced audit trail logging
      const auditLog = {
        action: 'DELETE_SALE',
        saleId,
        adminUserId: req.session.user!.id,
        adminUserName: req.session.user!.fullName,
        timestamp: new Date().toISOString(),
        deletedSale: existingSale,
        deletedItems: saleItems
      };
      console.log('AUDIT_LOG:', JSON.stringify(auditLog, null, 2));

      // Check if we need to handle usage tracking (find who created the original sale)
      // We look for a createdBy field or assume the first user for backwards compatibility
      let saleCreatorId: string | null = null;
      
      // If sale has a createdBy field, use that; otherwise try to infer from session
      if (existingSale.createdBy) {
        saleCreatorId = existingSale.createdBy;
      } else {
        // For older sales without createdBy, try to find reasonable approach
        console.log('Warning: Sale has no createdBy field, cannot decrement usage for original creator');
      }

      // Delete sale items first (foreign key constraint)
      await storage.deleteSaleItemsBySale(saleId);

      // Delete the sale
      const deleteResult = await storage.deleteSale(saleId);
      if (!deleteResult) {
        return res.status(500).json({
          error: "Failed to delete sale",
          details: "Error al eliminar la venta"
        });
      }

      // Handle usage tracking: Decrement usage for the original sale creator
      // Only if sale was created in current usage period
      if (saleCreatorId) {
        try {
          const saleCreator = await storage.getUser(saleCreatorId);
          if (saleCreator) {
            // Check if sale was created within current usage period
            const saleCreatedAt = new Date(existingSale.createdAt);
            const usageResetDate = new Date(saleCreator.usageResetDate);
            
            if (saleCreatedAt >= usageResetDate) {
              // Sale was created in current usage period, safe to decrement
              const decrementResult = await UsageTrackingService.decrementInvoiceCount(saleCreatorId);
              if (decrementResult.success) {
                console.log(`Decremented usage count for user ${saleCreatorId} (was: ${decrementResult.newCount! + 1}, now: ${decrementResult.newCount})`);
              } else {
                console.warn(`Failed to decrement usage count for user ${saleCreatorId}`);
              }
            } else {
              console.log(`Sale was created before current usage period, not decrementing usage count`);
            }
          }
        } catch (error) {
          console.error('Error handling usage tracking for deleted sale:', error);
          // Don't fail the delete operation for usage tracking errors
        }
      }

      // Update work order status if it was linked
      if (existingSale.workOrderId) {
        await storage.updateWorkOrder(existingSale.workOrderId, {
          estado: "terminado" // Mark as finished but not invoiced
        });
      }

      res.json({
        message: "Factura eliminada exitosamente",
        deletedInvoice: existingSale.numeroFactura,
        hoursElapsed: Math.round((req as any).hoursElapsed),
        deletedBy: req.session.user!.fullName
      });
    } catch (error) {
      console.error("Error deleting sale:", error);
      res.status(500).json({ 
        error: "Failed to delete sale",
        details: "Error al eliminar la factura"
      });
    }
  });

  // Admin reset endpoint - DANGEROUS: Clears all business data
  app.post('/api/admin/reset-system', AuthMiddleware.requireAuth, AuthMiddleware.requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
    try {
      console.log("🗑️ Admin-initiated system reset by user:", req.session.user?.username);
      
      // Clear all data (preserves admin user)
      await storage.clearAllData();
      
      console.log("✅ System reset completed successfully");
      
      res.json({ 
        message: 'Sistema reseteado exitosamente',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('❌ System reset failed:', error);
      res.status(500).json({ 
        error: 'Error interno del servidor', 
        details: 'No se pudo resetear el sistema' 
      });
    }
  });

  // Helper function to extract invoice number from string format
  function extractInvoiceNumber(numeroFactura: string): number {
    const parts = numeroFactura.split('-');
    return parseInt(parts[parts.length - 1]) || 0;
  }

  // Helper function to generate invoice number
  function generateInvoiceNumber(establecimiento: string, puntoExpedicion: string, numero: number): string {
    const paddedNumero = numero.toString().padStart(7, '0');
    return `${establecimiento}-${puntoExpedicion}-${paddedNumero}`;
  }

  const httpServer = createServer(app);

  return httpServer;
}
