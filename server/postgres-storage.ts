import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { eq, desc, and, or, gte, lte, between, inArray } from "drizzle-orm";
import {
  users,
  companyConfigs,
  dnitConfigs,
  categories,
  customers,
  vehicles,
  services,
  serviceCombos,
  serviceComboItems,
  workOrders,
  workOrderItems,
  inventoryItems,
  sales,
  saleItems
} from "@shared/schema";
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
import { IStorage } from "./storage";
import { PasswordUtils } from "./password-utils";
import { EncryptionService } from "./encryption";

/**
 * PostgreSQL Storage Implementation using Drizzle ORM
 * Provides persistent storage using the PostgreSQL database
 */
export class PostgresStorage implements IStorage {
  private db;
  
  constructor() {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is not set");
    }
    
    const sql = neon(databaseUrl);
    this.db = drizzle(sql);
    
    console.log("🐘 PostgreSQL storage initialized");
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
    const result = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return result[0] as User | undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.username, username)).limit(1);
    return result[0] as User | undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await this.db.select().from(users).where(eq(users.email, email)).limit(1);
    return result[0] as User | undefined;
  }

  async getUsers(): Promise<User[]> {
    const result = await this.db.select().from(users).orderBy(desc(users.createdAt));
    return result as User[];
  }

  async getActiveUsers(): Promise<User[]> {
    const result = await this.db.select().from(users)
      .where(eq(users.isActive, true))
      .orderBy(desc(users.createdAt));
    return result as User[];
  }

  async createUser(user: InsertUser): Promise<User> {
    const hashedPassword = await PasswordUtils.hashPassword(user.password);
    
    const [newUser] = await this.db.insert(users).values({
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
  }

  async updateUser(id: string, user: Partial<InternalUpdateUser>): Promise<User | undefined> {
    const updateData: any = { ...user, updatedAt: new Date() };
    
    if (user.password) {
      updateData.password = await PasswordUtils.hashPassword(user.password);
    }
    
    const [updatedUser] = await this.db.update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser as User | undefined;
  }

  async deactivateUser(id: string): Promise<boolean> {
    const result = await this.db.update(users)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(users.id, id));
    
    return true;
  }

  async incrementUserInvoiceCount(id: string): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const [updatedUser] = await this.db.update(users)
      .set({ 
        currentMonthInvoices: user.currentMonthInvoices + 1,
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser as User;
  }

  async resetMonthlyUsage(id: string): Promise<User | undefined> {
    const [updatedUser] = await this.db.update(users)
      .set({ 
        currentMonthInvoices: 0,
        usageResetDate: new Date(),
        updatedAt: new Date()
      })
      .where(eq(users.id, id))
      .returning();
    
    return updatedUser as User | undefined;
  }

  // ============================
  // COMPANY CONFIG
  // ============================

  async getCompanyConfig(): Promise<CompanyConfig | undefined> {
    const result = await this.db.select().from(companyConfigs).limit(1);
    return result[0] as CompanyConfig | undefined;
  }

  async createCompanyConfig(config: InsertCompanyConfig): Promise<CompanyConfig> {
    const [newConfig] = await this.db.insert(companyConfigs).values({
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
  }

  async updateCompanyConfig(id: string, config: Partial<InsertCompanyConfig>): Promise<CompanyConfig | undefined> {
    const [updatedConfig] = await this.db.update(companyConfigs)
      .set({ ...config, updatedAt: new Date() })
      .where(eq(companyConfigs.id, id))
      .returning();
    
    return updatedConfig as CompanyConfig | undefined;
  }

  // ============================
  // DNIT CONFIG
  // ============================

  async getDnitConfig(): Promise<DnitConfig | undefined> {
    const result = await this.db.select().from(dnitConfigs).limit(1);
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
  }

  async createDnitConfig(config: InsertDnitConfig): Promise<DnitConfig> {
    // Encrypt sensitive data
    const encryptedAuthToken = await EncryptionService.encrypt(config.authToken);
    const encryptedCertPassword = config.certificatePassword ? await EncryptionService.encrypt(config.certificatePassword) : null;
    
    const [newConfig] = await this.db.insert(dnitConfigs).values({
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
  }

  async updateDnitConfig(id: string, config: Partial<UpdateDnitConfig>): Promise<DnitConfig | undefined> {
    const updateData: any = { ...config, updatedAt: new Date() };
    
    if (config.authToken) {
      updateData.authToken = await EncryptionService.encrypt(config.authToken);
    }
    
    if (config.certificatePassword) {
      updateData.certificatePassword = await EncryptionService.encrypt(config.certificatePassword);
    }
    
    const [updatedConfig] = await this.db.update(dnitConfigs)
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
  }

  async deleteDnitConfig(id: string): Promise<boolean> {
    await this.db.delete(dnitConfigs).where(eq(dnitConfigs.id, id));
    return true;
  }

  async testDnitConnection(config: DnitConfig): Promise<{ success: boolean; error?: string }> {
    // Implementation would depend on actual DNIT API testing
    return { success: true };
  }

  // ============================
  // CATEGORIES
  // ============================

  async getCategory(id: string): Promise<Category | undefined> {
    const result = await this.db.select().from(categories).where(eq(categories.id, id)).limit(1);
    return result[0] as Category | undefined;
  }

  async getCategories(): Promise<Category[]> {
    const result = await this.db.select().from(categories).orderBy(categories.nombre);
    return result as Category[];
  }

  async getCategoriesByType(tipo: "servicios" | "productos" | "ambos"): Promise<Category[]> {
    const result = await this.db.select().from(categories)
      .where(or(eq(categories.tipo, tipo), eq(categories.tipo, "ambos")))
      .orderBy(categories.nombre);
    return result as Category[];
  }

  async getActiveCategories(): Promise<Category[]> {
    const result = await this.db.select().from(categories)
      .where(eq(categories.activa, true))
      .orderBy(categories.nombre);
    return result as Category[];
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await this.db.insert(categories).values({
      nombre: category.nombre,
      descripcion: category.descripcion ?? null,
      tipo: category.tipo ?? "ambos",
      color: category.color ?? null,
      activa: category.activa ?? true
    }).returning();
    
    return newCategory as Category;
  }

  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updatedCategory] = await this.db.update(categories)
      .set({ ...category, updatedAt: new Date() })
      .where(eq(categories.id, id))
      .returning();
    
    return updatedCategory as Category | undefined;
  }

  async deleteCategory(id: string): Promise<boolean> {
    await this.db.delete(categories).where(eq(categories.id, id));
    return true;
  }

  // ============================
  // CUSTOMERS
  // ============================

  async getCustomer(id: string): Promise<Customer | undefined> {
    const result = await this.db.select().from(customers).where(eq(customers.id, id)).limit(1);
    return result[0] as Customer | undefined;
  }

  async getCustomers(): Promise<Customer[]> {
    const result = await this.db.select().from(customers).orderBy(customers.nombre);
    return result as Customer[];
  }

  async createCustomer(customer: InsertCustomer): Promise<Customer> {
    // Process fechaIngreso to ensure consistent date format
    const processedFechaIngreso = customer.fechaIngreso 
      ? (typeof customer.fechaIngreso === 'string' 
          ? new Date(customer.fechaIngreso).toISOString().split('T')[0] // Extract just YYYY-MM-DD 
          : new Date(customer.fechaIngreso).toISOString().split('T')[0])
      : null;
    
    const [newCustomer] = await this.db.insert(customers).values({
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
  }

  async updateCustomer(id: string, customer: Partial<InsertCustomer>): Promise<Customer | undefined> {
    // Process fechaIngreso to ensure consistent date format
    const processedCustomer = { ...customer };
    if (processedCustomer.fechaIngreso !== undefined) {
      processedCustomer.fechaIngreso = processedCustomer.fechaIngreso 
        ? (typeof processedCustomer.fechaIngreso === 'string' 
            ? new Date(processedCustomer.fechaIngreso).toISOString().split('T')[0] // Extract just YYYY-MM-DD 
            : new Date(processedCustomer.fechaIngreso).toISOString().split('T')[0])
        : null;
    }
    
    const [updatedCustomer] = await this.db.update(customers)
      .set({ ...processedCustomer, updatedAt: new Date() })
      .where(eq(customers.id, id))
      .returning();
    
    return updatedCustomer as Customer | undefined;
  }

  async deleteCustomer(id: string): Promise<boolean> {
    await this.db.delete(customers).where(eq(customers.id, id));
    return true;
  }

  // ============================
  // VEHICLES
  // ============================

  async getVehicle(id: string): Promise<Vehicle | undefined> {
    const result = await this.db.select().from(vehicles).where(eq(vehicles.id, id)).limit(1);
    return result[0] as Vehicle | undefined;
  }

  async getVehiclesByCustomer(customerId: string): Promise<Vehicle[]> {
    const result = await this.db.select().from(vehicles)
      .where(eq(vehicles.customerId, customerId))
      .orderBy(vehicles.placa);
    return result as Vehicle[];
  }

  async getAllVehicles(): Promise<Vehicle[]> {
    const result = await this.db.select().from(vehicles).orderBy(vehicles.placa);
    return result as Vehicle[];
  }

  async createVehicle(vehicle: InsertVehicle): Promise<Vehicle> {
    const [newVehicle] = await this.db.insert(vehicles).values({
      customerId: vehicle.customerId,
      placa: vehicle.placa,
      marca: vehicle.marca,
      modelo: vehicle.modelo,
      color: vehicle.color,
      observaciones: vehicle.observaciones ?? null
    }).returning();
    
    return newVehicle as Vehicle;
  }

  async updateVehicle(id: string, vehicle: Partial<InsertVehicle>): Promise<Vehicle | undefined> {
    const [updatedVehicle] = await this.db.update(vehicles)
      .set({ ...vehicle, updatedAt: new Date() })
      .where(eq(vehicles.id, id))
      .returning();
    
    return updatedVehicle as Vehicle | undefined;
  }

  async deleteVehicle(id: string): Promise<boolean> {
    await this.db.delete(vehicles).where(eq(vehicles.id, id));
    return true;
  }

  // ============================
  // SERVICES
  // ============================

  async getService(id: string): Promise<Service | undefined> {
    const result = await this.db.select().from(services).where(eq(services.id, id)).limit(1);
    return result[0] as Service | undefined;
  }

  async getServices(): Promise<Service[]> {
    const result = await this.db.select().from(services).orderBy(services.nombre);
    return result as Service[];
  }

  async getActiveServices(): Promise<Service[]> {
    const result = await this.db.select().from(services)
      .where(eq(services.activo, true))
      .orderBy(services.nombre);
    return result as Service[];
  }

  async createService(service: InsertService): Promise<Service> {
    const [newService] = await this.db.insert(services).values({
      nombre: service.nombre,
      descripcion: service.descripcion ?? null,
      precio: String(service.precio),
      duracionMin: service.duracionMin,
      categoria: service.categoria,
      activo: service.activo ?? true
    }).returning();
    
    return newService as Service;
  }

  async updateService(id: string, service: Partial<InsertService>): Promise<Service | undefined> {
    const updateData: any = { ...service, updatedAt: new Date() };
    if (service.precio !== undefined) {
      updateData.precio = String(service.precio);
    }
    
    const [updatedService] = await this.db.update(services)
      .set(updateData)
      .where(eq(services.id, id))
      .returning();
    
    return updatedService as Service | undefined;
  }

  async deleteService(id: string): Promise<boolean> {
    await this.db.delete(services).where(eq(services.id, id));
    return true;
  }

  // ============================
  // SERVICE COMBOS
  // ============================

  async getServiceCombo(id: string): Promise<ServiceCombo | undefined> {
    const result = await this.db.select().from(serviceCombos).where(eq(serviceCombos.id, id)).limit(1);
    return result[0] as ServiceCombo | undefined;
  }

  async getServiceCombos(): Promise<ServiceCombo[]> {
    const result = await this.db.select().from(serviceCombos).orderBy(serviceCombos.nombre);
    return result as ServiceCombo[];
  }

  async getActiveServiceCombos(): Promise<ServiceCombo[]> {
    const result = await this.db.select().from(serviceCombos)
      .where(eq(serviceCombos.activo, true))
      .orderBy(serviceCombos.nombre);
    return result as ServiceCombo[];
  }

  async createServiceCombo(combo: InsertServiceCombo): Promise<ServiceCombo> {
    const [newCombo] = await this.db.insert(serviceCombos).values({
      nombre: combo.nombre,
      descripcion: combo.descripcion ?? null,
      precioTotal: String(combo.precioTotal),
      activo: combo.activo ?? true
    }).returning();
    
    return newCombo as ServiceCombo;
  }

  async updateServiceCombo(id: string, combo: Partial<InsertServiceCombo>): Promise<ServiceCombo | undefined> {
    const updateData: any = { ...combo, updatedAt: new Date() };
    if (combo.precioTotal !== undefined) {
      updateData.precioTotal = String(combo.precioTotal);
    }
    
    const [updatedCombo] = await this.db.update(serviceCombos)
      .set(updateData)
      .where(eq(serviceCombos.id, id))
      .returning();
    
    return updatedCombo as ServiceCombo | undefined;
  }

  async deleteServiceCombo(id: string): Promise<boolean> {
    await this.db.delete(serviceCombos).where(eq(serviceCombos.id, id));
    return true;
  }

  // ============================
  // SERVICE COMBO ITEMS
  // ============================

  async getServiceComboItems(comboId: string): Promise<ServiceComboItem[]> {
    const result = await this.db.select().from(serviceComboItems)
      .where(eq(serviceComboItems.comboId, comboId));
    return result as ServiceComboItem[];
  }

  async createServiceComboItem(item: InsertServiceComboItem): Promise<ServiceComboItem> {
    const [newItem] = await this.db.insert(serviceComboItems).values({
      comboId: item.comboId,
      serviceId: item.serviceId
    }).returning();
    
    return newItem as ServiceComboItem;
  }

  async deleteServiceComboItem(id: string): Promise<boolean> {
    await this.db.delete(serviceComboItems).where(eq(serviceComboItems.id, id));
    return true;
  }

  async deleteServiceComboItemsByCombo(comboId: string): Promise<void> {
    await this.db.delete(serviceComboItems).where(eq(serviceComboItems.comboId, comboId));
  }

  // ============================
  // WORK ORDERS
  // ============================

  async getWorkOrder(id: string): Promise<WorkOrder | undefined> {
    const result = await this.db.select().from(workOrders).where(eq(workOrders.id, id)).limit(1);
    return result[0] as WorkOrder | undefined;
  }

  async getWorkOrders(): Promise<WorkOrder[]> {
    const result = await this.db.select().from(workOrders).orderBy(desc(workOrders.numero));
    return result as WorkOrder[];
  }

  async getWorkOrdersByStatus(status: string): Promise<WorkOrder[]> {
    const result = await this.db.select().from(workOrders)
      .where(eq(workOrders.estado, status as any))
      .orderBy(desc(workOrders.numero));
    return result as WorkOrder[];
  }

  async getWorkOrdersByCustomer(customerId: string): Promise<WorkOrder[]> {
    const result = await this.db.select().from(workOrders)
      .where(eq(workOrders.customerId, customerId))
      .orderBy(desc(workOrders.numero));
    return result as WorkOrder[];
  }

  async createWorkOrder(workOrder: InsertWorkOrder): Promise<WorkOrder> {
    const numero = await this.getNextWorkOrderNumber();
    
    const [newOrder] = await this.db.insert(workOrders).values({
      numero,
      customerId: workOrder.customerId,
      vehicleId: workOrder.vehicleId,
      estado: workOrder.estado ?? "recibido",
      fechaEntrada: workOrder.fechaEntrada ?? new Date(),
      fechaInicio: workOrder.fechaInicio ?? null,
      fechaFin: workOrder.fechaFin ?? null,
      fechaEntrega: workOrder.fechaEntrega ?? null,
      observaciones: workOrder.observaciones ?? null,
      total: workOrder.total ?? "0"
    }).returning();
    
    return newOrder as WorkOrder;
  }

  async updateWorkOrder(id: string, workOrder: Partial<InsertWorkOrder>): Promise<WorkOrder | undefined> {
    const updateData: any = { ...workOrder, updatedAt: new Date() };
    
    const [updatedOrder] = await this.db.update(workOrders)
      .set(updateData)
      .where(eq(workOrders.id, id))
      .returning();
    
    return updatedOrder as WorkOrder | undefined;
  }

  async deleteWorkOrder(id: string): Promise<boolean> {
    await this.db.delete(workOrders).where(eq(workOrders.id, id));
    return true;
  }

  async getNextWorkOrderNumber(): Promise<number> {
    const result = await this.db.select().from(workOrders)
      .orderBy(desc(workOrders.numero))
      .limit(1);
    
    if (result.length === 0) {
      return 1;
    }
    
    return result[0].numero + 1;
  }

  // ============================
  // WORK ORDER ITEMS
  // ============================

  async getWorkOrderItems(workOrderId: string): Promise<WorkOrderItem[]> {
    const result = await this.db.select().from(workOrderItems)
      .where(eq(workOrderItems.workOrderId, workOrderId));
    return result as WorkOrderItem[];
  }

  async createWorkOrderItem(item: InsertWorkOrderItem): Promise<WorkOrderItem> {
    const [newItem] = await this.db.insert(workOrderItems).values({
      workOrderId: item.workOrderId,
      serviceId: item.serviceId ?? null,
      comboId: item.comboId ?? null,
      nombre: item.nombre,
      precio: item.precio,
      cantidad: item.cantidad
    }).returning();
    
    return newItem as WorkOrderItem;
  }

  async deleteWorkOrderItem(id: string): Promise<boolean> {
    await this.db.delete(workOrderItems).where(eq(workOrderItems.id, id));
    return true;
  }

  async deleteWorkOrderItemsByWorkOrder(workOrderId: string): Promise<void> {
    await this.db.delete(workOrderItems).where(eq(workOrderItems.workOrderId, workOrderId));
  }

  async addWorkOrderItem(workOrderId: string, item: InsertWorkOrderItem): Promise<WorkOrderItem> {
    return this.createWorkOrderItem({ ...item, workOrderId });
  }

  async removeWorkOrderItem(workOrderId: string, itemId: string): Promise<boolean> {
    await this.db.delete(workOrderItems)
      .where(and(
        eq(workOrderItems.id, itemId),
        eq(workOrderItems.workOrderId, workOrderId)
      ));
    return true;
  }

  async updateWorkOrderItem(workOrderId: string, itemId: string, data: Partial<InsertWorkOrderItem>): Promise<WorkOrderItem | undefined> {
    const [updated] = await this.db.update(workOrderItems)
      .set(data)
      .where(and(
        eq(workOrderItems.id, itemId),
        eq(workOrderItems.workOrderId, workOrderId)
      ))
      .returning();
    
    return updated as WorkOrderItem | undefined;
  }

  async updateWorkOrderStatus(id: string, status: WorkOrder["estado"]): Promise<WorkOrder | undefined> {
    const updateData: any = { estado: status, updatedAt: new Date() };
    
    // Update related dates based on status
    switch (status) {
      case "en_proceso":
        updateData.fechaInicio = new Date();
        break;
      case "terminado":
        updateData.fechaFin = new Date();
        break;
      case "entregado":
        updateData.fechaEntrega = new Date();
        break;
    }
    
    const [updated] = await this.db.update(workOrders)
      .set(updateData)
      .where(eq(workOrders.id, id))
      .returning();
    
    return updated as WorkOrder | undefined;
  }

  async createSaleFromOrder(workOrderId: string, saleData: Partial<InsertSale>): Promise<Sale> {
    const workOrder = await this.getWorkOrder(workOrderId);
    if (!workOrder) {
      throw new Error("Work order not found");
    }
    
    const sale = await this.createSale({
      ...saleData,
      workOrderId,
      customerId: saleData.customerId || workOrder.customerId,
      total: saleData.total || workOrder.total,
      subtotal: saleData.subtotal || workOrder.total,
      numeroFactura: saleData.numeroFactura || '',
      medioPago: saleData.medioPago || 'efectivo',
      timbradoUsado: saleData.timbradoUsado || ''
    });
    
    // Copy work order items to sale items
    const orderItems = await this.getWorkOrderItems(workOrderId);
    for (const item of orderItems) {
      await this.createSaleItem({
        saleId: sale.id,
        serviceId: item.serviceId,
        comboId: item.comboId,
        nombre: item.nombre,
        cantidad: item.cantidad,
        precioUnitario: item.precio,
        subtotal: String(Number(item.precio) * item.cantidad)
      });
    }
    
    return sale;
  }

  // ============================
  // INVENTORY ITEMS
  // ============================

  async getInventoryItem(id: string): Promise<InventoryItem | undefined> {
    const result = await this.db.select().from(inventoryItems).where(eq(inventoryItems.id, id)).limit(1);
    return result[0] as InventoryItem | undefined;
  }

  async getInventoryItems(): Promise<InventoryItem[]> {
    const result = await this.db.select().from(inventoryItems).orderBy(inventoryItems.nombre);
    return result as InventoryItem[];
  }

  async getInventoryItemsByAlert(alertStatus: string): Promise<InventoryItem[]> {
    const result = await this.db.select().from(inventoryItems)
      .where(eq(inventoryItems.estadoAlerta, alertStatus as any))
      .orderBy(inventoryItems.nombre);
    return result as InventoryItem[];
  }

  async createInventoryItem(item: InsertInventoryItem): Promise<InventoryItem> {
    const [newItem] = await this.db.insert(inventoryItems).values({
      nombre: item.nombre,
      descripcion: item.descripcion ?? null,
      precio: String(item.precio),
      stockActual: item.stockActual,
      stockMinimo: item.stockMinimo,
      unidadMedida: item.unidadMedida ?? "unidad",
      categoria: item.categoria,
      proveedor: item.proveedor ?? null,
      ultimoPedido: item.ultimoPedido ?? null,
      estadoAlerta: item.estadoAlerta ?? "normal",
      activo: item.activo ?? true
    }).returning();
    
    return newItem as InventoryItem;
  }

  async updateInventoryItem(id: string, item: Partial<InsertInventoryItem>): Promise<InventoryItem | undefined> {
    const updateData: any = { ...item, updatedAt: new Date() };
    if (item.precio !== undefined) {
      updateData.precio = String(item.precio);
    }
    
    // Update alert status based on stock
    if (item.stockActual !== undefined && item.stockMinimo !== undefined) {
      if (item.stockActual === 0) {
        updateData.estadoAlerta = "critico";
      } else if (item.stockActual <= item.stockMinimo) {
        updateData.estadoAlerta = "bajo";
      } else {
        updateData.estadoAlerta = "normal";
      }
    }
    
    const [updated] = await this.db.update(inventoryItems)
      .set(updateData)
      .where(eq(inventoryItems.id, id))
      .returning();
    
    return updated as InventoryItem | undefined;
  }

  async deleteInventoryItem(id: string): Promise<boolean> {
    await this.db.delete(inventoryItems).where(eq(inventoryItems.id, id));
    return true;
  }

  async updateInventoryStock(id: string, newStock: number): Promise<InventoryItem | undefined> {
    const item = await this.getInventoryItem(id);
    if (!item) return undefined;
    
    let estadoAlerta: "normal" | "bajo" | "critico" = "normal";
    if (newStock === 0) {
      estadoAlerta = "critico";
    } else if (newStock <= item.stockMinimo) {
      estadoAlerta = "bajo";
    }
    
    const [updated] = await this.db.update(inventoryItems)
      .set({ 
        stockActual: newStock,
        estadoAlerta,
        updatedAt: new Date()
      })
      .where(eq(inventoryItems.id, id))
      .returning();
    
    return updated as InventoryItem | undefined;
  }

  // ============================
  // SALES
  // ============================

  async getSale(id: string): Promise<Sale | undefined> {
    const result = await this.db.select().from(sales).where(eq(sales.id, id)).limit(1);
    return result[0] as Sale | undefined;
  }

  async getSales(): Promise<Sale[]> {
    const result = await this.db.select().from(sales).orderBy(desc(sales.fecha));
    return result as Sale[];
  }

  async getSalesByDateRange(startDate: Date, endDate: Date): Promise<Sale[]> {
    const result = await this.db.select().from(sales)
      .where(between(sales.fecha, startDate, endDate))
      .orderBy(desc(sales.fecha));
    return result as Sale[];
  }

  async getSalesByCustomer(customerId: string): Promise<Sale[]> {
    const result = await this.db.select().from(sales)
      .where(eq(sales.customerId, customerId))
      .orderBy(desc(sales.fecha));
    return result as Sale[];
  }

  async getLastSale(): Promise<Sale | undefined> {
    const result = await this.db.select().from(sales)
      .orderBy(desc(sales.fecha))
      .limit(1);
    return result[0] as Sale | undefined;
  }

  async createSale(sale: InsertSale): Promise<Sale> {
    const [newSale] = await this.db.insert(sales).values({
      numeroFactura: sale.numeroFactura,
      customerId: sale.customerId ?? null,
      workOrderId: sale.workOrderId ?? null,
      fecha: sale.fecha ?? new Date(),
      subtotal: sale.subtotal,
      impuestos: sale.impuestos ?? "0",
      total: sale.total,
      medioPago: sale.medioPago,
      regimenTurismo: sale.regimenTurismo ?? false,
      timbradoUsado: sale.timbradoUsado,
      createdBy: sale.createdBy ?? null
    }).returning();
    
    return newSale as Sale;
  }

  async updateSale(id: string, sale: Partial<InsertSale>): Promise<Sale | undefined> {
    const [updated] = await this.db.update(sales)
      .set({ ...sale, updatedAt: new Date() })
      .where(eq(sales.id, id))
      .returning();
    
    return updated as Sale | undefined;
  }

  async deleteSale(id: string): Promise<boolean> {
    // Delete sale items first
    await this.db.delete(saleItems).where(eq(saleItems.saleId, id));
    // Then delete the sale
    await this.db.delete(sales).where(eq(sales.id, id));
    return true;
  }

  // ============================
  // SALE ITEMS
  // ============================

  async getSaleItems(saleId: string): Promise<SaleItem[]> {
    const result = await this.db.select().from(saleItems)
      .where(eq(saleItems.saleId, saleId));
    return result as SaleItem[];
  }

  async createSaleItem(item: InsertSaleItem): Promise<SaleItem> {
    const [newItem] = await this.db.insert(saleItems).values({
      saleId: item.saleId,
      serviceId: item.serviceId ?? null,
      comboId: item.comboId ?? null,
      inventoryItemId: item.inventoryItemId ?? null,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precioUnitario: item.precioUnitario,
      subtotal: item.subtotal
    }).returning();
    
    // Update inventory stock if it's an inventory item
    if (item.inventoryItemId) {
      const inventoryItem = await this.getInventoryItem(item.inventoryItemId);
      if (inventoryItem) {
        await this.updateInventoryStock(
          item.inventoryItemId,
          inventoryItem.stockActual - item.cantidad
        );
      }
    }
    
    return newItem as SaleItem;
  }

  async deleteSaleItem(id: string): Promise<boolean> {
    // Get the item first to restore inventory if needed
    const [item] = await this.db.select().from(saleItems).where(eq(saleItems.id, id));
    
    if (item && item.inventoryItemId) {
      const inventoryItem = await this.getInventoryItem(item.inventoryItemId);
      if (inventoryItem) {
        await this.updateInventoryStock(
          item.inventoryItemId,
          inventoryItem.stockActual + item.cantidad
        );
      }
    }
    
    await this.db.delete(saleItems).where(eq(saleItems.id, id));
    return true;
  }

  async deleteSaleItemsBySale(saleId: string): Promise<void> {
    // Get all items first to restore inventory
    const items = await this.getSaleItems(saleId);
    
    for (const item of items) {
      if (item.inventoryItemId) {
        const inventoryItem = await this.getInventoryItem(item.inventoryItemId);
        if (inventoryItem) {
          await this.updateInventoryStock(
            item.inventoryItemId,
            inventoryItem.stockActual + item.cantidad
          );
        }
      }
    }
    
    await this.db.delete(saleItems).where(eq(saleItems.saleId, saleId));
  }
}