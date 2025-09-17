import { z } from "zod";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

/**
 * SQLite TABLE DEFINITIONS WITH DRIZZLE ORM
 * Converted from PostgreSQL for desktop application with local storage
 * Maintains full compatibility with existing TypeScript interfaces and Zod schemas
 */

// ====================================
// SQLite TABLE DEFINITIONS
// ====================================

// Users table
export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name"),
  email: text("email"),
  role: text("role", { enum: ["admin", "user", "readonly"] }).notNull().default("user"),
  subscriptionType: text("subscription_type", { enum: ["free", "basic", "premium", "enterprise"] }).notNull().default("free"),
  monthlyInvoiceLimit: integer("monthly_invoice_limit").notNull().default(50),
  expirationDate: integer("expiration_date", { mode: "timestamp" }),
  currentMonthInvoices: integer("current_month_invoices").notNull().default(0),
  usageResetDate: integer("usage_reset_date", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  isBlocked: integer("is_blocked", { mode: "boolean" }).notNull().default(false),
  lastLogin: integer("last_login", { mode: "timestamp" }),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lastFailedLogin: integer("last_failed_login", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  createdBy: text("created_by")
});

// Company configs table
export const companyConfigs = sqliteTable("company_configs", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  ruc: text("ruc").notNull(),
  razonSocial: text("razon_social").notNull(),
  nombreFantasia: text("nombre_fantasia"),
  timbradoNumero: text("timbrado_numero").notNull(),
  timbradoDesde: text("timbrado_desde").notNull(),
  timbradoHasta: text("timbrado_hasta").notNull(),
  establecimiento: text("establecimiento").notNull().default("001"),
  puntoExpedicion: text("punto_expedicion").notNull().default("001"),
  direccion: text("direccion").notNull(),
  ciudad: text("ciudad").notNull().default("Asunción"),
  telefono: text("telefono"),
  email: text("email"),
  logoPath: text("logo_path"),
  moneda: text("moneda").notNull().default("GS"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date())
});

// DNIT configs table
export const dnitConfigs = sqliteTable("dnit_configs", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  endpointUrl: text("endpoint_url").notNull(),
  authToken: text("auth_token").notNull(),
  certificateData: text("certificate_data"),
  certificatePassword: text("certificate_password"),
  operationMode: text("operation_mode", { enum: ["testing", "production"] }).notNull().default("testing"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  lastConnectionTest: integer("last_connection_test", { mode: "timestamp" }),
  lastConnectionStatus: text("last_connection_status"),
  lastConnectionError: text("last_connection_error"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date())
});

// Categories table
export const categories = sqliteTable("categories", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion"),
  tipo: text("tipo", { enum: ["servicios", "productos", "ambos"] }).notNull().default("ambos"),
  color: text("color"),
  activa: integer("activa", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date())
});

// Customers table
export const customers = sqliteTable("customers", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  nombre: text("nombre").notNull(),
  docTipo: text("doc_tipo", { enum: ["CI", "Pasaporte", "RUC", "Extranjero"] }).notNull().default("CI"),
  docNumero: text("doc_numero").notNull(),
  email: text("email"),
  telefono: text("telefono"),
  direccion: text("direccion"),
  regimenTurismo: integer("regimen_turismo", { mode: "boolean" }).notNull().default(false),
  pais: text("pais"),
  pasaporte: text("pasaporte"),
  fechaIngreso: text("fecha_ingreso"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date())
});

// Vehicles table
export const vehicles = sqliteTable("vehicles", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  customerId: text("customer_id").notNull().references(() => customers.id),
  placa: text("placa").notNull(),
  marca: text("marca").notNull(),
  modelo: text("modelo").notNull(),
  color: text("color").notNull(),
  observaciones: text("observaciones"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date())
});

// Services table
export const services = sqliteTable("services", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion"),
  precio: text("precio").notNull(), // Decimal as text for precision
  duracionMin: integer("duracion_min").notNull(),
  categoria: text("categoria").notNull(),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date())
});

// Service combos table
export const serviceCombos = sqliteTable("service_combos", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion"),
  precioTotal: text("precio_total").notNull(), // Decimal as text for precision
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date())
});

// Service combo items table
export const serviceComboItems = sqliteTable("service_combo_items", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  comboId: text("combo_id").notNull().references(() => serviceCombos.id),
  serviceId: text("service_id").notNull().references(() => services.id)
});

