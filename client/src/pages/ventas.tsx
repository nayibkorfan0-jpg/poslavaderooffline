import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  CreditCard, 
  Plus, 
  Edit, 
  Search,
  Filter,
  AlertTriangle,
  DollarSign,
  User,
  Calendar,
  Car,
  FileText,
  Trash2,
  ShoppingCart,
  Eye,
  Download,
  Calculator
} from "lucide-react";
import { insertSaleSchema, type Sale, type Customer, type Service, type ServiceCombo, type WorkOrder } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDate, formatDateTimeRobust } from "@/lib/utils";

// Sale form schema
const saleFormSchema = insertSaleSchema.extend({
  items: z.array(z.object({
    type: z.enum(['service', 'combo', 'product']),
    id: z.string(),
    name: z.string(),
    price: z.number(),
    quantity: z.number().min(1),
  })).min(1, "Debe agregar al menos un item"),
});

type SaleFormData = z.infer<typeof saleFormSchema>;

// Payment methods
const paymentMethods = [
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta de Crédito/Débito" },
  { value: "transferencia", label: "Transferencia Bancaria" },
  { value: "cuenta", label: "Cuenta Corriente" },
];


// Tax rate (10% IVA in Paraguay)
const TAX_RATE = 0.10;

// Format price for Paraguay (Guaraní)
const formatPrice = (price: number | string) => {
  const numPrice = typeof price === 'string' ? parseInt(price) : price;
  return `Gs. ${numPrice.toLocaleString('es-PY')}`;
};

