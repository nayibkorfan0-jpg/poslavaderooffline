import { 
  type User, type InsertUser, type InternalUpdateUser,
  type CompanyConfig, type InsertCompanyConfig,
  type DnitConfig, type InsertDnitConfig, type UpdateDnitConfig,
  type Category, type InsertCategory,
  type Customer, type InsertCustomer,
  type Vehicle, type InsertVehicle,
  type Service, type InsertService,
  type ServiceCombo, type InsertServiceCombo,
  type ServiceComboItem, type InsertServiceComboItem,
  type WorkOrder, type InsertWorkOrder,
  type WorkOrderItem, type InsertWorkOrderItem,
  type InventoryItem, type InsertInventoryItem,
  type Sale, type InsertSale,
  type SaleItem, type InsertSaleItem
} from "@shared/schema";
import {
  users, companyConfigs, dnitConfigs, categories, customers, vehicles, services, serviceCombos, serviceComboItems,
  workOrders, workOrderItems, inventoryItems, sales, saleItems
} from "@shared/sqlite-schema";
import { randomUUID } from "crypto";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, desc, and, or, gte, lte, between, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "path";
import fs from "fs";
import { EncryptionService } from "./encryption";
import { PasswordUtils } from "./password-utils";
import { IStorage } from "./storage";

/**
 * SQLite-based storage implementation (ISOLATED FROM MAIN STORAGE)
 * This file contains all SQLite/Drizzle specific code
 * Use MemStorage for immediate deployment without database setup
 */
export class SQLiteStorage implements IStorage {
  private drizzleDb: any;
  private dbPath: string;

  constructor(dbPath?: string) {
    // Use userData directory for desktop app - ensures data persistence across app updates
    this.dbPath = dbPath || this.getUserDataPath();
    this.initializeDatabase();
  }

  private getUserDataPath(): string {
    // For desktop applications, use userData directory
    // Falls back to current directory if not in Electron environment
    try {
      const { app } = require('electron');
      const userDataPath = app.getPath('userData');
      return path.join(userDataPath, '1solution-aurum.sqlite');
    } catch {
      // Fallback for non-Electron environments
      return path.join(process.cwd(), 'data', 'aurum-pos.sqlite');
    }
  }

  private initializeDatabase() {
    try {
      // Ensure database directory exists
      const dir = path.dirname(this.dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Create database connection with optimizations
      const sqlite = new Database(this.dbPath);
      
      // Enable WAL mode for better performance and concurrency
      sqlite.pragma('journal_mode = WAL');
      sqlite.pragma('synchronous = NORMAL');
      sqlite.pragma('cache_size = 1000000');
      sqlite.pragma('temp_store = MEMORY');
      
      // Enable foreign key constraints
      sqlite.pragma('foreign_keys = ON');
      
      this.drizzleDb = drizzle(sqlite);

      // Initialize database schema (create tables if they don't exist)
      this.initializeTables();

      console.log(`✅ SQLite database initialized at: ${this.dbPath}`);
      console.log('📊 WAL mode enabled for optimal performance');
    } catch (error) {
      console.error("Failed to initialize SQLite database:", error);
      throw new Error(`Database initialization failed: ${error}`);
    }
  }

  private initializeTables() {
    // This method ensures all tables exist
    // Drizzle will create tables based on schema definitions
    try {
      // Create a simple test to verify database connectivity
      this.drizzleDb.select().from(users).limit(1).catch(() => {
        console.log('🔧 Database schema initialization in progress...');
      });
    } catch (error) {
      console.warn('Schema initialization note:', error);
    }
  }

  // ============================
  // HELPER METHODS
  // ============================

  // Convert Date to timestamp (seconds since epoch)
  private dateToTimestamp(date: Date): number {
    return Math.floor(date.getTime() / 1000);
  }

  // Convert timestamp to Date
  private timestampToDate(timestamp: number): Date {
    return new Date(timestamp * 1000);
  }

  // Convert number to decimal string for precise storage
  private numberToDecimal(value: number | string): string {
    return String(value);
  }

  // Convert decimal string back to number
  private decimalToNumber(value: string): number {
    return parseFloat(value);
  }

  // Generate UUID
  private generateUUID(): string {
    return randomUUID();
  }

  // Process date string for consistent storage (YYYY-MM-DD format)
  private processDateString(dateValue: string | Date | null | undefined): string | null {
    if (!dateValue) return null;
    
    try {
      const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
      return date.toISOString().split('T')[0]; // Extract just YYYY-MM-DD
    } catch {
      return null;
    }
  }

  /**
   * Initialize admin user if it doesn't exist
   */
  async initializeAdminUser(): Promise<void> {
    try {
      const existingAdmin = await this.getUserByUsername("admin");
      if (!existingAdmin) {
        console.log("🔐 Creating initial admin user...");
        
        await this.createUser({
          username: "admin",
          password: "aurum1705",
          fullName: "Administrador",
          email: "admin@1solution.com.py",
          role: "admin",
          subscriptionType: "enterprise",
          monthlyInvoiceLimit: 999999,
          isActive: true,
          isBlocked: false
        });
        
        console.log("✅ Admin user created successfully (username: admin)");
      } else {
        console.log("✓ Admin user already exists");
      }
    } catch (error) {
      console.error("Error initializing admin user:", error);
    }
  }

  // ============================
  // USER MANAGEMENT
  // ============================

  async getUser(id: string): Promise<User | undefined> {
    try {
      const result = await this.drizzleDb.select().from(users).where(eq(users.id, id)).limit(1);
      return result[0] as User | undefined;
    } catch (error) {
      console.error('Error getting user:', error);
      return undefined;
    }
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    try {
      const result = await this.drizzleDb.select().from(users).where(eq(users.username, username)).limit(1);
      return result[0] as User | undefined;
    } catch (error) {
      console.error('Error getting user by username:', error);
      return undefined;
    }
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    try {
      const result = await this.drizzleDb.select().from(users).where(eq(users.email, email)).limit(1);
      return result[0] as User | undefined;
    } catch (error) {
      console.error('Error getting user by email:', error);
      return undefined;
    }
  }

  async getUsers(): Promise<User[]> {
    try {
      const result = await this.drizzleDb.select().from(users).orderBy(desc(users.createdAt));
      return result as User[];
    } catch (error) {
      console.error('Error getting users:', error);
      return [];
    }
  }

  async getActiveUsers(): Promise<User[]> {
    try {
      const result = await this.drizzleDb.select().from(users)
        .where(eq(users.isActive, true))
        .orderBy(desc(users.createdAt));
      return result as User[];
    } catch (error) {
      console.error('Error getting active users:', error);
      return [];
    }
  }

  async createUser(user: InsertUser): Promise<User> {
    try {
      const hashedPassword = await PasswordUtils.hashPassword(user.password);
      
      const [newUser] = await this.drizzleDb.insert(users).values({
        username: user.username,
        password: hashedPassword,
        fullName: user.fullName ?? null,
        email: user.email ?? null,
        role: user.role ?? "user",
        subscriptionType: user.subscriptionType ?? "free",
        monthlyInvoiceLimit: user.monthlyInvoiceLimit ?? 50,
        expirationDate: user.expirationDate ?? null,
        isActive: user.isActive ?? true,
        isBlocked: user.isBlocked ?? false,
        createdBy: user.createdBy ?? null,
        currentMonthInvoices: 0,
        usageResetDate: new Date(),
        failedLoginAttempts: 0,
        lastLogin: null,
        lastFailedLogin: null
      }).returning();
      
      return newUser as User;
    } catch (error) {
      console.error('Error creating user:', error);
      throw error;
    }
  }

  async updateUser(id: string, user: Partial<InternalUpdateUser>): Promise<User | undefined> {
    try {
      const updateData: any = { ...user, updatedAt: new Date() };
      
      if (user.password) {
        updateData.password = await PasswordUtils.hashPassword(user.password);
      }
      
      const [updatedUser] = await this.drizzleDb.update(users)
        .set(updateData)
        .where(eq(users.id, id))
        .returning();
      
      return updatedUser as User | undefined;
    } catch (error) {
      console.error('Error updating user:', error);
      return undefined;
    }
  }

  async deactivateUser(id: string): Promise<boolean> {
    try {
      await this.drizzleDb.update(users)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(users.id, id));
      
      return true;
    } catch (error) {
      console.error('Error deactivating user:', error);
      return false;
    }
  }