// Work orders table
export const workOrders = sqliteTable("work_orders", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  numero: integer("numero").notNull().unique(),
  customerId: text("customer_id").notNull().references(() => customers.id),
  vehicleId: text("vehicle_id").notNull().references(() => vehicles.id),
  estado: text("estado", { enum: ["recibido", "en_proceso", "terminado", "entregado", "cancelado"] }).notNull().default("recibido"),
  fechaEntrada: integer("fecha_entrada", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  fechaInicio: integer("fecha_inicio", { mode: "timestamp" }),
  fechaFin: integer("fecha_fin", { mode: "timestamp" }),
  fechaEntrega: integer("fecha_entrega", { mode: "timestamp" }),
  observaciones: text("observaciones"),
  total: text("total").notNull().default("0"), // Decimal as text for precision
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date())
});

// Work order items table
export const workOrderItems = sqliteTable("work_order_items", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  workOrderId: text("work_order_id").notNull().references(() => workOrders.id),
  serviceId: text("service_id").references(() => services.id),
  comboId: text("combo_id").references(() => serviceCombos.id),
  nombre: text("nombre").notNull(),
  precio: text("precio").notNull(), // Decimal as text for precision
  cantidad: integer("cantidad").notNull().default(1)
});

// Inventory items table
export const inventoryItems = sqliteTable("inventory_items", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  nombre: text("nombre").notNull(),
  descripcion: text("descripcion"),
  precio: text("precio").notNull(), // Decimal as text for precision
  stockActual: integer("stock_actual").notNull().default(0),
  stockMinimo: integer("stock_minimo").notNull().default(0),
  unidadMedida: text("unidad_medida").notNull().default("unidad"),
  categoria: text("categoria").notNull(),
  proveedor: text("proveedor"),
  ultimoPedido: text("ultimo_pedido"),
  estadoAlerta: text("estado_alerta", { enum: ["normal", "bajo", "critico"] }).notNull().default("normal"),
  activo: integer("activo", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date())
});

// Sales table
export const sales = sqliteTable("sales", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  numeroFactura: text("numero_factura").notNull().unique(),
  customerId: text("customer_id").references(() => customers.id),
  workOrderId: text("work_order_id").references(() => workOrders.id),
  fecha: integer("fecha", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  subtotal: text("subtotal").notNull(), // Decimal as text for precision
  impuestos: text("impuestos").notNull().default("0"), // Decimal as text for precision
  total: text("total").notNull(), // Decimal as text for precision
  medioPago: text("medio_pago", { enum: ["efectivo", "tarjeta_credito", "tarjeta_debito", "transferencia", "cheque"] }).notNull(),
  regimenTurismo: integer("regimen_turismo", { mode: "boolean" }).notNull().default(false),
  timbradoUsado: text("timbrado_usado").notNull(),
  createdBy: text("created_by").references(() => users.id),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().$defaultFn(() => new Date())
});

// Sale items table
export const saleItems = sqliteTable("sale_items", {
  id: text("id").primaryKey().$defaultFn(() => randomUUID()),
  saleId: text("sale_id").notNull().references(() => sales.id),
  serviceId: text("service_id").references(() => services.id),
  comboId: text("combo_id").references(() => serviceCombos.id),
  inventoryItemId: text("inventory_item_id").references(() => inventoryItems.id),
  nombre: text("nombre").notNull(),
  cantidad: integer("cantidad").notNull().default(1),
  precioUnitario: text("precio_unitario").notNull(), // Decimal as text for precision
  subtotal: text("subtotal").notNull() // Decimal as text for precision
});

// Re-export all TypeScript interfaces and Zod schemas from original schema
// This maintains full compatibility with existing frontend code
export type {
  User, InsertUser, InternalUpdateUser,
  CompanyConfig, InsertCompanyConfig,
  DnitConfig, InsertDnitConfig, UpdateDnitConfig,
  Category, InsertCategory,
  Customer, InsertCustomer,
  Vehicle, InsertVehicle,
  Service, InsertService,
  ServiceCombo, InsertServiceCombo,
  ServiceComboItem, InsertServiceComboItem,
  WorkOrder, InsertWorkOrder,
  WorkOrderItem, InsertWorkOrderItem,
  InventoryItem, InsertInventoryItem,
  Sale, InsertSale,
  SaleItem, InsertSaleItem
} from "./schema";

// Re-export all Zod schemas for validation
export {
  insertUserSchema, updateUserSchema, 
  insertCompanyConfigSchema,
  insertDnitConfigSchema,
  insertCategorySchema,
  insertCustomerSchema,
  insertVehicleSchema,
  insertServiceSchema,
  insertServiceComboSchema,
  insertServiceComboItemSchema,
  insertWorkOrderSchema,
  insertWorkOrderItemSchema,
  insertInventoryItemSchema,
  insertSaleSchema,
  insertSaleItemSchema
} from "./schema";