export default function VentasPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [filterTourism, setFilterTourism] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [timbradoStatus, setTimbradoStatus] = useState<{ isValid: boolean; error?: string }>({ isValid: true });
  const [deleteConfirmSale, setDeleteConfirmSale] = useState<Sale | null>(null);

  // Real timbrado status query
  const { data: timbradoData } = useQuery({
    queryKey: ['/api/timbrado/status'],
    queryFn: async () => {
      const res = await fetch('/api/timbrado/status');
      if (!res.ok) throw new Error('Failed to fetch timbrado status');
      return res.json();
    }
  });

  // Update timbrado status based on API response
  useEffect(() => {
    if (timbradoData) {
      setTimbradoStatus({
        isValid: timbradoData.isValid,
        error: timbradoData.isValid ? undefined : timbradoData.error || "Timbrado vencido - No se pueden emitir facturas"
      });
    }
  }, [timbradoData]);

  // Current user query for role checking
  const { data: currentUser } = useQuery({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error('Failed to fetch user');
      return res.json();
    }
  });

  // Real data queries
  const { data: sales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ['/api/sales'],
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  const { data: services = [], isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ['/api/services'],
  });

  const { data: combos = [], isLoading: combosLoading } = useQuery<ServiceCombo[]>({
    queryKey: ['/api/service-combos'],
  });

  const isLoading = salesLoading || customersLoading || servicesLoading || combosLoading;

  // Filter sales
  const filteredSales = sales.filter(sale => {
    const customer = customers.find(c => c.id === sale.customerId);
    
    const matchesSearch = 
      sale.numeroFactura.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer?.nombre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer?.docNumero?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesPayment = filterPayment === "all" || sale.medioPago === filterPayment;
    const matchesTourism = filterTourism === "all" || 
      (filterTourism === "tourism" && sale.regimenTurismo) ||
      (filterTourism === "local" && !sale.regimenTurismo);
    
    return matchesSearch && matchesPayment && matchesTourism;
  });

  // Calculate stats
  const today = new Date();
  const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const todaySales = sales.filter(sale => new Date(sale.fecha) >= startOfDay);
  const totalToday = todaySales.reduce((sum, sale) => sum + parseInt(sale.total), 0);

  // Form setup
  const form = useForm<SaleFormData>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      customerId: "",
      workOrderId: "",
      medioPago: "efectivo",
      regimenTurismo: false,
      items: [],
    },
  });

  // Watch customer to set tourism regime
  const watchCustomer = form.watch("customerId");
  const watchItems = form.watch("items");

  useEffect(() => {
    if (watchCustomer) {
      const customer = customers.find(c => c.id === watchCustomer);
      if (customer) {
        form.setValue("regimenTurismo", customer.regimenTurismo);
      }
    }
  }, [watchCustomer, customers, form]);

  // Calculate totals
  const subtotal = selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const isLocalCustomer = !form.watch("regimenTurismo");
  const taxes = isLocalCustomer ? Math.round(subtotal * TAX_RATE) : 0;
  const total = subtotal + taxes;

  // Real API mutations
  const createMutation = useMutation({
    mutationFn: async (data: SaleFormData) => {
      if (!timbradoStatus.isValid) {
        throw new Error("No se puede facturar con timbrado vencido");
      }
      
      // Prepare the sale data for the API
      const saleData = {
        customerId: data.customerId,
        workOrderId: data.workOrderId || null,
        medioPago: data.medioPago,
        regimenTurismo: data.regimenTurismo,
        items: selectedItems.map(item => ({
          type: item.type,
          id: item.id,
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        subtotal: subtotal.toString(),
        impuestos: taxes.toString(),
        total: total.toString(),
      };

      const response = await apiRequest('POST', '/api/sales', saleData);
      return response;
    },
    onSuccess: () => {
      // Comprehensive cache invalidation for real-time updates
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] }); // For stock updates
      queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] }); // Always invalidate for dashboard
      queryClient.invalidateQueries({ queryKey: ['/api/company-config'] }); // Dashboard config
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] }); // Dashboard aggregated data
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] }); // Customer updates
      
      // Specific work order invalidation if linked
      const workOrderId = form.getValues('workOrderId');
      if (workOrderId) {
        queryClient.invalidateQueries({ queryKey: ['/api/work-orders', workOrderId] });
        queryClient.invalidateQueries({ queryKey: ['/api/work-orders', workOrderId, 'items'] });
      }
      
      setIsDialogOpen(false);
      setSelectedItems([]);
      form.reset();
      toast({
        title: "Venta registrada",
        description: "La factura se ha generado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al procesar venta",
        description: error.message || "No se pudo procesar la venta.",
        variant: "destructive",
      });
    },
  });

  // Edit sale mutation
  const editMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SaleFormData }) => {
      const response = await apiRequest('PUT', `/api/sales/${id}`, {
        ...data,
        items: selectedItems,
        subtotal: subtotal.toString(),
        impuestos: taxes.toString(),
        total: total.toString(),
      });
      return response;
    },
    onSuccess: () => {
      // Comprehensive cache invalidation for real-time updates
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] }); // For stock updates
      queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] }); // Always invalidate for dashboard
      queryClient.invalidateQueries({ queryKey: ['/api/company-config'] }); // Dashboard config
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] }); // Dashboard aggregated data
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] }); // Customer updates
      
      setIsDialogOpen(false);
      setEditingSale(null);
      setSelectedItems([]);
      form.reset();
      toast({
        title: "Factura actualizada",
        description: "La factura ha sido actualizada correctamente.",
      });
    },
    onError: (error: any) => {
      let message = "No se pudo actualizar la factura.";
      try {
        const errorData = JSON.parse(error.message.split(': ')[1]);
        if (errorData.code === 'FISCAL_COMPLIANCE_VIOLATION') {
          message = `${errorData.details} (${errorData.hoursElapsed}h transcurridas de ${errorData.maxHours}h permitidas)`;
        } else {
          message = errorData.details || message;
        }
      } catch (e) {
        // Use default message
      }
      toast({
        title: "Error al actualizar factura",
        description: message,
        variant: "destructive",
      });
    },
  });

  // Delete sale mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest('DELETE', `/api/sales/${id}`);
      return response;
    },
    onSuccess: () => {
      // Comprehensive cache invalidation for real-time updates
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] }); // For stock updates
      queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] }); // Always invalidate for dashboard
      queryClient.invalidateQueries({ queryKey: ['/api/company-config'] }); // Dashboard config
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] }); // Dashboard aggregated data
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] }); // Customer updates
      
      setDeleteConfirmSale(null);
      toast({
        title: "Factura eliminada",
        description: "La factura ha sido eliminada correctamente.",
      });
    },
    onError: (error: any) => {
      let message = "No se pudo eliminar la factura.";
      try {
        const errorData = JSON.parse(error.message.split(': ')[1]);
        if (errorData.code === 'FISCAL_COMPLIANCE_VIOLATION') {
          message = `${errorData.details} (${errorData.hoursElapsed}h transcurridas de ${errorData.maxHours}h permitidas)`;
        } else {
          message = errorData.details || message;
        }
      } catch (e) {
        // Use default message
      }
      toast({
        title: "Error al eliminar factura",
        description: message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SaleFormData) => {
    const saleData = {
      ...data,
      items: selectedItems,
    };
    
    if (editingSale) {
      editMutation.mutate({ id: editingSale.id, data: saleData });
    } else {
      createMutation.mutate(saleData);
    }
  };

  const addItem = (type: 'service' | 'combo' | 'product', id: string, name: string, price: number) => {
    const existingItem = selectedItems.find(item => item.id === id && item.type === type);
    if (existingItem) {
      setSelectedItems(items => 
        items.map(item => 
          item.id === id && item.type === type 
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setSelectedItems(items => [...items, { type, id, name, price, quantity: 1 }]);
    }
  };

  const removeItem = (type: string, id: string) => {
    setSelectedItems(items => items.filter(item => !(item.id === id && item.type === type)));
  };

  const updateQuantity = (type: string, id: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(type, id);
      return;
    }
    setSelectedItems(items => 
      items.map(item => 
        item.id === id && item.type === type 
          ? { ...item, quantity }
          : item
      )
    );
  };

  const openDialog = () => {
    setEditingSale(null);
    setSelectedItems([]);
    form.reset();
    setIsDialogOpen(true);
  };

  const openEditDialog = (sale: Sale) => {
    setEditingSale(sale);
    form.reset({
      customerId: sale.customerId,
      workOrderId: sale.workOrderId || "",
      medioPago: sale.medioPago,
      regimenTurismo: sale.regimenTurismo,
      items: [],
    });
    // TODO: Load existing sale items into selectedItems
    setSelectedItems([]);
    setIsDialogOpen(true);
  };

  const confirmDelete = (sale: Sale) => {
    setDeleteConfirmSale(sale);
  };

  const executeDelete = () => {
    if (deleteConfirmSale) {
      deleteMutation.mutate(deleteConfirmSale.id);
    }
  };

  // Check if user can edit/delete sales (admin only + 24-hour window)
  const canModifySale = (sale: Sale): { canEdit: boolean; canDelete: boolean; reason?: string } => {
    // Fix role check - handle both nested and direct user object structures
    const userRole = currentUser?.user?.role || currentUser?.role;
    if (!currentUser || userRole !== 'admin') {
      return { canEdit: false, canDelete: false, reason: 'Solo administradores pueden modificar facturas' };
    }

    const now = new Date();
    const saleDate = new Date(sale.createdAt);
    const hoursDifference = (now.getTime() - saleDate.getTime()) / (1000 * 60 * 60);
    
    if (hoursDifference > 24) {
      return { 
        canEdit: false, 
        canDelete: false, 
        reason: `Factura creada hace ${Math.round(hoursDifference)}h (máximo 24h para modificaciones)` 
      };
    }

    return { canEdit: true, canDelete: true };
  };

  // Using robust formatDate from utils (handles invalid dates)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando ventas...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CreditCard className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-sales-title">
              Punto de Venta
            </h1>
            <p className="text-muted-foreground" data-testid="text-sales-subtitle">
              Facturación y registro de ventas
            </p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={openDialog} 
              disabled={!timbradoStatus.isValid}
              data-testid="button-new-sale"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nueva Venta
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Nueva Venta</DialogTitle>
              <DialogDescription>
                Registre una nueva venta y genere la factura correspondiente
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="customerId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cliente *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value || undefined}>
                          <FormControl>
                            <SelectTrigger data-testid="select-customer">
                              <SelectValue placeholder="Seleccione un cliente" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {customers.length === 0 ? (
                              <SelectItem value="" disabled>
                                No hay clientes registrados
                              </SelectItem>
                            ) : (
                              customers.map((customer) => (
                                <SelectItem key={customer.id} value={customer.id}>
                                  {customer.nombre} ({customer.docNumero})
                                  {customer.regimenTurismo && " - Turista"}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="medioPago"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Medio de Pago *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-payment-method">
                              <SelectValue placeholder="Seleccione el medio de pago" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {paymentMethods.map((method) => (
                              <SelectItem key={method.value} value={method.value}>
                                {method.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Services Selection */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Servicios</h3>
                  {services.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                      <p>No hay servicios disponibles</p>
                      <p className="text-sm">Agregue servicios desde el módulo de servicios</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {services.map((service) => (
                        <Button
                          key={service.id}
                          type="button"
                          variant="outline"
                          onClick={() => addItem('service', service.id, service.nombre, parseInt(service.precio))}
                          className="h-auto p-3 flex flex-col items-start"
                          data-testid={`button-add-service-${service.id}`}
                        >
                          <span className="font-medium">{service.nombre}</span>
                          <span className="text-sm text-muted-foreground">{formatPrice(service.precio)}</span>
                        </Button>
                      ))}
                    </div>
                  )}

                  <h3 className="text-lg font-semibold">Combos</h3>
                  {combos.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                      <p>No hay combos disponibles</p>
                      <p className="text-sm">Agregue combos desde el módulo de servicios</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {combos.map((combo) => (
                        <Button
                          key={combo.id}
                          type="button"
                          variant="outline"
                          onClick={() => addItem('combo', combo.id, combo.nombre, parseInt(combo.precioTotal))}
                          className="h-auto p-3 flex flex-col items-start"
                          data-testid={`button-add-combo-${combo.id}`}
                        >
                          <span className="font-medium">{combo.nombre}</span>
                          <span className="text-sm text-muted-foreground">{formatPrice(combo.precioTotal)}</span>
                        </Button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Selected Items */}
                {selectedItems.length > 0 && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Items Seleccionados</h3>
                    <div className="space-y-2">
                      {selectedItems.map((item, index) => (
                        <div key={`${item.type}-${item.id}`} className="flex items-center justify-between p-3 border rounded" data-testid={`item-${item.type}-${item.id}`}>
                          <div className="flex-1">
                            <span className="font-medium">{item.name}</span>
                            <span className="text-sm text-muted-foreground ml-2">
                              ({item.type === 'service' ? 'Servicio' : item.type === 'combo' ? 'Combo' : 'Producto'})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="1"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(item.type, item.id, parseInt(e.target.value) || 0)}
                              className="w-16"
                              data-testid={`input-quantity-${item.type}-${item.id}`}
                            />
                            <span className="font-medium min-w-24 text-right">
                              {formatPrice(item.price * item.quantity)}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => removeItem(item.type, item.id)}
                              data-testid={`button-remove-${item.type}-${item.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Totals */}
                    <div className="p-4 bg-muted rounded space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span className="font-medium" data-testid="text-subtotal">{formatPrice(subtotal)}</span>
                      </div>
                      {isLocalCustomer && (
                        <div className="flex justify-between">
                          <span>IVA (10%):</span>
                          <span className="font-medium" data-testid="text-taxes">{formatPrice(taxes)}</span>
                        </div>
                      )}
                      {!isLocalCustomer && (
                        <div className="flex justify-between text-green-600">
                          <span>Exento IVA (Turismo):</span>
                          <span className="font-medium">Gs. 0</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span data-testid="text-total">{formatPrice(total)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel-sale"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || selectedItems.length === 0 || !form.watch("customerId")}
                    data-testid="button-process-sale"
                  >
                    {createMutation.isPending ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Calculator className="h-4 w-4 mr-2" />
                        Procesar Venta - {formatPrice(total)}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Timbrado Status Alert */}
      {!timbradoStatus.isValid && (
        <Alert className="border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            ⚠️ {timbradoStatus.error}
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Ventas Hoy</p>
                <p className="text-2xl font-semibold text-green-600" data-testid="stat-today-sales">
                  {formatPrice(totalToday)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Facturas Hoy</p>
                <p className="text-2xl font-semibold" data-testid="stat-today-invoices">{todaySales.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Promedio por Venta</p>
                <p className="text-2xl font-semibold text-blue-600" data-testid="stat-average-sale">
                  {formatPrice(todaySales.length > 0 ? Math.round(totalToday / todaySales.length) : 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <ShoppingCart className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Total Ventas</p>
                <p className="text-2xl font-semibold text-orange-600" data-testid="stat-total-sales">{sales.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número de factura, cliente o documento..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-sales"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filterPayment} onValueChange={setFilterPayment}>
                <SelectTrigger className="w-40" data-testid="select-filter-payment">
                  <SelectValue placeholder="Medio de pago" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {paymentMethods.map((method) => (
                    <SelectItem key={method.value} value={method.value}>
                      {method.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterTourism} onValueChange={setFilterTourism}>
                <SelectTrigger className="w-32" data-testid="select-filter-tourism">
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="local">Locales</SelectItem>
                  <SelectItem value="tourism">Turistas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Sales Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSales.map((sale) => {
          const customer = customers.find(c => c.id === sale.customerId);
          const modifyPermissions = canModifySale(sale);
          
          return (
            <Card key={sale.id} className="hover-elevate" data-testid={`card-sale-${sale.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-lg" data-testid={`text-invoice-number-${sale.id}`}>
                      {sale.numeroFactura}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {sale.regimenTurismo && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        Turismo
                      </Badge>
                    )}
                    <Badge variant="outline">
                      {paymentMethods.find(m => m.value === sale.medioPago)?.label}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium" data-testid={`text-customer-${sale.id}`}>
                      {customer?.nombre}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm" data-testid={`text-date-${sale.id}`}>
                      {formatDateTimeRobust(typeof sale.fecha === 'string' ? sale.fecha : sale.fecha?.toISOString())}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span data-testid={`text-subtotal-${sale.id}`}>{formatPrice(sale.subtotal)}</span>
                  </div>
                  {parseInt(sale.impuestos) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">IVA:</span>
                      <span data-testid={`text-taxes-${sale.id}`}>{formatPrice(sale.impuestos)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span className="text-green-600" data-testid={`text-total-${sale.id}`}>
                      {formatPrice(sale.total)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-1 mt-3">
                  <Button 
                    size="sm" 
                    variant="outline"
                    className="flex-1"
                    onClick={() => {/* View details */}}
                    data-testid={`button-view-${sale.id}`}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    Ver
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => {/* Download invoice */}}
                    data-testid={`button-download-${sale.id}`}
                  >
                    <Download className="h-3 w-3" />
                  </Button>
                  
                  {/* Edit button - only show for admin users within 24-hour window */}
                  {modifyPermissions.canEdit && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => openEditDialog(sale)}
                      disabled={editMutation.isPending}
                      data-testid={`button-edit-${sale.id}`}
                      title="Editar factura (solo administradores - máximo 24h)"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  )}
                  
                  {/* Delete button - only show for admin users within 24-hour window */}
                  {modifyPermissions.canDelete && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => confirmDelete(sale)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${sale.id}`}
                      title="Eliminar factura (solo administradores - máximo 24h)"
                      className="hover:bg-red-50 hover:border-red-200 hover:text-red-700 dark:hover:bg-red-950"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                  
                  {/* Show reason tooltip when buttons are hidden */}
                  {(!modifyPermissions.canEdit || !modifyPermissions.canDelete) && modifyPermissions.reason && currentUser?.user?.role === 'admin' && (
                    <div className="text-xs text-muted-foreground mt-1" title={modifyPermissions.reason}>
                      <AlertTriangle className="h-3 w-3 inline mr-1" />
                      {modifyPermissions.reason}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredSales.length === 0 && (
        <Card className="p-8 text-center">
          <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            No se encontraron ventas
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchTerm || filterPayment !== "all" || filterTourism !== "all"
              ? "No hay ventas que coincidan con los filtros aplicados."
              : "Aún no hay ventas registradas en el sistema."
            }
          </p>
          {(!searchTerm && filterPayment === "all" && filterTourism === "all") && timbradoStatus.isValid && (
            <Button onClick={openDialog} data-testid="button-add-first-sale">
              <Plus className="h-4 w-4 mr-2" />
              Registrar Primera Venta
            </Button>
          )}
        </Card>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmSale} onOpenChange={() => setDeleteConfirmSale(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirmar Eliminación
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                ¿Está seguro que desea eliminar la factura <strong>{deleteConfirmSale?.numeroFactura}</strong>?
              </p>
              {deleteConfirmSale && (
                <div className="bg-red-50 dark:bg-red-950/20 p-3 rounded-lg text-sm">
                  <p><strong>Cliente:</strong> {customers.find(c => c.id === deleteConfirmSale.customerId)?.nombre || 'Cliente desconocido'}</p>
                  <p><strong>Total:</strong> {formatPrice(deleteConfirmSale.total)}</p>
                  <p><strong>Fecha:</strong> {formatDateTimeRobust(typeof deleteConfirmSale.fecha === 'string' ? deleteConfirmSale.fecha : deleteConfirmSale.fecha?.toISOString())}</p>
                </div>
              )}
              <p className="text-red-600 dark:text-red-400 font-medium">
                ⚠️ Esta acción no se puede deshacer y debe realizarse por motivos de corrección de errores únicamente.
              </p>
              <p className="text-sm text-muted-foreground">
                Solo se permite eliminar facturas dentro de las primeras 24 horas para cumplir con la normativa fiscal.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar Factura
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}