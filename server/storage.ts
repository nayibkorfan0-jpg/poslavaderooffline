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
import { randomUUID } from "crypto";
import { EncryptionService } from "./encryption";
import { PasswordUtils } from "./password-utils";
import { PostgresStorage } from "./postgres-storage";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  getActiveUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, user: Partial<InternalUpdateUser>): Promise<User | undefined>;
  deactivateUser(id: string): Promise<boolean>;
  incrementUserInvoiceCount(id: string): Promise<User | undefined>;
  resetMonthlyUsage(id: string): Promise<User | undefined>;

  // Company Config
  getCompanyConfig(): Promise<CompanyConfig | undefined>;
  createCompanyConfig(config: InsertCompanyConfig): Promise<CompanyConfig>;
  updateCompanyConfig(id: string, config: Partial<InsertCompanyConfig>): Promise<CompanyConfig | undefined>;

  // Categories
  getCategory(id: string): Promise<Category | undefined>;
  getCategories(): Promise<Category[]>;
  getCategoriesByType(tipo: "servicios" | "productos" | "ambos"): Promise<Category[]>;
  getActiveCategories(): Promise<Category[]>;
  createCategory(category: InsertCategory): Promise<Category>;
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<boolean>;

  // DNIT Config
  getDnitConfig(): Promise<DnitConfig | undefined>;
  createDnitConfig(config: InsertDnitConfig): Promise<DnitConfig>;
  updateDnitConfig(id: string, config: Partial<UpdateDnitConfig>): Promise<DnitConfig | undefined>;
  deleteDnitConfig(id: string): Promise<boolean>;
  testDnitConnection(config: DnitConfig): Promise<{ success: boolean; error?: string }>;

  // Customers
  getCustomer(id: string): Promise<Customer | undefined>;
  getCustomers(): Promise<Customer[]>;
  createCustomer(customer: InsertCustomer): Promise<Customer>;
  updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined>;
  deleteCustomer(id: string): Promise<boolean>;

  // Vehicles
  getVehicle(id: string): Promise<Vehicle | undefined>;
  getVehiclesByCustomer(customerId: string): Promise<Vehicle[]>;
  getAllVehicles(): Promise<Vehicle[]>;
  createVehicle(vehicle: InsertVehicle): Promise<Vehicle>;
  updateVehicle(id: string, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined>;
  deleteVehicle(id: string): Promise<boolean>;

  // Services
  getService(id: string): Promise<Service | undefined>;
  getServices(): Promise<Service[]>;
  getActiveServices(): Promise<Service[]>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, service: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: string): Promise<boolean>;

  // Service Combos
  getServiceCombo(id: string): Promise<ServiceCombo | undefined>;
  getServiceCombos(): Promise<ServiceCombo[]>;
  getActiveServiceCombos(): Promise<ServiceCombo[]>;
  createServiceCombo(combo: InsertServiceCombo): Promise<ServiceCombo>;
  updateServiceCombo(id: string, combo: Partial<InsertServiceCombo>): Promise<ServiceCombo | undefined>;
  deleteServiceCombo(id: string): Promise<boolean>;

  // Service Combo Items
  getServiceComboItems(comboId: string): Promise<ServiceComboItem[]>;
  createServiceComboItem(item: InsertServiceComboItem): Promise<ServiceComboItem>;
  deleteServiceComboItem(id: string): Promise<boolean>;
  deleteServiceComboItemsByCombo(comboId: string): Promise<void>;

  // Work Orders
  getWorkOrder(id: string): Promise<WorkOrder | undefined>;
  getWorkOrders(): Promise<WorkOrder[]>;
  getWorkOrdersByStatus(status: string): Promise<WorkOrder[]>;
  getWorkOrdersByCustomer(customerId: string): Promise<WorkOrder[]>;
  createWorkOrder(workOrder: InsertWorkOrder): Promise<WorkOrder>;
  updateWorkOrder(id: string, workOrder: Partial<InsertWorkOrder>): Promise<WorkOrder | undefined>;
  deleteWorkOrder(id: string): Promise<boolean>;
  getNextWorkOrderNumber(): Promise<number>;

  // Work Order Items
  getWorkOrderItems(workOrderId: string): Promise<WorkOrderItem[]>;
  createWorkOrderItem(item: InsertWorkOrderItem): Promise<WorkOrderItem>;
  deleteWorkOrderItem(id: string): Promise<boolean>;
  deleteWorkOrderItemsByWorkOrder(workOrderId: string): Promise<void>;
  
  // Enhanced WorkOrder Item Management
  addWorkOrderItem(workOrderId: string, item: InsertWorkOrderItem): Promise<WorkOrderItem>;
  removeWorkOrderItem(workOrderId: string, itemId: string): Promise<boolean>;
  updateWorkOrderItem(workOrderId: string, itemId: string, data: Partial<InsertWorkOrderItem>): Promise<WorkOrderItem | undefined>;
  
  // WorkOrder Status Management
  updateWorkOrderStatus(id: string, status: WorkOrder["estado"]): Promise<WorkOrder | undefined>;
  
  // WorkOrder-Sale Integration
  createSaleFromOrder(workOrderId: string, saleData: Partial<InsertSale>): Promise<Sale>;

  // Inventory Items
  getInventoryItem(id: string): Promise<InventoryItem | undefined>;
  getInventoryItems(): Promise<InventoryItem[]>;
  getInventoryItemsByAlert(alertStatus: string): Promise<InventoryItem[]>;
  createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem>;
  updateInventoryItem(id: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined>;
  deleteInventoryItem(id: string): Promise<boolean>;
  updateInventoryStock(id: string, newStock: number): Promise<InventoryItem | undefined>;

  // Sales
  getSale(id: string): Promise<Sale | undefined>;
  getSales(): Promise<Sale[]>;
  getSalesByDateRange(startDate: Date, endDate: Date): Promise<Sale[]>;
  getSalesByCustomer(customerId: string): Promise<Sale[]>;
  getLastSale(): Promise<Sale | undefined>;
  createSale(sale: InsertSale): Promise<Sale>;
  updateSale(id: string, sale: Partial<InsertSale>): Promise<Sale | undefined>;
  deleteSale(id: string): Promise<boolean>;

  // Sale Items
  getSaleItems(saleId: string): Promise<SaleItem[]>;
  createSaleItem(item: InsertSaleItem): Promise<SaleItem>;
  deleteSaleItem(id: string): Promise<boolean>;
  deleteSaleItemsBySale(saleId: string): Promise<void>;
}