  async incrementUserInvoiceCount(id: string): Promise<User | undefined> {
    try {
      const user = await this.getUser(id);
      if (!user) return undefined;
      
      const [updatedUser] = await this.drizzleDb.update(users)
        .set({ 
          currentMonthInvoices: user.currentMonthInvoices + 1,
          updatedAt: new Date()
        })
        .where(eq(users.id, id))
        .returning();
      
      return updatedUser as User;
    } catch (error) {
      console.error('Error incrementing user invoice count:', error);
      return undefined;
    }
  }

  async resetMonthlyUsage(id: string): Promise<User | undefined> {
    try {
      const [updatedUser] = await this.drizzleDb.update(users)
        .set({ 
          currentMonthInvoices: 0,
          usageResetDate: new Date(),
          updatedAt: new Date()
        })
        .where(eq(users.id, id))
        .returning();
      
      return updatedUser as User | undefined;
    } catch (error) {
      console.error('Error resetting monthly usage:', error);
      return undefined;
    }
  }

  // ============================
  // COMPANY CONFIG
  // ============================

  async getCompanyConfig(): Promise<CompanyConfig | undefined> {
    try {
      const result = await this.drizzleDb.select().from(companyConfigs).limit(1);
      return result[0] as CompanyConfig | undefined;
    } catch (error) {
      console.error('Error getting company config:', error);
      return undefined;
    }
  }

  async createCompanyConfig(config: InsertCompanyConfig): Promise<CompanyConfig> {
    try {
      const [newConfig] = await this.drizzleDb.insert(companyConfigs).values({
        ruc: config.ruc,
        razonSocial: config.razonSocial,
        nombreFantasia: config.nombreFantasia ?? null,
        timbradoNumero: config.timbradoNumero,
        timbradoDesde: config.timbradoDesde,
        timbradoHasta: config.timbradoHasta,
        establecimiento: config.establecimiento ?? "001",
        puntoExpedicion: config.puntoExpedicion ?? "001",
        direccion: config.direccion,
        ciudad: config.ciudad ?? "Asunción",
        telefono: config.telefono ?? null,
        email: config.email ?? null,
        logoPath: config.logoPath ?? null,
        moneda: config.moneda ?? "GS"
      }).returning();
      
      return newConfig as CompanyConfig;
    } catch (error) {
      console.error('Error creating company config:', error);
      throw error;
    }
  }

