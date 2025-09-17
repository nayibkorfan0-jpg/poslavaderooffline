import { pgTable, varchar, text, integer, boolean, timestamp, decimal, pgEnum } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Enums for PostgreSQL
export const userRoleEnum = pgEnum("user_role", ["admin", "user", "readonly"]);
export const subscriptionTypeEnum = pgEnum("subscription_type", ["free", "basic", "premium", "enterprise"]);
export const docTipoEnum = pgEnum("doc_tipo", ["CI", "Pasaporte", "RUC", "Extranjero"]);
export const categoryTipoEnum = pgEnum("category_tipo", ["servicios", "productos", "ambos"]);
export const workOrderEstadoEnum = pgEnum("work_order_estado", ["recibido", "en_proceso", "terminado", "entregado", "cancelado"]);
export const inventoryAlertaEnum = pgEnum("inventory_alerta", ["normal", "bajo", "critico"]);
export const medioPagoEnum = pgEnum("medio_pago", ["efectivo", "tarjeta_credito", "tarjeta_debito", "transferencia", "cheque"]);
export const operationModeEnum = pgEnum("operation_mode", ["testing", "production"]);

// ========================
// USERS TABLE
// ========================
export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  username: varchar("username", { length: 255 }).notNull().unique(),
  password: text("password").notNull(),
  
  // User information
  fullName: text("full_name"),
  email: varchar("email", { length: 255 }),
  
  // Role-based access control
  role: userRoleEnum("role").notNull().default("user"),
  
  // Subscription and usage limits
  subscriptionType: subscriptionTypeEnum("subscription_type").notNull().default("free"),
  monthlyInvoiceLimit: integer("monthly_invoice_limit").notNull().default(50),
  expirationDate: timestamp("expiration_date"),
  
  // Current usage tracking (resets monthly)
  currentMonthInvoices: integer("current_month_invoices").notNull().default(0),
  usageResetDate: timestamp("usage_reset_date").notNull().default(sql`now()`),
  
  // Account status
  isActive: boolean("is_active").notNull().default(true),
  isBlocked: boolean("is_blocked").notNull().default(false),
  
  // Authentication tracking
  lastLogin: timestamp("last_login"),
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lastFailedLogin: timestamp("last_failed_login"),
  
  // Audit fields
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`),
  createdBy: varchar("created_by", { length: 36 })
});

// ========================
// COMPANY CONFIG TABLE
// ========================
export const companyConfigs = pgTable("company_configs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  ruc: varchar("ruc", { length: 50 }).notNull(),
  razonSocial: text("razon_social").notNull(),
  nombreFantasia: text("nombre_fantasia"),
  timbradoNumero: varchar("timbrado_numero", { length: 50 }).notNull(),
  timbradoDesde: varchar("timbrado_desde", { length: 10 }).notNull(),
  timbradoHasta: varchar("timbrado_hasta", { length: 10 }).notNull(),
  establecimiento: varchar("establecimiento", { length: 10 }).notNull().default("001"),
  puntoExpedicion: varchar("punto_expedicion", { length: 10 }).notNull().default("001"),
  direccion: text("direccion").notNull(),
  ciudad: varchar("ciudad", { length: 255 }).notNull().default("Asunción"),
  telefono: varchar("telefono", { length: 50 }),
  email: varchar("email", { length: 255 }),
  logoPath: text("logo_path"),
  moneda: varchar("moneda", { length: 10 }).notNull().default("GS"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// ========================
// DNIT CONFIG TABLE
// ========================
export const dnitConfigs = pgTable("dnit_configs", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  endpointUrl: text("endpoint_url").notNull(),
  authToken: text("auth_token").notNull(), // Encrypted
  certificateData: text("certificate_data"),
  certificatePassword: text("certificate_password"), // Encrypted
  operationMode: operationModeEnum("operation_mode").notNull().default("testing"),
  isActive: boolean("is_active").notNull().default(false),
  lastConnectionTest: timestamp("last_connection_test"),
  lastConnectionStatus: text("last_connection_status"),
  lastConnectionError: text("last_connection_error"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// ========================
// CATEGORIES TABLE
// ========================
export const categories = pgTable("categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  descripcion: text("descripcion"),
  tipo: categoryTipoEnum("tipo").notNull().default("ambos"),
  color: varchar("color", { length: 7 }), // Hex color
  activa: boolean("activa").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// ========================
// CUSTOMERS TABLE
// ========================
export const customers = pgTable("customers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  docTipo: docTipoEnum("doc_tipo").notNull().default("CI"),
  docNumero: varchar("doc_numero", { length: 50 }).notNull(),
  email: varchar("email", { length: 255 }),
  telefono: varchar("telefono", { length: 50 }),
  direccion: text("direccion"),
  regimenTurismo: boolean("regimen_turismo").notNull().default(false),
  pais: varchar("pais", { length: 100 }),
  pasaporte: varchar("pasaporte", { length: 50 }),
  fechaIngreso: varchar("fecha_ingreso", { length: 10 }),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// ========================
// VEHICLES TABLE
// ========================
export const vehicles = pgTable("vehicles", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  customerId: varchar("customer_id", { length: 36 }).notNull().references(() => customers.id),
  placa: varchar("placa", { length: 20 }).notNull(),
  marca: varchar("marca", { length: 50 }).notNull(),
  modelo: varchar("modelo", { length: 50 }).notNull(),
  color: varchar("color", { length: 30 }).notNull(),
  observaciones: text("observaciones"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// ========================
// SERVICES TABLE
// ========================
export const services = pgTable("services", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  descripcion: text("descripcion"),
  precio: decimal("precio", { precision: 10, scale: 2 }).notNull(),
  duracionMin: integer("duracion_min").notNull(),
  categoria: varchar("categoria", { length: 255 }).notNull(),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// ========================
// SERVICE COMBOS TABLE
// ========================
export const serviceCombos = pgTable("service_combos", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  descripcion: text("descripcion"),
  precioTotal: decimal("precio_total", { precision: 10, scale: 2 }).notNull(),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// ========================
// SERVICE COMBO ITEMS TABLE
// ========================
export const serviceComboItems = pgTable("service_combo_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  comboId: varchar("combo_id", { length: 36 }).notNull().references(() => serviceCombos.id),
  serviceId: varchar("service_id", { length: 36 }).notNull().references(() => services.id)
});

// ========================
// WORK ORDERS TABLE
// ========================
export const workOrders = pgTable("work_orders", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  numero: integer("numero").notNull().unique(),
  customerId: varchar("customer_id", { length: 36 }).notNull().references(() => customers.id),
  vehicleId: varchar("vehicle_id", { length: 36 }).notNull().references(() => vehicles.id),
  estado: workOrderEstadoEnum("estado").notNull().default("recibido"),
  fechaEntrada: timestamp("fecha_entrada").notNull().default(sql`now()`),
  fechaInicio: timestamp("fecha_inicio"),
  fechaFin: timestamp("fecha_fin"),
  fechaEntrega: timestamp("fecha_entrega"),
  observaciones: text("observaciones"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// ========================
// WORK ORDER ITEMS TABLE
// ========================
export const workOrderItems = pgTable("work_order_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  workOrderId: varchar("work_order_id", { length: 36 }).notNull().references(() => workOrders.id),
  serviceId: varchar("service_id", { length: 36 }).references(() => services.id),
  comboId: varchar("combo_id", { length: 36 }).references(() => serviceCombos.id),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  precio: decimal("precio", { precision: 10, scale: 2 }).notNull(),
  cantidad: integer("cantidad").notNull().default(1)
});

// ========================
// INVENTORY ITEMS TABLE
// ========================
export const inventoryItems = pgTable("inventory_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  descripcion: text("descripcion"),
  precio: decimal("precio", { precision: 10, scale: 2 }).notNull(),
  stockActual: integer("stock_actual").notNull().default(0),
  stockMinimo: integer("stock_minimo").notNull().default(0),
  unidadMedida: varchar("unidad_medida", { length: 50 }).notNull().default("unidad"),
  categoria: varchar("categoria", { length: 255 }).notNull(),
  proveedor: varchar("proveedor", { length: 255 }),
  ultimoPedido: varchar("ultimo_pedido", { length: 255 }),
  estadoAlerta: inventoryAlertaEnum("estado_alerta").notNull().default("normal"),
  activo: boolean("activo").notNull().default(true),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// ========================
// SALES TABLE
// ========================
export const sales = pgTable("sales", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  numeroFactura: varchar("numero_factura", { length: 50 }).notNull().unique(),
  customerId: varchar("customer_id", { length: 36 }).references(() => customers.id),
  workOrderId: varchar("work_order_id", { length: 36 }).references(() => workOrders.id),
  fecha: timestamp("fecha").notNull().default(sql`now()`),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  impuestos: decimal("impuestos", { precision: 10, scale: 2 }).notNull().default("0"),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  medioPago: medioPagoEnum("medio_pago").notNull(),
  regimenTurismo: boolean("regimen_turismo").notNull().default(false),
  timbradoUsado: varchar("timbrado_usado", { length: 50 }).notNull(),
  createdBy: varchar("created_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp("updated_at").notNull().default(sql`now()`)
});

// ========================
// SALE ITEMS TABLE
// ========================
export const saleItems = pgTable("sale_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  saleId: varchar("sale_id", { length: 36 }).notNull().references(() => sales.id),
  serviceId: varchar("service_id", { length: 36 }).references(() => services.id),
  comboId: varchar("combo_id", { length: 36 }).references(() => serviceCombos.id),
  inventoryItemId: varchar("inventory_item_id", { length: 36 }).references(() => inventoryItems.id),
  nombre: varchar("nombre", { length: 255 }).notNull(),
  cantidad: integer("cantidad").notNull().default(1),
  precioUnitario: decimal("precio_unitario", { precision: 10, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull()
});

// Export type helpers for use in postgres-storage.ts
export type InsertUser = typeof users.$inferInsert;
export type SelectUser = typeof users.$inferSelect;
export type InsertCompanyConfig = typeof companyConfigs.$inferInsert;
export type SelectCompanyConfig = typeof companyConfigs.$inferSelect;
export type InsertDnitConfig = typeof dnitConfigs.$inferInsert;
export type SelectDnitConfig = typeof dnitConfigs.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;
export type SelectCategory = typeof categories.$inferSelect;
export type InsertCustomer = typeof customers.$inferInsert;
export type SelectCustomer = typeof customers.$inferSelect;
export type InsertVehicle = typeof vehicles.$inferInsert;
export type SelectVehicle = typeof vehicles.$inferSelect;
export type InsertService = typeof services.$inferInsert;
export type SelectService = typeof services.$inferSelect;
export type InsertServiceCombo = typeof serviceCombos.$inferInsert;
export type SelectServiceCombo = typeof serviceCombos.$inferSelect;
export type InsertServiceComboItem = typeof serviceComboItems.$inferInsert;
export type SelectServiceComboItem = typeof serviceComboItems.$inferSelect;
export type InsertWorkOrder = typeof workOrders.$inferInsert;
export type SelectWorkOrder = typeof workOrders.$inferSelect;
export type InsertWorkOrderItem = typeof workOrderItems.$inferInsert;
export type SelectWorkOrderItem = typeof workOrderItems.$inferSelect;
export type InsertInventoryItem = typeof inventoryItems.$inferInsert;
export type SelectInventoryItem = typeof inventoryItems.$inferSelect;
export type InsertSale = typeof sales.$inferInsert;
export type SelectSale = typeof sales.$inferSelect;
export type InsertSaleItem = typeof saleItems.$inferInsert;
export type SelectSaleItem = typeof saleItems.$inferSelect;