/**
 * In-Memory Storage Implementation for Immediate Deployment
 * Provides instant functionality without database dependencies
 */
export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private companyConfigs: Map<string, CompanyConfig>;
  private dnitConfigs: Map<string, DnitConfig>;
  private categories: Map<string, Category>;
  private customers: Map<string, Customer>;
  private vehicles: Map<string, Vehicle>;
  private services: Map<string, Service>;
  private serviceCombos: Map<string, ServiceCombo>;
  private serviceComboItems: Map<string, ServiceComboItem>;
  private workOrders: Map<string, WorkOrder>;
  private workOrderItems: Map<string, WorkOrderItem>;
  private inventoryItems: Map<string, InventoryItem>;
  private sales: Map<string, Sale>;
  private saleItems: Map<string, SaleItem>;
  private nextWorkOrderNumber: number = 1;

  constructor() {
    this.users = new Map();
    this.companyConfigs = new Map();
    this.dnitConfigs = new Map();
    this.categories = new Map();
    this.customers = new Map();
    this.vehicles = new Map();
    this.services = new Map();
    this.serviceCombos = new Map();
    this.serviceComboItems = new Map();
    this.workOrders = new Map();
    this.workOrderItems = new Map();
    this.inventoryItems = new Map();
    this.sales = new Map();
    this.saleItems = new Map();
  }

  /**
   * CRITICAL: Clear all data to ensure clean startup
   * This ensures the system starts completely fresh each time
   */
  async clearAllData(): Promise<void> {
    console.log("🧹 Clearing all data for fresh startup...");
    
    this.companyConfigs.clear();
    this.dnitConfigs.clear();
    this.categories.clear();
    this.customers.clear();
    this.vehicles.clear();
    this.services.clear();
    this.serviceCombos.clear();
    this.serviceComboItems.clear();
    this.workOrders.clear();
    this.workOrderItems.clear();
    this.inventoryItems.clear();
    this.sales.clear();
    this.saleItems.clear();
    
    // Reset counters
    this.nextWorkOrderNumber = 1;
    
    console.log("✓ All data cleared - system starting fresh");
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const now = new Date();
    
    // CRITICAL: Hash password before storing
    const hashedPassword = await PasswordUtils.hashPassword(insertUser.password);
    
    const user: User = { 
      ...insertUser,
      id,
      password: hashedPassword, // Store hashed password, not plain text
      fullName: insertUser.fullName ?? null,
      email: insertUser.email ?? null,
      role: insertUser.role ?? 'user',
      subscriptionType: insertUser.subscriptionType ?? 'free',
      monthlyInvoiceLimit: insertUser.monthlyInvoiceLimit ?? 50,
      expirationDate: insertUser.expirationDate ? new Date(insertUser.expirationDate) : null,
      currentMonthInvoices: 0,
      usageResetDate: now,
      isActive: insertUser.isActive ?? true,
      isBlocked: insertUser.isBlocked ?? false,
      lastLogin: null,
      failedLoginAttempts: 0,
      lastFailedLogin: null,
      createdAt: now,
      updatedAt: now,
      createdBy: insertUser.createdBy ?? null
    };
    this.users.set(id, user);
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email,
    );
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  async getActiveUsers(): Promise<User[]> {
    return Array.from(this.users.values())
      .filter(user => user.isActive && !user.isBlocked)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async updateUser(id: string, updates: Partial<InternalUpdateUser>): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    // CRITICAL: Hash password if it's being updated
    let processedUpdates = { ...updates };
    if ('password' in updates && updates.password) {
      (processedUpdates as any).password = await PasswordUtils.hashPassword(updates.password as string);
    }
    
    const updated: User = {
      ...user,
      ...processedUpdates,
      updatedAt: new Date()
    };
    this.users.set(id, updated);
    return updated;
  }

  async deactivateUser(id: string): Promise<boolean> {
    const user = this.users.get(id);
    if (!user) return false;
    
    const updated: User = {
      ...user,
      isActive: false,
      updatedAt: new Date()
    };
    this.users.set(id, updated);
    return true;
  }

  async incrementUserInvoiceCount(id: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    // Check if we need to reset monthly usage
    const now = new Date();
    const usageResetDate = new Date(user.usageResetDate);
    const monthsDiff = (now.getFullYear() - usageResetDate.getFullYear()) * 12 + 
                       (now.getMonth() - usageResetDate.getMonth());
    
    let currentMonthInvoices = user.currentMonthInvoices;
    let newUsageResetDate = user.usageResetDate;
    
    if (monthsDiff >= 1) {
      // Reset monthly usage
      currentMonthInvoices = 0;
      newUsageResetDate = now;
    }
    
    const updated: User = {
      ...user,
      currentMonthInvoices: currentMonthInvoices + 1,
      usageResetDate: newUsageResetDate,
      updatedAt: now
    };
    this.users.set(id, updated);
    return updated;
  }

  async resetMonthlyUsage(id: string): Promise<User | undefined> {
    const user = this.users.get(id);
    if (!user) return undefined;
    
    const updated: User = {
      ...user,
      currentMonthInvoices: 0,
      usageResetDate: new Date(),
      updatedAt: new Date()
    };
    this.users.set(id, updated);
    return updated;
  }

  // Company Config
  async getCompanyConfig(): Promise<CompanyConfig | undefined> {
    return Array.from(this.companyConfigs.values())[0]; // Should only be one
  }

  async createCompanyConfig(insertConfig: InsertCompanyConfig): Promise<CompanyConfig> {
    const id = randomUUID();
    const now = new Date();
    const config: CompanyConfig = { 
      ...insertConfig,
      nombreFantasia: insertConfig.nombreFantasia ?? null,
      telefono: insertConfig.telefono ?? null,
      email: insertConfig.email ?? null,
      logoPath: insertConfig.logoPath ?? null,
      establecimiento: insertConfig.establecimiento ?? "001",
      puntoExpedicion: insertConfig.puntoExpedicion ?? "001",
      ciudad: insertConfig.ciudad ?? "Asunción",
      moneda: insertConfig.moneda ?? "PYG",
      id,
      createdAt: now,
      updatedAt: now
    };
    this.companyConfigs.set(id, config);
    return config;
  }

  async updateCompanyConfig(id: string, updates: Partial<InsertCompanyConfig>): Promise<CompanyConfig | undefined> {
    const config = this.companyConfigs.get(id);
    if (!config) return undefined;
    
    const updated: CompanyConfig = {
      ...config,
      ...updates,
      updatedAt: new Date()
    };
    this.companyConfigs.set(id, updated);
    return updated;
  }

  // Categories
  async getCategory(id: string): Promise<Category | undefined> {
    return this.categories.get(id);
  }

  async getCategories(): Promise<Category[]> {
    return Array.from(this.categories.values());
  }

  async getCategoriesByType(tipo: "servicios" | "productos" | "ambos"): Promise<Category[]> {
    return Array.from(this.categories.values())
      .filter(cat => cat.tipo === tipo || cat.tipo === "ambos");
  }

  async getActiveCategories(): Promise<Category[]> {
    return Array.from(this.categories.values())
      .filter(cat => cat.activa);
  }

  async createCategory(insertCategory: InsertCategory): Promise<Category> {
    const id = randomUUID();
    const now = new Date();
    const category: Category = {
      ...insertCategory,
      descripcion: insertCategory.descripcion ?? null,
      tipo: insertCategory.tipo ?? "ambos",
      color: insertCategory.color ?? null,
      activa: insertCategory.activa ?? true,
      id,
      createdAt: now,
      updatedAt: now
    };
    this.categories.set(id, category);
    return category;
  }

  async updateCategory(id: string, updates: Partial<InsertCategory>): Promise<Category | undefined> {
    const category = this.categories.get(id);
    if (!category) return undefined;

    const updated: Category = {
      ...category,
      ...updates,
      updatedAt: new Date()
    };
    this.categories.set(id, updated);
    return updated;
  }

  async deleteCategory(id: string): Promise<boolean> {
    return this.categories.delete(id);
  }

  // DNIT Config
  async getDnitConfig(): Promise<DnitConfig | undefined> {
    const config = Array.from(this.dnitConfigs.values())[0]; // Should only be one
    if (!config) return undefined;
    
    // Decrypt sensitive fields before returning
    return {
      ...config,
      authToken: EncryptionService.decrypt(config.authToken),
      certificatePassword: config.certificatePassword ? EncryptionService.decrypt(config.certificatePassword) : null
    };
  }

  async createDnitConfig(insertConfig: InsertDnitConfig): Promise<DnitConfig> {
    const id = randomUUID();
    const now = new Date();
    
    // Encrypt sensitive fields before storing
    const config: DnitConfig = { 
      ...insertConfig,
      authToken: EncryptionService.encrypt(insertConfig.authToken),
      certificateData: insertConfig.certificateData ?? null,
      certificatePassword: insertConfig.certificatePassword 
        ? EncryptionService.encrypt(insertConfig.certificatePassword)
        : null,
      operationMode: insertConfig.operationMode ?? "testing",
      isActive: insertConfig.isActive ?? false,
      lastConnectionTest: null,
      lastConnectionStatus: null,
      lastConnectionError: null,
      id,
      createdAt: now,
      updatedAt: now
    };
    
    // Store encrypted version
    this.dnitConfigs.set(id, config);
    
    // Return decrypted version to caller
    return {
      ...config,
      authToken: insertConfig.authToken,
      certificatePassword: insertConfig.certificatePassword ?? null
    };
  }

  async updateDnitConfig(id: string, updates: Partial<UpdateDnitConfig>): Promise<DnitConfig | undefined> {
    const config = this.dnitConfigs.get(id);
    if (!config) return undefined;
    
    // Encrypt sensitive fields if they're being updated
    let processedUpdates = { ...updates };
    if ('authToken' in updates && updates.authToken) {
      (processedUpdates as any).authToken = EncryptionService.encrypt(updates.authToken);
    }
    if ('certificatePassword' in updates && updates.certificatePassword) {
      (processedUpdates as any).certificatePassword = EncryptionService.encrypt(updates.certificatePassword);
    }
    
    const updated: DnitConfig = {
      ...config,
      ...processedUpdates,
      updatedAt: new Date()
    };
    this.dnitConfigs.set(id, updated);
    
    // Return decrypted version
    return {
      ...updated,
      authToken: updates.authToken || EncryptionService.decrypt(updated.authToken),
      certificatePassword: updated.certificatePassword ? EncryptionService.decrypt(updated.certificatePassword) : null
    };
  }

  async deleteDnitConfig(id: string): Promise<boolean> {
    return this.dnitConfigs.delete(id);
  }

  async testDnitConnection(config: DnitConfig): Promise<{ success: boolean; error?: string }> {
    // Placeholder implementation for DNIT connection testing
    // In a real implementation, this would test the actual connection to DNIT services
    try {
      // Simulate connection test
      const isValidUrl = config.endpointUrl && config.endpointUrl.startsWith('http');
      const hasToken = config.authToken && config.authToken.length > 0;
      
      if (!isValidUrl) {
        return { success: false, error: "URL del endpoint inválida" };
      }
      
      if (!hasToken) {
        return { success: false, error: "Token de autenticación requerido" };
      }
      
      // Simulate successful connection
      return { success: true };
    } catch (error) {
      return { success: false, error: `Error de conexión: ${error}` };
    }
  }

  // Continue with simplified implementations for all other entities...
  // For immediate deployment, we'll implement basic CRUD operations

  // Customers
  async getCustomer(id: string): Promise<Customer | undefined> {
    return this.customers.get(id);
  }

  async getCustomers(): Promise<Customer[]> {
    return Array.from(this.customers.values());
  }

  async createCustomer(insertCustomer: InsertCustomer): Promise<Customer> {
    const id = randomUUID();
    const now = new Date();
    const customer: Customer = { 
      ...insertCustomer,
      id,
      email: insertCustomer.email ?? null,
      telefono: insertCustomer.telefono ?? null,
      direccion: insertCustomer.direccion ?? null,
      docTipo: insertCustomer.docTipo ?? "CI",
      regimenTurismo: insertCustomer.regimenTurismo ?? false,
      pais: insertCustomer.pais ?? null,
      pasaporte: insertCustomer.pasaporte ?? null,
      fechaIngreso: insertCustomer.fechaIngreso ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.customers.set(id, customer);
    return customer;
  }

  async updateCustomer(id: string, updates: Partial<InsertCustomer>): Promise<Customer | undefined> {
    const customer = this.customers.get(id);
    if (!customer) return undefined;
    
    const updated: Customer = {
      ...customer,
      ...updates,
      updatedAt: new Date()
    };
    this.customers.set(id, updated);
    return updated;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    return this.customers.delete(id);
  }

  // Vehicles
  async getVehicle(id: string): Promise<Vehicle | undefined> {
    return this.vehicles.get(id);
  }

  async getVehiclesByCustomer(customerId: string): Promise<Vehicle[]> {
    return Array.from(this.vehicles.values()).filter(
      vehicle => vehicle.customerId === customerId
    );
  }

  async getAllVehicles(): Promise<Vehicle[]> {
    return Array.from(this.vehicles.values());
  }

  async createVehicle(insertVehicle: InsertVehicle): Promise<Vehicle> {
    const id = randomUUID();
    const now = new Date();
    const vehicle: Vehicle = { 
      ...insertVehicle,
      id,
      observaciones: insertVehicle.observaciones ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.vehicles.set(id, vehicle);
    return vehicle;
  }

  async updateVehicle(id: string, updates: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const vehicle = this.vehicles.get(id);
    if (!vehicle) return undefined;
    
    const updated: Vehicle = {
      ...vehicle,
      ...updates,
      updatedAt: new Date()
    };
    this.vehicles.set(id, updated);
    return updated;
  }

  async deleteVehicle(id: string): Promise<boolean> {
    return this.vehicles.delete(id);
  }

  // Services
  async getService(id: string): Promise<Service | undefined> {
    return this.services.get(id);
  }

  async getServices(): Promise<Service[]> {
    return Array.from(this.services.values());
  }

  async getActiveServices(): Promise<Service[]> {
    return Array.from(this.services.values()).filter(service => service.activo);
  }

  async createService(insertService: InsertService): Promise<Service> {
    const id = randomUUID();
    const now = new Date();
    const service: Service = { 
      ...insertService,
      precio: typeof insertService.precio === 'number' ? insertService.precio.toString() : insertService.precio,
      id,
      descripcion: insertService.descripcion ?? null,
      activo: insertService.activo ?? true,
      createdAt: now,
      updatedAt: now
    };
    this.services.set(id, service);
    return service;
  }

  async updateService(id: string, updates: Partial<InsertService>): Promise<Service | undefined> {
    const service = this.services.get(id);
    if (!service) return undefined;
    
    const updated: Service = {
      ...service,
      ...updates,
      precio: updates.precio ? (typeof updates.precio === 'number' ? updates.precio.toString() : updates.precio) : service.precio,
      updatedAt: new Date()
    };
    this.services.set(id, updated);
    return updated;
  }

  async deleteService(id: string): Promise<boolean> {
    return this.services.delete(id);
  }

  // Service Combos
  async getServiceCombo(id: string): Promise<ServiceCombo | undefined> {
    return this.serviceCombos.get(id);
  }

  async getServiceCombos(): Promise<ServiceCombo[]> {
    return Array.from(this.serviceCombos.values());
  }

  async getActiveServiceCombos(): Promise<ServiceCombo[]> {
    return Array.from(this.serviceCombos.values()).filter(combo => combo.activo);
  }

  async createServiceCombo(insertCombo: InsertServiceCombo): Promise<ServiceCombo> {
    const id = randomUUID();
    const now = new Date();
    const combo: ServiceCombo = { 
      ...insertCombo,
      precioTotal: typeof insertCombo.precioTotal === 'number' ? insertCombo.precioTotal.toString() : insertCombo.precioTotal,
      id,
      descripcion: insertCombo.descripcion ?? null,
      activo: insertCombo.activo ?? true,
      createdAt: now,
      updatedAt: now
    };
    this.serviceCombos.set(id, combo);
    return combo;
  }

  async updateServiceCombo(id: string, updates: Partial<InsertServiceCombo>): Promise<ServiceCombo | undefined> {
    const combo = this.serviceCombos.get(id);
    if (!combo) return undefined;
    
    const updated: ServiceCombo = {
      ...combo,
      ...updates,
      precioTotal: updates.precioTotal ? (typeof updates.precioTotal === 'number' ? updates.precioTotal.toString() : updates.precioTotal) : combo.precioTotal,
      updatedAt: new Date()
    };
    this.serviceCombos.set(id, updated);
    return updated;
  }

  async deleteServiceCombo(id: string): Promise<boolean> {
    return this.serviceCombos.delete(id);
  }

  // Service Combo Items
  async getServiceComboItems(comboId: string): Promise<ServiceComboItem[]> {
    return Array.from(this.serviceComboItems.values()).filter(
      item => item.comboId === comboId
    );
  }

  async createServiceComboItem(insertItem: InsertServiceComboItem): Promise<ServiceComboItem> {
    const id = randomUUID();
    const item: ServiceComboItem = { ...insertItem, id };
    this.serviceComboItems.set(id, item);
    return item;
  }

  async deleteServiceComboItem(id: string): Promise<boolean> {
    return this.serviceComboItems.delete(id);
  }

  async deleteServiceComboItemsByCombo(comboId: string): Promise<void> {
    const itemsToDelete = Array.from(this.serviceComboItems.entries())
      .filter(([_, item]) => item.comboId === comboId)
      .map(([id, _]) => id);
    
    itemsToDelete.forEach(id => this.serviceComboItems.delete(id));
  }

  // Work Orders
  async getWorkOrder(id: string): Promise<WorkOrder | undefined> {
    return this.workOrders.get(id);
  }

  async getWorkOrders(): Promise<WorkOrder[]> {
    return Array.from(this.workOrders.values());
  }

  async getWorkOrdersByStatus(status: string): Promise<WorkOrder[]> {
    return Array.from(this.workOrders.values()).filter(
      order => order.estado === status
    );
  }

  async getWorkOrdersByCustomer(customerId: string): Promise<WorkOrder[]> {
    return Array.from(this.workOrders.values()).filter(
      order => order.customerId === customerId
    );
  }

  async createWorkOrder(insertWorkOrder: InsertWorkOrder): Promise<WorkOrder> {
    const id = randomUUID();
    const now = new Date();
    const workOrder: WorkOrder = { 
      ...insertWorkOrder,
      id,
      numero: this.nextWorkOrderNumber++,
      estado: insertWorkOrder.estado ?? "recibido",
      fechaEntrada: insertWorkOrder.fechaEntrada ?? now,
      fechaInicio: insertWorkOrder.fechaInicio ?? null,
      fechaFin: insertWorkOrder.fechaFin ?? null,
      fechaEntrega: insertWorkOrder.fechaEntrega ?? null,
      observaciones: insertWorkOrder.observaciones ?? null,
      total: insertWorkOrder.total ?? "0",
      createdAt: now,
      updatedAt: now
    };
    this.workOrders.set(id, workOrder);
    return workOrder;
  }

  async updateWorkOrder(id: string, updates: Partial<InsertWorkOrder>): Promise<WorkOrder | undefined> {
    const workOrder = this.workOrders.get(id);
    if (!workOrder) return undefined;
    
    const updated: WorkOrder = {
      ...workOrder,
      ...updates,
      updatedAt: new Date()
    };
    this.workOrders.set(id, updated);
    return updated;
  }

  async deleteWorkOrder(id: string): Promise<boolean> {
    // First delete all associated work order items (cascade delete)
    await this.deleteWorkOrderItemsByWorkOrder(id);
    
    // Then delete the work order itself
    return this.workOrders.delete(id);
  }

  async getNextWorkOrderNumber(): Promise<number> {
    return this.nextWorkOrderNumber;
  }

  // Work Order Items
  async getWorkOrderItems(workOrderId: string): Promise<WorkOrderItem[]> {
    return Array.from(this.workOrderItems.values()).filter(
      item => item.workOrderId === workOrderId
    );
  }

  async createWorkOrderItem(insertItem: InsertWorkOrderItem): Promise<WorkOrderItem> {
    const id = randomUUID();
    const item: WorkOrderItem = { 
      ...insertItem,
      serviceId: insertItem.serviceId ?? null,
      comboId: insertItem.comboId ?? null,
      id 
    };
    this.workOrderItems.set(id, item);
    return item;
  }

  async deleteWorkOrderItem(id: string): Promise<boolean> {
    return this.workOrderItems.delete(id);
  }

  async deleteWorkOrderItemsByWorkOrder(workOrderId: string): Promise<void> {
    const itemsToDelete = Array.from(this.workOrderItems.entries())
      .filter(([_, item]) => item.workOrderId === workOrderId)
      .map(([id, _]) => id);
    
    itemsToDelete.forEach(id => this.workOrderItems.delete(id));
  }

  /**
   * Helper method to calculate WorkOrder total from all its items
   * Validates prices to prevent NaN in totals
   */
  private async calculateWorkOrderTotal(workOrderId: string): Promise<string> {
    const items = await this.getWorkOrderItems(workOrderId);
    const total = items.reduce((sum, item) => {
      // Validate price - treat invalid prices as 0
      const price = parseFloat(item.precio);
      const validPrice = isNaN(price) || !isFinite(price) ? 0 : price;
      
      // Validate quantity - ensure it's a positive number
      const validQuantity = Math.max(0, item.cantidad || 0);
      
      const itemTotal = validPrice * validQuantity;
      return sum + itemTotal;
    }, 0);
    
    return total.toFixed(2);
  }

  /**
   * Helper method to update WorkOrder total and return updated WorkOrder
   */
  private async updateWorkOrderTotal(workOrderId: string): Promise<WorkOrder | undefined> {
    const newTotal = await this.calculateWorkOrderTotal(workOrderId);
    return this.updateWorkOrder(workOrderId, { total: newTotal });
  }

  // Enhanced WorkOrder Item Management
  async addWorkOrderItem(workOrderId: string, item: InsertWorkOrderItem): Promise<WorkOrderItem> {
    // Verify WorkOrder exists
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) {
      throw new Error(`WorkOrder with id ${workOrderId} not found`);
    }
    
    // Create the item
    const createdItem = await this.createWorkOrderItem({
      ...item,
      workOrderId
    });
    
    // Update WorkOrder total
    await this.updateWorkOrderTotal(workOrderId);
    
    return createdItem;
  }

  async removeWorkOrderItem(workOrderId: string, itemId: string): Promise<boolean> {
    // Verify the item belongs to this WorkOrder
    const item = this.workOrderItems.get(itemId);
    if (!item || item.workOrderId !== workOrderId) {
      return false;
    }
    
    // Delete the item
    const deleted = await this.deleteWorkOrderItem(itemId);
    
    if (deleted) {
      // Update WorkOrder total
      await this.updateWorkOrderTotal(workOrderId);
    }
    
    return deleted;
  }

  async updateWorkOrderItem(workOrderId: string, itemId: string, data: Partial<InsertWorkOrderItem>): Promise<WorkOrderItem | undefined> {
    // Verify the item exists and belongs to this WorkOrder
    const existingItem = this.workOrderItems.get(itemId);
    if (!existingItem || existingItem.workOrderId !== workOrderId) {
      return undefined;
    }
    
    // Update the item
    const updated: WorkOrderItem = {
      ...existingItem,
      ...data,
      // Ensure workOrderId and id cannot be changed
      id: existingItem.id,
      workOrderId: existingItem.workOrderId
    };
    
    this.workOrderItems.set(itemId, updated);
    
    // Update WorkOrder total if price or quantity changed
    if ('precio' in data || 'cantidad' in data) {
      await this.updateWorkOrderTotal(workOrderId);
    }
    
    return updated;
  }

  // WorkOrder Status Management
  async updateWorkOrderStatus(id: string, status: WorkOrder["estado"]): Promise<WorkOrder | undefined> {
    const workOrder = this.workOrders.get(id);
    if (!workOrder) return undefined;
    
    const now = new Date();
    let updates: Partial<WorkOrder> = {
      estado: status,
      updatedAt: now
    };
    
    // Set appropriate timestamps based on status transitions
    switch (status) {
      case "en_proceso":
        if (!workOrder.fechaInicio) {
          updates.fechaInicio = now;
        }
        break;
      case "terminado":
        if (!workOrder.fechaFin) {
          updates.fechaFin = now;
        }
        break;
      case "entregado":
        if (!workOrder.fechaEntrega) {
          updates.fechaEntrega = now;
        }
        break;
    }
    
    const updated: WorkOrder = {
      ...workOrder,
      ...updates
    };
    
    this.workOrders.set(id, updated);
    return updated;
  }

  // WorkOrder-Sale Integration
  async createSaleFromOrder(workOrderId: string, saleData: Partial<InsertSale>): Promise<Sale> {
    // Verify WorkOrder exists
    const workOrder = this.workOrders.get(workOrderId);
    if (!workOrder) {
      throw new Error(`WorkOrder with id ${workOrderId} not found`);
    }
    
    // Get WorkOrder items to create sale items
    const workOrderItems = await this.getWorkOrderItems(workOrderId);
    
    // Calculate sale totals from WorkOrder if not provided
    const subtotal = saleData.subtotal || workOrder.total;
    const impuestos = saleData.impuestos || "0";
    const total = saleData.total || workOrder.total;
    
    // Create the sale with WorkOrder connection
    const sale = await this.createSale({
      numeroFactura: saleData.numeroFactura || `WO-${workOrder.numero}`,
      customerId: workOrder.customerId,
      workOrderId: workOrderId,
      fecha: saleData.fecha || new Date(),
      subtotal,
      impuestos,
      total,
      medioPago: saleData.medioPago || "efectivo",
      regimenTurismo: saleData.regimenTurismo || false,
      timbradoUsado: saleData.timbradoUsado || "123456789",
      createdBy: saleData.createdBy || null
    });
    
    // Create sale items from work order items
    for (const woItem of workOrderItems) {
      await this.createSaleItem({
        saleId: sale.id,
        serviceId: woItem.serviceId,
        comboId: woItem.comboId,
        inventoryItemId: null,
        nombre: woItem.nombre,
        cantidad: woItem.cantidad,
        precioUnitario: woItem.precio,
        subtotal: (parseFloat(woItem.precio) * woItem.cantidad).toFixed(2)
      });
    }
    
    return sale;
  }

  // Inventory Items
  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    return this.inventoryItems.get(id);
  }

  async getInventoryItems(): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values());
  }

  async getInventoryItemsByAlert(alertStatus: string): Promise<InventoryItem[]> {
    return Array.from(this.inventoryItems.values()).filter(
      item => item.estadoAlerta === alertStatus
    );
  }

  async createInventoryItem(insertItem: InsertInventoryItem): Promise<InventoryItem> {
    const id = randomUUID();
    const now = new Date();
    const item: InventoryItem = { 
      ...insertItem,
      id,
      descripcion: insertItem.descripcion ?? null,
      unidadMedida: insertItem.unidadMedida ?? "UN",
      proveedor: insertItem.proveedor ?? null,
      ultimoPedido: insertItem.ultimoPedido ?? null,
      estadoAlerta: insertItem.estadoAlerta ?? "normal",
      activo: insertItem.activo ?? true,
      createdAt: now,
      updatedAt: now
    };
    this.inventoryItems.set(id, item);
    return item;
  }

  async updateInventoryItem(id: string, updates: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const item = this.inventoryItems.get(id);
    if (!item) return undefined;
    
    const updated: InventoryItem = {
      ...item,
      ...updates,
      updatedAt: new Date()
    };
    this.inventoryItems.set(id, updated);
    return updated;
  }

  async deleteInventoryItem(id: string): Promise<boolean> {
    return this.inventoryItems.delete(id);
  }

  async updateInventoryStock(id: string, newStock: number): Promise<InventoryItem | undefined> {
    return this.updateInventoryItem(id, { stockActual: newStock });
  }

  // Sales
  async getSale(id: string): Promise<Sale | undefined> {
    return this.sales.get(id);
  }

  async getSales(): Promise<Sale[]> {
    return Array.from(this.sales.values());
  }

  async getSalesByDateRange(startDate: Date, endDate: Date): Promise<Sale[]> {
    return Array.from(this.sales.values()).filter(sale => {
      const saleDate = new Date(sale.fecha);
      return saleDate >= startDate && saleDate <= endDate;
    });
  }

  async getSalesByCustomer(customerId: string): Promise<Sale[]> {
    return Array.from(this.sales.values()).filter(
      sale => sale.customerId === customerId
    );
  }

  async getLastSale(): Promise<Sale | undefined> {
    const sales = Array.from(this.sales.values());
    return sales.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }

  async createSale(insertSale: InsertSale): Promise<Sale> {
    const id = randomUUID();
    const now = new Date();
    const sale: Sale = { 
      ...insertSale,
      id,
      customerId: insertSale.customerId ?? null,
      workOrderId: insertSale.workOrderId ?? null,
      fecha: insertSale.fecha ?? now,
      impuestos: insertSale.impuestos ?? "0",
      regimenTurismo: insertSale.regimenTurismo ?? false,
      createdBy: insertSale.createdBy ?? null,
      createdAt: now,
      updatedAt: now
    };
    this.sales.set(id, sale);
    return sale;
  }

  async updateSale(id: string, updates: Partial<InsertSale>): Promise<Sale | undefined> {
    const sale = this.sales.get(id);
    if (!sale) return undefined;
    
    const updated: Sale = {
      ...sale,
      ...updates,
      updatedAt: new Date()
    };
    this.sales.set(id, updated);
    return updated;
  }

  async deleteSale(id: string): Promise<boolean> {
    // First delete all associated sale items (cascade delete)
    await this.deleteSaleItemsBySale(id);
    
    // Then delete the sale itself
    return this.sales.delete(id);
  }

  // Sale Items
  async getSaleItems(saleId: string): Promise<SaleItem[]> {
    return Array.from(this.saleItems.values()).filter(
      item => item.saleId === saleId
    );
  }

  async createSaleItem(insertItem: InsertSaleItem): Promise<SaleItem> {
    const id = randomUUID();
    const item: SaleItem = { 
      ...insertItem,
      serviceId: insertItem.serviceId ?? null,
      comboId: insertItem.comboId ?? null,
      inventoryItemId: insertItem.inventoryItemId ?? null,
      id 
    };
    this.saleItems.set(id, item);
    return item;
  }

  async deleteSaleItem(id: string): Promise<boolean> {
    return this.saleItems.delete(id);
  }

  async deleteSaleItemsBySale(saleId: string): Promise<void> {
    const itemsToDelete = Array.from(this.saleItems.entries())
      .filter(([_, item]) => item.saleId === saleId)
      .map(([id, _]) => id);
    
    itemsToDelete.forEach(id => this.saleItems.delete(id));
  }
}