  async updateCompanyConfig(id: string, config: Partial<InsertCompanyConfig>): Promise<CompanyConfig | undefined> {
    try {
      const [updatedConfig] = await this.drizzleDb.update(companyConfigs)
        .set({ ...config, updatedAt: new Date() })
        .where(eq(companyConfigs.id, id))
        .returning();
      
      return updatedConfig as CompanyConfig | undefined;
    } catch (error) {
      console.error('Error updating company config:', error);
      return undefined;
    }
  }

  // ============================
  // DNIT CONFIG
  // ============================

  async getDnitConfig(): Promise<DnitConfig | undefined> {
    try {
      const result = await this.drizzleDb.select().from(dnitConfigs).limit(1);
      if (result[0]) {
        // Decrypt sensitive data
        const config = result[0];
        return {
          ...config,
          authToken: config.authToken ? await EncryptionService.decrypt(config.authToken) : config.authToken,
          certificatePassword: config.certificatePassword ? await EncryptionService.decrypt(config.certificatePassword) : null
        } as DnitConfig;
      }
      return undefined;
    } catch (error) {
      console.error('Error getting DNIT config:', error);
      return undefined;
    }
  }

  async createDnitConfig(config: InsertDnitConfig): Promise<DnitConfig> {
    try {
      // Encrypt sensitive data
      const encryptedAuthToken = await EncryptionService.encrypt(config.authToken);
      const encryptedCertPassword = config.certificatePassword ? await EncryptionService.encrypt(config.certificatePassword) : null;
      
      const [newConfig] = await this.drizzleDb.insert(dnitConfigs).values({
        endpointUrl: config.endpointUrl,
        authToken: encryptedAuthToken,
        certificateData: config.certificateData ?? null,
        certificatePassword: encryptedCertPassword,
        operationMode: config.operationMode ?? "testing",
        isActive: config.isActive ?? false
      }).returning();
      
      // Return with decrypted data
      return {
        ...newConfig,
        authToken: config.authToken,
        certificatePassword: config.certificatePassword ?? null
      } as DnitConfig;
    } catch (error) {
      console.error('Error creating DNIT config:', error);
      throw error;
    }
  }

  async updateDnitConfig(id: string, config: Partial<UpdateDnitConfig>): Promise<DnitConfig | undefined> {
    try {
      const updateData: any = { ...config, updatedAt: new Date() };
      
      if (config.authToken) {
        updateData.authToken = await EncryptionService.encrypt(config.authToken);
      }
      
      if (config.certificatePassword) {
        updateData.certificatePassword = await EncryptionService.encrypt(config.certificatePassword);
      }
      
      const [updatedConfig] = await this.drizzleDb.update(dnitConfigs)
        .set(updateData)
        .where(eq(dnitConfigs.id, id))
        .returning();
      
      if (updatedConfig) {
        // Return with decrypted data
        return {
          ...updatedConfig,
          authToken: config.authToken || (await EncryptionService.decrypt(updatedConfig.authToken)),
          certificatePassword: config.certificatePassword || (updatedConfig.certificatePassword ? await EncryptionService.decrypt(updatedConfig.certificatePassword) : null)
        } as DnitConfig;
      }
      
      return undefined;
    } catch (error) {
      console.error('Error updating DNIT config:', error);
      return undefined;
    }
  }

  async deleteDnitConfig(id: string): Promise<boolean> {
    try {
      await this.drizzleDb.delete(dnitConfigs).where(eq(dnitConfigs.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting DNIT config:', error);
      return false;
    }
  }

  async testDnitConnection(config: DnitConfig): Promise<{ success: boolean; error?: string }> {
    try {
      // Placeholder implementation for DNIT connection testing
      const isValidUrl = config.endpointUrl && config.endpointUrl.startsWith('http');
      const hasToken = config.authToken && config.authToken.length > 0;
      
      if (!isValidUrl) {
        return { success: false, error: "URL del endpoint inválida" };
      }
      
      if (!hasToken) {
        return { success: false, error: "Token de autenticación requerido" };
      }
      
      return { success: true };
    } catch (error) {
      return { success: false, error: `Error de conexión: ${error}` };
    }
  }

  // ============================
  // CATEGORIES
  // ============================

  async getCategory(id: string): Promise<Category | undefined> {
    try {
      const result = await this.drizzleDb.select().from(categories).where(eq(categories.id, id)).limit(1);
      return result[0] as Category | undefined;
    } catch (error) {
      console.error('Error getting category:', error);
      return undefined;
    }
  }

  async getCategories(): Promise<Category[]> {
    try {
      const result = await this.drizzleDb.select().from(categories).orderBy(categories.nombre);
      return result as Category[];
    } catch (error) {
      console.error('Error getting categories:', error);
      return [];
    }
  }

  async getCategoriesByType(tipo: "servicios" | "productos" | "ambos"): Promise<Category[]> {
    try {
      const result = await this.drizzleDb.select().from(categories)
        .where(or(eq(categories.tipo, tipo), eq(categories.tipo, "ambos")))
        .orderBy(categories.nombre);
      return result as Category[];
    } catch (error) {
      console.error('Error getting categories by type:', error);
      return [];
    }
  }

  async getActiveCategories(): Promise<Category[]> {
    try {
      const result = await this.drizzleDb.select().from(categories)
        .where(eq(categories.activa, true))
        .orderBy(categories.nombre);
      return result as Category[];
    } catch (error) {
      console.error('Error getting active categories:', error);
      return [];
    }
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    try {
      const [newCategory] = await this.drizzleDb.insert(categories).values({
        nombre: category.nombre,
        descripcion: category.descripcion ?? null,
        tipo: category.tipo ?? "ambos",
        color: category.color ?? null,
        activa: category.activa ?? true
      }).returning();
      
      return newCategory as Category;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined> {
    try {
      const [updatedCategory] = await this.drizzleDb.update(categories)
        .set({ ...category, updatedAt: new Date() })
        .where(eq(categories.id, id))
        .returning();
      
      return updatedCategory as Category | undefined;
    } catch (error) {
      console.error('Error updating category:', error);
      return undefined;
    }
  }

  async deleteCategory(id: string): Promise<boolean> {
    try {
      await this.drizzleDb.delete(categories).where(eq(categories.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting category:', error);
      return false;
    }
  }

  // ============================
  // CUSTOMERS
  // ============================

  async getCustomer(id: string): Promise<Customer | undefined> {
    try {
      const result = await this.drizzleDb.select().from(customers).where(eq(customers.id, id)).limit(1);
      return result[0] as Customer | undefined;
    } catch (error) {
      console.error('Error getting customer:', error);
      return undefined;
    }
  }

  async getCustomers(): Promise<Customer[]> {
    try {
      const result = await this.drizzleDb.select().from(customers).orderBy(customers.nombre);
      return result as Customer[];
    } catch (error) {
      console.error('Error getting customers:', error);
      return [];
    }
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    try {
      // Process fechaIngreso to ensure consistent date format
      const processedFechaIngreso = this.processDateString(customer.fechaIngreso);
      
      const [newCustomer] = await this.drizzleDb.insert(customers).values({
        nombre: customer.nombre,
        docTipo: customer.docTipo ?? "CI",
        docNumero: customer.docNumero,
        email: customer.email ?? null,
        telefono: customer.telefono ?? null,
        direccion: customer.direccion ?? null,
        regimenTurismo: customer.regimenTurismo ?? false,
        pais: customer.pais ?? null,
        pasaporte: customer.pasaporte ?? null,
        fechaIngreso: processedFechaIngreso
      }).returning();
      
      return newCustomer as Customer;
    } catch (error) {
      console.error('Error creating customer:', error);
      throw error;
    }
  }

  async updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    try {
      // Process fechaIngreso to ensure consistent date format
      const processedCustomer = { ...customer };
      if (processedCustomer.fechaIngreso !== undefined) {
        processedCustomer.fechaIngreso = this.processDateString(processedCustomer.fechaIngreso);
      }
      
      const [updatedCustomer] = await this.drizzleDb.update(customers)
        .set({ ...processedCustomer, updatedAt: new Date() })
        .where(eq(customers.id, id))
        .returning();
      
      return updatedCustomer as Customer | undefined;
    } catch (error) {
      console.error('Error updating customer:', error);
      return undefined;
    }
  }

  async deleteCustomer(id: string): Promise<boolean> {
    try {
      await this.drizzleDb.delete(customers).where(eq(customers.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting customer:', error);
      return false;
    }
  }

  // ============================
  // VEHICLES
  // ============================

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    try {
      const result = await this.drizzleDb.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
      return result[0] as Vehicle | undefined;
    } catch (error) {
      console.error('Error getting vehicle:', error);
      return undefined;
    }
  }

  async getVehiclesByCustomer(customerId: string): Promise<Vehicle[]> {
    try {
      const result = await this.drizzleDb.select().from(vehicles)
        .where(eq(vehicles.customerId, customerId))
        .orderBy(vehicles.placa);
      return result as Vehicle[];
    } catch (error) {
      console.error('Error getting vehicles by customer:', error);
      return [];
    }
  }

  async getAllVehicles(): Promise<Vehicle[]> {
    try {
      const result = await this.drizzleDb.select().from(vehicles).orderBy(vehicles.placa);
      return result as Vehicle[];
    } catch (error) {
      console.error('Error getting all vehicles:', error);
      return [];
    }
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    try {
      const [newVehicle] = await this.drizzleDb.insert(vehicles).values({
        customerId: vehicle.customerId,
        placa: vehicle.placa,
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        color: vehicle.color,
        observaciones: vehicle.observaciones ?? null
      }).returning();
      
      return newVehicle as Vehicle;
    } catch (error) {
      console.error('Error creating vehicle:', error);
      throw error;
    }
  }

  async updateVehicle(id: string, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    try {
      const [updatedVehicle] = await this.drizzleDb.update(vehicles)
        .set({ ...vehicle, updatedAt: new Date() })
        .where(eq(vehicles.id, id))
        .returning();
      
      return updatedVehicle as Vehicle | undefined;
    } catch (error) {
      console.error('Error updating vehicle:', error);
      return undefined;
    }
  }

  async deleteVehicle(id: string): Promise<boolean> {
    try {
      await this.drizzleDb.delete(vehicles).where(eq(vehicles.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting vehicle:', error);
      return false;
    }
  }

  // ============================
  // SERVICES
  // ============================

  async getService(id: string): Promise<Service | undefined> {
    try {
      const result = await this.drizzleDb.select().from(services).where(eq(services.id, id)).limit(1);
      return result[0] as Service | undefined;
    } catch (error) {
      console.error('Error getting service:', error);
      return undefined;
    }
  }

  async getServices(): Promise<Service[]> {
    try {
      const result = await this.drizzleDb.select().from(services).orderBy(services.nombre);
      return result as Service[];
    } catch (error) {
      console.error('Error getting services:', error);
      return [];
    }
  }

  async getActiveServices(): Promise<Service[]> {
    try {
      const result = await this.drizzleDb.select().from(services)
        .where(eq(services.activo, true))
        .orderBy(services.nombre);
      return result as Service[];
    } catch (error) {
      console.error('Error getting active services:', error);
      return [];
    }
  }

  async createService(service: InsertService): Promise<Service> {
    try {
      const [newService] = await this.drizzleDb.insert(services).values({
        nombre: service.nombre,
        descripcion: service.descripcion ?? null,
        precio: this.numberToDecimal(service.precio),
        duracionMin: service.duracionMin,
        categoria: service.categoria,
        activo: service.activo ?? true
      }).returning();
      
      return newService as Service;
    } catch (error) {
      console.error('Error creating service:', error);
      throw error;
    }
  }

  async updateService(id: string, service: Partial<InsertService>): Promise<Service | undefined> {
    try {
      const updateData: any = { ...service, updatedAt: new Date() };
      if (service.precio !== undefined) {
        updateData.precio = this.numberToDecimal(service.precio);
      }
      
      const [updatedService] = await this.drizzleDb.update(services)
        .set(updateData)
        .where(eq(services.id, id))
        .returning();
      
      return updatedService as Service | undefined;
    } catch (error) {
      console.error('Error updating service:', error);
      return undefined;
    }
  }

  async deleteService(id: string): Promise<boolean> {
    try {
      await this.drizzleDb.delete(services).where(eq(services.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting service:', error);
      return false;
    }
  }

  // ============================
  // SERVICE COMBOS
  // ============================

  async getServiceCombo(id: string): Promise<ServiceCombo | undefined> {
    try {
      const result = await this.drizzleDb.select().from(serviceCombos).where(eq(serviceCombos.id, id)).limit(1);
      return result[0] as ServiceCombo | undefined;
    } catch (error) {
      console.error('Error getting service combo:', error);
      return undefined;
    }
  }

  async getServiceCombos(): Promise<ServiceCombo[]> {
    try {
      const result = await this.drizzleDb.select().from(serviceCombos).orderBy(serviceCombos.nombre);
      return result as ServiceCombo[];
    } catch (error) {
      console.error('Error getting service combos:', error);
      return [];
    }
  }

  async getActiveServiceCombos(): Promise<ServiceCombo[]> {
    try {
      const result = await this.drizzleDb.select().from(serviceCombos)
        .where(eq(serviceCombos.activo, true))
        .orderBy(serviceCombos.nombre);
      return result as ServiceCombo[];
    } catch (error) {
      console.error('Error getting active service combos:', error);
      return [];
    }
  }

  async createServiceCombo(combo: InsertServiceCombo): Promise<ServiceCombo> {
    try {
      const [newCombo] = await this.drizzleDb.insert(serviceCombos).values({
        nombre: combo.nombre,
        descripcion: combo.descripcion ?? null,
        precioTotal: this.numberToDecimal(combo.precioTotal),
        activo: combo.activo ?? true
      }).returning();
      
      return newCombo as ServiceCombo;
    } catch (error) {
      console.error('Error creating service combo:', error);
      throw error;
    }
  }

  async updateServiceCombo(id: string, combo: Partial<InsertServiceCombo>): Promise<ServiceCombo | undefined> {
    try {
      const updateData: any = { ...combo, updatedAt: new Date() };
      if (combo.precioTotal !== undefined) {
        updateData.precioTotal = this.numberToDecimal(combo.precioTotal);
      }
      
      const [updatedCombo] = await this.drizzleDb.update(serviceCombos)
        .set(updateData)
        .where(eq(serviceCombos.id, id))
        .returning();
      
      return updatedCombo as ServiceCombo | undefined;
    } catch (error) {
      console.error('Error updating service combo:', error);
      return undefined;
    }
  }

  async deleteServiceCombo(id: string): Promise<boolean> {
    try {
      await this.drizzleDb.delete(serviceCombos).where(eq(serviceCombos.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting service combo:', error);
      return false;
    }
  }

  // ============================
  // SERVICE COMBO ITEMS
  // ============================

  async getServiceComboItems(comboId: string): Promise<ServiceComboItem[]> {
    try {
      const result = await this.drizzleDb.select().from(serviceComboItems)
        .where(eq(serviceComboItems.comboId, comboId));
      return result as ServiceComboItem[];
    } catch (error) {
      console.error('Error getting service combo items:', error);
      return [];
    }
  }

  async createServiceComboItem(item: InsertServiceComboItem): Promise<ServiceComboItem> {
    try {
      const [newItem] = await this.drizzleDb.insert(serviceComboItems).values({
        comboId: item.comboId,
        serviceId: item.serviceId
      }).returning();
      
      return newItem as ServiceComboItem;
    } catch (error) {
      console.error('Error creating service combo item:', error);
      throw error;
    }
  }

  async deleteServiceComboItem(id: string): Promise<boolean> {
    try {
      await this.drizzleDb.delete(serviceComboItems).where(eq(serviceComboItems.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting service combo item:', error);
      return false;
    }
  }

  async deleteServiceComboItemsByCombo(comboId: string): Promise<void> {
    try {
      await this.drizzleDb.delete(serviceComboItems).where(eq(serviceComboItems.comboId, comboId));
    } catch (error) {
      console.error('Error deleting service combo items by combo:', error);
    }
  }

  // ============================
  // WORK ORDERS
  // ============================

  async getWorkOrder(id: string): Promise<WorkOrder | undefined> {
    try {
      const result = await this.drizzleDb.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
      return result[0] as WorkOrder | undefined;
    } catch (error) {
      console.error('Error getting work order:', error);
      return undefined;
    }
  }

  async getWorkOrders(): Promise<WorkOrder[]> {
    try {
      const result = await this.drizzleDb.select().from(workOrders).orderBy(desc(workOrders.numero));
      return result as WorkOrder[];
    } catch (error) {
      console.error('Error getting work orders:', error);
      return [];
    }
  }

  async getWorkOrdersByStatus(status: string): Promise<WorkOrder[]> {
    try {
      const result = await this.drizzleDb.select().from(workOrders)
        .where(eq(workOrders.estado, status as any))
        .orderBy(desc(workOrders.numero));
      return result as WorkOrder[];
    } catch (error) {
      console.error('Error getting work orders by status:', error);
      return [];
    }
  }

  async getWorkOrdersByCustomer(customerId: string): Promise<WorkOrder[]> {
    try {
      const result = await this.drizzleDb.select().from(workOrders)
        .where(eq(workOrders.customerId, customerId))
        .orderBy(desc(workOrders.numero));
      return result as WorkOrder[];
    } catch (error) {
      console.error('Error getting work orders by customer:', error);
      return [];
    }
  }

  async createWorkOrder(workOrder: InsertWorkOrder): Promise<WorkOrder> {
    try {
      const numero = await this.getNextWorkOrderNumber();
      
      const [newOrder] = await this.drizzleDb.insert(workOrders).values({
        numero,
        customerId: workOrder.customerId,
        vehicleId: workOrder.vehicleId,
        estado: workOrder.estado ?? "recibido",
        fechaEntrada: workOrder.fechaEntrada ?? new Date(),
        fechaInicio: workOrder.fechaInicio ?? null,
        fechaFin: workOrder.fechaFin ?? null,
        fechaEntrega: workOrder.fechaEntrega ?? null,
        observaciones: workOrder.observaciones ?? null,
        total: this.numberToDecimal(workOrder.total ?? 0)
      }).returning();
      
      return newOrder as WorkOrder;
    } catch (error) {
      console.error('Error creating work order:', error);
      throw error;
    }
  }

  async updateWorkOrder(id: string, workOrder: Partial<InsertWorkOrder>): Promise<WorkOrder | undefined> {
    try {
      const updateData: any = { ...workOrder, updatedAt: new Date() };
      if (workOrder.total !== undefined) {
        updateData.total = this.numberToDecimal(workOrder.total);
      }
      
      const [updatedOrder] = await this.drizzleDb.update(workOrders)
        .set(updateData)
        .where(eq(workOrders.id, id))
        .returning();
      
      return updatedOrder as WorkOrder | undefined;
    } catch (error) {
      console.error('Error updating work order:', error);
      return undefined;
    }
  }

  async deleteWorkOrder(id: string): Promise<boolean> {
    try {
      await this.drizzleDb.delete(workOrders).where(eq(workOrders.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting work order:', error);
      return false;
    }
  }

  async getNextWorkOrderNumber(): Promise<number> {
    try {
      const result = await this.drizzleDb.select({ numero: workOrders.numero })
        .from(workOrders)
        .orderBy(desc(workOrders.numero))
        .limit(1);
      
      if (result.length === 0) {
        return 1;
      }
      
      return result[0].numero + 1;
    } catch (error) {
      console.error('Error getting next work order number:', error);
      return 1;
    }
  }

  // ============================
  // WORK ORDER ITEMS
  // ============================

  async getWorkOrderItems(workOrderId: string): Promise<WorkOrderItem[]> {
    try {
      const result = await this.drizzleDb.select().from(workOrderItems)
        .where(eq(workOrderItems.workOrderId, workOrderId));
      return result as WorkOrderItem[];
    } catch (error) {
      console.error('Error getting work order items:', error);
      return [];
    }
  }

  async createWorkOrderItem(item: InsertWorkOrderItem): Promise<WorkOrderItem> {
    try {
      const [newItem] = await this.drizzleDb.insert(workOrderItems).values({
        workOrderId: item.workOrderId,
        serviceId: item.serviceId ?? null,
        comboId: item.comboId ?? null,
        nombre: item.nombre,
        precio: this.numberToDecimal(item.precio),
        cantidad: item.cantidad ?? 1
      }).returning();
      
      return newItem as WorkOrderItem;
    } catch (error) {
      console.error('Error creating work order item:', error);
      throw error;
    }
  }

  async deleteWorkOrderItem(id: string): Promise<boolean> {
    try {
      await this.drizzleDb.delete(workOrderItems).where(eq(workOrderItems.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting work order item:', error);
      return false;
    }
  }

  async deleteWorkOrderItemsByWorkOrder(workOrderId: string): Promise<void> {
    try {
      await this.drizzleDb.delete(workOrderItems).where(eq(workOrderItems.workOrderId, workOrderId));
    } catch (error) {
      console.error('Error deleting work order items by work order:', error);
    }
  }

  // ============================
  // INVENTORY ITEMS
  // ============================

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    try {
      const result = await this.drizzleDb.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
      return result[0] as InventoryItem | undefined;
    } catch (error) {
      console.error('Error getting inventory item:', error);
      return undefined;
    }
  }

  async getInventoryItems(): Promise<InventoryItem[]> {
    try {
      const result = await this.drizzleDb.select().from(inventoryItems).orderBy(inventoryItems.nombre);
      return result as InventoryItem[];
    } catch (error) {
      console.error('Error getting inventory items:', error);
      return [];
    }
  }

  async getInventoryItemsByAlert(alertStatus: string): Promise<InventoryItem[]> {
    try {
      const result = await this.drizzleDb.select().from(inventoryItems)
        .where(eq(inventoryItems.estadoAlerta, alertStatus as any))
        .orderBy(inventoryItems.nombre);
      return result as InventoryItem[];
    } catch (error) {
      console.error('Error getting inventory items by alert:', error);
      return [];
    }
  }

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    try {
      const [newItem] = await this.drizzleDb.insert(inventoryItems).values({
        nombre: item.nombre,
        descripcion: item.descripcion ?? null,
        precio: this.numberToDecimal(item.precio),
        stockActual: item.stockActual ?? 0,
        stockMinimo: item.stockMinimo ?? 0,
        unidadMedida: item.unidadMedida ?? "unidad",
        categoria: item.categoria,
        proveedor: item.proveedor ?? null,
        ultimoPedido: item.ultimoPedido ?? null,
        estadoAlerta: item.estadoAlerta ?? "normal",
        activo: item.activo ?? true
      }).returning();
      
      return newItem as InventoryItem;
    } catch (error) {
      console.error('Error creating inventory item:', error);
      throw error;
    }
  }

  async updateInventoryItem(id: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    try {
      const updateData: any = { ...item, updatedAt: new Date() };
      if (item.precio !== undefined) {
        updateData.precio = this.numberToDecimal(item.precio);
      }
      
      const [updatedItem] = await this.drizzleDb.update(inventoryItems)
        .set(updateData)
        .where(eq(inventoryItems.id, id))
        .returning();
      
      return updatedItem as InventoryItem | undefined;
    } catch (error) {
      console.error('Error updating inventory item:', error);
      return undefined;
    }
  }

  async deleteInventoryItem(id: string): Promise<boolean> {
    try {
      await this.drizzleDb.delete(inventoryItems).where(eq(inventoryItems.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting inventory item:', error);
      return false;
    }
  }

  async updateInventoryStock(id: string, newStock: number): Promise<InventoryItem | undefined> {
    try {
      const [updatedItem] = await this.drizzleDb.update(inventoryItems)
        .set({ 
          stockActual: newStock,
          estadoAlerta: newStock <= 0 ? "critico" : newStock <= 5 ? "bajo" : "normal",
          updatedAt: new Date() 
        })
        .where(eq(inventoryItems.id, id))
        .returning();
      
      return updatedItem as InventoryItem | undefined;
    } catch (error) {
      console.error('Error updating inventory stock:', error);
      return undefined;
    }
  }

  // ============================
  // SALES
  // ============================

  async getSale(id: string): Promise<Sale | undefined> {
    try {
      const result = await this.drizzleDb.select().from(sales).where(eq(sales.id, id)).limit(1);
      return result[0] as Sale | undefined;
    } catch (error) {
      console.error('Error getting sale:', error);
      return undefined;
    }
  }

  async getSales(): Promise<Sale[]> {
    try {
      const result = await this.drizzleDb.select().from(sales).orderBy(desc(sales.fecha));
      return result as Sale[];
    } catch (error) {
      console.error('Error getting sales:', error);
      return [];
    }
  }

  async getSalesByDateRange(startDate: Date, endDate: Date): Promise<Sale[]> {
    try {
      const result = await this.drizzleDb.select().from(sales)
        .where(between(sales.fecha, startDate, endDate))
        .orderBy(desc(sales.fecha));
      return result as Sale[];
    } catch (error) {
      console.error('Error getting sales by date range:', error);
      return [];
    }
  }

  async getSalesByCustomer(customerId: string): Promise<Sale[]> {
    try {
      const result = await this.drizzleDb.select().from(sales)
        .where(eq(sales.customerId, customerId))
        .orderBy(desc(sales.fecha));
      return result as Sale[];
    } catch (error) {
      console.error('Error getting sales by customer:', error);
      return [];
    }
  }

  async getLastSale(): Promise<Sale | undefined> {
    try {
      const result = await this.drizzleDb.select().from(sales)
        .orderBy(desc(sales.fecha))
        .limit(1);
      return result[0] as Sale | undefined;
    } catch (error) {
      console.error('Error getting last sale:', error);
      return undefined;
    }
  }

  async createSale(sale: InsertSale): Promise<Sale> {
    try {
      const [newSale] = await this.drizzleDb.insert(sales).values({
        numeroFactura: sale.numeroFactura,
        customerId: sale.customerId ?? null,
        workOrderId: sale.workOrderId ?? null,
        fecha: sale.fecha ?? new Date(),
        subtotal: this.numberToDecimal(sale.subtotal),
        impuestos: this.numberToDecimal(sale.impuestos ?? 0),
        total: this.numberToDecimal(sale.total),
        medioPago: sale.medioPago,
        regimenTurismo: sale.regimenTurismo ?? false,
        timbradoUsado: sale.timbradoUsado,
        createdBy: sale.createdBy ?? null
      }).returning();
      
      return newSale as Sale;
    } catch (error) {
      console.error('Error creating sale:', error);
      throw error;
    }
  }

  async updateSale(id: string, sale: Partial<InsertSale>): Promise<Sale | undefined> {
    try {
      const updateData: any = { ...sale, updatedAt: new Date() };
      if (sale.subtotal !== undefined) updateData.subtotal = this.numberToDecimal(sale.subtotal);
      if (sale.impuestos !== undefined) updateData.impuestos = this.numberToDecimal(sale.impuestos);
      if (sale.total !== undefined) updateData.total = this.numberToDecimal(sale.total);
      
      const [updatedSale] = await this.drizzleDb.update(sales)
        .set(updateData)
        .where(eq(sales.id, id))
        .returning();
      
      return updatedSale as Sale | undefined;
    } catch (error) {
      console.error('Error updating sale:', error);
      return undefined;
    }
  }

  async deleteSale(id: string): Promise<boolean> {
    try {
      await this.drizzleDb.delete(sales).where(eq(sales.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting sale:', error);
      return false;
    }
  }

  // ============================
  // SALE ITEMS
  // ============================

  async getSaleItems(saleId: string): Promise<SaleItem[]> {
    try {
      const result = await this.drizzleDb.select().from(saleItems)
        .where(eq(saleItems.saleId, saleId));
      return result as SaleItem[];
    } catch (error) {
      console.error('Error getting sale items:', error);
      return [];
    }
  }

  async createSaleItem(item: InsertSaleItem): Promise<SaleItem> {
    try {
      const [newItem] = await this.drizzleDb.insert(saleItems).values({
        saleId: item.saleId,
        serviceId: item.serviceId ?? null,
        comboId: item.comboId ?? null,
        inventoryItemId: item.inventoryItemId ?? null,
        nombre: item.nombre,
        cantidad: item.cantidad ?? 1,
        precioUnitario: this.numberToDecimal(item.precioUnitario),
        subtotal: this.numberToDecimal(item.subtotal)
      }).returning();
      
      return newItem as SaleItem;
    } catch (error) {
      console.error('Error creating sale item:', error);
      throw error;
    }
  }

  async deleteSaleItem(id: string): Promise<boolean> {
    try {
      await this.drizzleDb.delete(saleItems).where(eq(saleItems.id, id));
      return true;
    } catch (error) {
      console.error('Error deleting sale item:', error);
      return false;
    }
  }

  async deleteSaleItemsBySale(saleId: string): Promise<void> {
    try {
      await this.drizzleDb.delete(saleItems).where(eq(saleItems.saleId, saleId));
    } catch (error) {
      console.error('Error deleting sale items by sale:', error);
    }
  }

  // ============================
  // ENHANCED WORK ORDER MANAGEMENT
  // ============================

  async addWorkOrderItem(workOrderId: string, item: InsertWorkOrderItem): Promise<WorkOrderItem> {
    return this.createWorkOrderItem({ ...item, workOrderId });
  }

  async removeWorkOrderItem(workOrderId: string, itemId: string): Promise<boolean> {
    try {
      await this.drizzleDb.delete(workOrderItems)
        .where(and(eq(workOrderItems.id, itemId), eq(workOrderItems.workOrderId, workOrderId)));
      return true;
    } catch (error) {
      console.error('Error removing work order item:', error);
      return false;
    }
  }

  async updateWorkOrderItem(workOrderId: string, itemId: string, data: Partial<InsertWorkOrderItem>): Promise<WorkOrderItem | undefined> {
    try {
      const updateData: any = { ...data };
      if (data.precio !== undefined) {
        updateData.precio = this.numberToDecimal(data.precio);
      }
      
      const [updatedItem] = await this.drizzleDb.update(workOrderItems)
        .set(updateData)
        .where(and(eq(workOrderItems.id, itemId), eq(workOrderItems.workOrderId, workOrderId)))
        .returning();
      
      return updatedItem as WorkOrderItem | undefined;
    } catch (error) {
      console.error('Error updating work order item:', error);
      return undefined;
    }
  }

  async updateWorkOrderStatus(id: string, status: WorkOrder["estado"]): Promise<WorkOrder | undefined> {
    try {
      const updateData: any = { estado: status, updatedAt: new Date() };
      
      // Set automatic timestamps based on status
      const now = new Date();
      switch (status) {
        case "en_proceso":
          updateData.fechaInicio = now;
          break;
        case "terminado":
          updateData.fechaFin = now;
          break;
        case "entregado":
          updateData.fechaEntrega = now;
          break;
      }
      
      const [updatedOrder] = await this.drizzleDb.update(workOrders)
        .set(updateData)
        .where(eq(workOrders.id, id))
        .returning();
      
      return updatedOrder as WorkOrder | undefined;
    } catch (error) {
      console.error('Error updating work order status:', error);
      return undefined;
    }
  }

  async createSaleFromOrder(workOrderId: string, saleData: Partial<InsertSale>): Promise<Sale> {
    try {
      const workOrder = await this.getWorkOrder(workOrderId);
      if (!workOrder) {
        throw new Error('Work order not found');
      }
      
      const orderItems = await this.getWorkOrderItems(workOrderId);
      const total = saleData.total || workOrder.total;
      
      // Create the sale
      const sale = await this.createSale({
        numeroFactura: saleData.numeroFactura || `WO-${workOrder.numero}`,
        customerId: workOrder.customerId,
        workOrderId: workOrderId,
        subtotal: saleData.subtotal || total,
        impuestos: saleData.impuestos || "0",
        total: total,
        medioPago: saleData.medioPago || "efectivo",
        regimenTurismo: saleData.regimenTurismo || false,
        timbradoUsado: saleData.timbradoUsado || "001",
        createdBy: saleData.createdBy
      });
      
      // Create sale items from work order items
      for (const item of orderItems) {
        await this.createSaleItem({
          saleId: sale.id,
          serviceId: item.serviceId,
          comboId: item.comboId,
          nombre: item.nombre,
          cantidad: item.cantidad,
          precioUnitario: item.precio,
          subtotal: this.numberToDecimal(this.decimalToNumber(item.precio) * item.cantidad)
        });
      }
      
      return sale;
    } catch (error) {
      console.error('Error creating sale from order:', error);
      throw error;
    }
  }
}
}