// Bootstrap admin user function - ALWAYS starts clean
async function bootstrapAdminUser(storage: MemStorage): Promise<void> {
  try {
    // CRITICAL: Clear ALL data for fresh startup
    await storage.clearAllData();
    
    console.log("🚀 Creating initial admin user...");
    
    // Create admin user only if it doesn't exist
    const adminUser = await storage.createUser({
      username: "Admin",
      password: "aurum1705", // Will be hashed by storage layer
      fullName: "Administrator",
      email: "admin@aurum.spa",
      role: "admin",
      subscriptionType: "enterprise",
      monthlyInvoiceLimit: 10000,
      isActive: true,
      isBlocked: false
    });

    console.log("✅ Initial admin user created successfully");

    console.log("📁 Creating default categories...");
    
    // Create default categories for services
    await storage.createCategory({
      nombre: "Lavado Exterior",
      descripcion: "Servicios de lavado exterior del vehículo",
      tipo: "servicios",
      color: "#3B82F6",
      activa: true
    });

    await storage.createCategory({
      nombre: "Lavado Interior",
      descripcion: "Servicios de limpieza interior del vehículo",
      tipo: "servicios", 
      color: "#10B981",
      activa: true
    });

    await storage.createCategory({
      nombre: "Encerado y Pulido",
      descripcion: "Servicios de encerado y pulido del vehículo",
      tipo: "servicios",
      color: "#F59E0B",
      activa: true
    });

    // Create default categories for products
    await storage.createCategory({
      nombre: "Productos de Limpieza",
      descripcion: "Productos químicos para limpieza de vehículos",
      tipo: "productos",
      color: "#EF4444",
      activa: true
    });

    await storage.createCategory({
      nombre: "Accesorios",
      descripcion: "Accesorios y herramientas para el lavadero",
      tipo: "productos",
      color: "#8B5CF6",
      activa: true
    });

    await storage.createCategory({
      nombre: "General",
      descripcion: "Categoría general para servicios y productos diversos",
      tipo: "ambos",
      color: "#6B7280",
      activa: true
    });

    console.log("✅ Default categories created successfully");
    console.log("🎯 System ready!");
  } catch (error) {
    console.error("❌ Failed to create admin user:", error);
  }
}

// Create PostgresStorage instance for database persistence
const postgresStorageInstance = new PostgresStorage();

// Initialize admin user on startup
postgresStorageInstance.initializeAdminUser().catch((error) => {
  console.error("Failed to initialize admin user:", error);
});

// Export the PostgresStorage instance for persistent storage
export const storage = postgresStorageInstance;