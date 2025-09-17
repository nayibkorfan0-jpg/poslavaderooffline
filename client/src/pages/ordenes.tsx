import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import SaleDialog from "@/components/SaleDialog";
import PrintWorkOrder from "@/components/PrintWorkOrder";
import { 
  Car, 
  Plus, 
  Edit, 
  Clock, 
  DollarSign, 
  Search,
  Filter,
  User,
  Calendar,
  CheckCircle,
  AlertCircle,
  Pause,
  Play,
  Eye,
  CreditCard,
  Printer,
  FileText
} from "lucide-react";
import { insertWorkOrderSchema, insertWorkOrderItemSchema, type WorkOrder, type Customer, type Vehicle, type Service, type InsertWorkOrderItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDateTimeRobust } from "@/lib/utils";

// Work order form schema with services
const workOrderFormSchema = insertWorkOrderSchema.extend({
  customerName: z.string().optional(),
  vehicleInfo: z.string().optional(),
  selectedServices: z.array(z.object({
    serviceId: z.string(),
    nombre: z.string(),
    precio: z.string(),
    cantidad: z.number().default(1)
  })).min(1, "Debe seleccionar al menos un servicio"),
});

type WorkOrderFormData = z.infer<typeof workOrderFormSchema>;

// Status configuration
const statusConfig = {
  recibido: { 
    label: "Recibido", 
    color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    icon: Clock 
  },
  "en_proceso": { 
    label: "En Proceso", 
    color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    icon: Play 
  },
  terminado: { 
    label: "Listo", 
    color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    icon: CheckCircle 
  },
  entregado: { 
    label: "Entregado", 
    color: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
    icon: CheckCircle 
  }
};

// Format price for Paraguay (Guaraní)
const formatPrice = (price: number | string) => {
  const numPrice = typeof price === 'string' ? parseInt(price) : price;
  return `Gs. ${numPrice.toLocaleString('es-PY')}`;
};

// Use robust formatDate from utils (handles invalid dates)

export default function OrdenesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | null>(null);
  const [isSaleDialogOpen, setIsSaleDialogOpen] = useState(false);
  const [sellingOrder, setSellingOrder] = useState<WorkOrder | null>(null);
  const [isPrintDialogOpen, setIsPrintDialogOpen] = useState(false);
  const [printingOrder, setPrintingOrder] = useState<WorkOrder | null>(null);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedServices, setSelectedServices] = useState<{serviceId: string; nombre: string; precio: string; cantidad: number}[]>([]);


  // Real data queries
  const { data: workOrders = [], isLoading } = useQuery<WorkOrder[]>({
    queryKey: ['/api/work-orders'],
  });

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
  });

  // Load vehicles only for selected customer
  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ['/api/vehicles/by-customer', selectedCustomerId],
    queryFn: async () => {
      if (!selectedCustomerId) return [];
      const response = await fetch(`/api/vehicles/by-customer/${selectedCustomerId}`);
      if (!response.ok) throw new Error('Failed to fetch vehicles');
      return response.json();
    },
    enabled: !!selectedCustomerId,
  });

  const { data: services = [], isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ['/api/services'],
  });

  // Filter work orders
  const filteredOrders = workOrders.filter(order => {
    const customer = customers.find(c => c.id === order.customerId);
    const vehicle = vehicles.find(v => v.id === order.vehicleId);
    
    const matchesSearch = 
      order.numero.toString().includes(searchTerm) ||
      customer?.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      vehicle?.placa.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === "all" || order.estado === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  // Form setup
  const form = useForm<WorkOrderFormData>({
    resolver: zodResolver(workOrderFormSchema),
    defaultValues: {
      customerId: "",
      vehicleId: "",
      estado: "recibido",
      observaciones: "",
      total: "0",
      selectedServices: [],
    },
  });

  // Calculate total from selected services
  const calculateTotal = (services: {serviceId: string; nombre: string; precio: string; cantidad: number}[]) => {
    return services.reduce((total, service) => {
      const precio = parseFloat(service.precio) || 0;
      return total + (precio * service.cantidad);
    }, 0).toString();
  };

  // Real API mutations
  const createMutation = useMutation({
    mutationFn: async (data: WorkOrderFormData) => {
      // First create the work order
      const { selectedServices, ...workOrderData } = data;
      workOrderData.total = calculateTotal(selectedServices);
      
      const workOrder = await apiRequest('POST', '/api/work-orders', workOrderData);
      
      // Then add each service as work order items
      for (const service of selectedServices) {
        const itemData: InsertWorkOrderItem = {
          workOrderId: workOrder.id,
          serviceId: service.serviceId,
          comboId: null,
          nombre: service.nombre,
          precio: service.precio,
          cantidad: service.cantidad
        };
        
        await apiRequest('POST', `/api/work-orders/${workOrder.id}/items`, itemData);
      }
      
      return workOrder;
    },
    onSuccess: () => {
      // Comprehensive cache invalidation for real-time updates
      queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] }); // Dashboard aggregated data
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] }); // Customer updates
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] }); // Vehicle updates
      
      setIsDialogOpen(false);
      form.reset();
      setSelectedCustomerId("");
      setSelectedServices([]);
      toast({
        title: "Orden creada",
        description: "La orden de servicio se ha creado correctamente.",
      });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: string }) => {
      return apiRequest('PUT', `/api/work-orders/${id}`, { estado: newStatus });
    },
    onSuccess: () => {
      // Comprehensive cache invalidation for real-time updates
      queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] }); // Dashboard aggregated data
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] }); // In case order affects sales metrics
      
      toast({
        title: "Estado actualizado",
        description: "El estado de la orden se ha actualizado correctamente.",
      });
    },
  });

  const onSubmit = (data: WorkOrderFormData) => {
    // Validate that services are selected
    if (selectedServices.length === 0) {
      toast({
        title: "Error de validación",
        description: "Debe seleccionar al menos un servicio.",
        variant: "destructive"
      });
      return;
    }

    // Update data with selected services before submitting
    const updatedData = {
      ...data,
      selectedServices
    };
    createMutation.mutate(updatedData);
  };

  // Handle customer selection
  const handleCustomerChange = (customerId: string) => {
    setSelectedCustomerId(customerId);
    form.setValue('customerId', customerId);
    form.setValue('vehicleId', ''); // Reset vehicle selection
  };

  // Handle service selection
  const handleServiceToggle = (service: Service) => {
    const isSelected = selectedServices.some(s => s.serviceId === service.id);
    
    if (isSelected) {
      // Remove service
      setSelectedServices(prev => prev.filter(s => s.serviceId !== service.id));
    } else {
      // Add service
      setSelectedServices(prev => [...prev, {
        serviceId: service.id,
        nombre: service.nombre,
        precio: service.precio,
        cantidad: 1
      }]);
    }
  };

  // Update service quantity
  const updateServiceQuantity = (serviceId: string, cantidad: number) => {
    if (cantidad <= 0) return;
    setSelectedServices(prev => 
      prev.map(s => s.serviceId === serviceId ? { ...s, cantidad } : s)
    );
  };

  // Calculate current total
  const currentTotal = calculateTotal(selectedServices);

  // Handle opening sale dialog
  const handleSale = (order: WorkOrder) => {
    setSellingOrder(order);
    setIsSaleDialogOpen(true);
  };

  // Handle closing sale dialog
  const handleCloseSaleDialog = () => {
    setSellingOrder(null);
    setIsSaleDialogOpen(false);
  };

  // Handle order delivered status update from SaleDialog
  const handleOrderDelivered = (orderId: string) => {
    updateStatusMutation.mutate({ id: orderId, newStatus: "entregado" });
  };

  // Handle print order (independent of billing)
  const handlePrintOrder = (order: WorkOrder) => {
    setPrintingOrder(order);
    setIsPrintDialogOpen(true);
  };

  // Handle closing print dialog
  const handleClosePrintDialog = () => {
    setPrintingOrder(null);
    setIsPrintDialogOpen(false);
  };

  // Handle opening dialog for editing
  const openDialog = (order?: WorkOrder) => {
    if (order) {
      setEditingOrder(order);
      setSelectedCustomerId(order.customerId);
      form.reset({
        customerId: order.customerId,
        vehicleId: order.vehicleId,
        estado: order.estado,
        observaciones: order.observaciones || "",
        total: order.total,
        selectedServices: [],
      });
      // TODO: Load existing work order items when editing
      setSelectedServices([]);
    } else {
      setEditingOrder(null);
      setSelectedCustomerId("");
      setSelectedServices([]);
      form.reset({
        customerId: "",
        vehicleId: "",
        estado: "recibido",
        observaciones: "",
        total: "0",
        selectedServices: [],
      });
    }
    setIsDialogOpen(true);
  };

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateStatusMutation.mutate({ id: orderId, newStatus });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando órdenes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Car className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-orders-title">
              Órdenes de Servicio
            </h1>
            <p className="text-muted-foreground" data-testid="text-orders-subtitle">
              Gestione las órdenes de trabajo del lavadero
            </p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} data-testid="button-add-order">
              <Plus className="h-4 w-4 mr-2" />
              Nueva Orden
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingOrder ? "Editar Orden" : "Nueva Orden de Servicio"}
              </DialogTitle>
              <DialogDescription>
                {editingOrder ? "Modifique los datos de la orden" : "Registre una nueva orden de servicio"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cliente *</FormLabel>
                      <Select onValueChange={handleCustomerChange} value={selectedCustomerId}>
                        <FormControl>
                          <SelectTrigger data-testid="select-customer">
                            <SelectValue placeholder="Seleccione un cliente" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.nombre} ({customer.docNumero})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="vehicleId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Vehículo *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value} disabled={!selectedCustomerId}>
                        <FormControl>
                          <SelectTrigger data-testid="select-vehicle">
                            <SelectValue placeholder={selectedCustomerId ? "Seleccione un vehículo" : "Primero seleccione un cliente"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {vehicles.map((vehicle) => (
                            <SelectItem key={vehicle.id} value={vehicle.id}>
                              {vehicle.placa} - {vehicle.marca} {vehicle.modelo} {vehicle.color}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Service Selection */}
                <div className="space-y-3">
                  <FormLabel>Servicios *</FormLabel>
                  <div className="border rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                    {servicesLoading ? (
                      <div className="text-sm text-muted-foreground">Cargando servicios...</div>
                    ) : services.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No hay servicios disponibles</div>
                    ) : (
                      services.filter(service => service.activo).map((service) => {
                        const isSelected = selectedServices.some(s => s.serviceId === service.id);
                        const selectedService = selectedServices.find(s => s.serviceId === service.id);
                        
                        return (
                          <div key={service.id} className="flex items-center justify-between p-2 border rounded hover-elevate">
                            <div className="flex items-center space-x-3 flex-1">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleServiceToggle(service)}
                                className="rounded"
                                data-testid={`checkbox-service-${service.id}`}
                              />
                              <div className="flex-1">
                                <div className="font-medium text-sm">{service.nombre}</div>
                                <div className="text-xs text-muted-foreground">{formatPrice(service.precio)}</div>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="flex items-center space-x-2">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateServiceQuantity(service.id, (selectedService?.cantidad || 1) - 1)}
                                  disabled={(selectedService?.cantidad || 1) <= 1}
                                  data-testid={`button-decrease-${service.id}`}
                                >
                                  -
                                </Button>
                                <span className="text-sm font-medium w-8 text-center" data-testid={`quantity-${service.id}`}>
                                  {selectedService?.cantidad || 1}
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => updateServiceQuantity(service.id, (selectedService?.cantidad || 1) + 1)}
                                  data-testid={`button-increase-${service.id}`}
                                >
                                  +
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                  {selectedServices.length === 0 && (
                    <p className="text-sm text-red-500" data-testid="error-no-services">Debe seleccionar al menos un servicio</p>
                  )}
                  {selectedServices.length > 0 && (
                    <div className="text-sm text-green-600" data-testid="text-services-selected">
                      {selectedServices.length} servicio{selectedServices.length > 1 ? 's' : ''} seleccionado{selectedServices.length > 1 ? 's' : ''}
                    </div>
                  )}
                </div>

                {/* Total Display */}
                {selectedServices.length > 0 && (
                  <div className="border-t pt-3">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Total:</span>
                      <span className="text-lg font-bold text-green-600" data-testid="text-total-amount">
                        {formatPrice(currentTotal)}
                      </span>
                    </div>
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="observaciones"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observaciones</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Observaciones especiales..." 
                          {...field} 
                          value={field.value || ""}
                          data-testid="input-observations"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel-order"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || selectedServices.length === 0 || !selectedCustomerId || !form.watch('vehicleId')}
                    data-testid="button-save-order"
                  >
                    {createMutation.isPending ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Guardando...
                      </>
                    ) : (
                      editingOrder ? "Actualizar" : "Crear Orden"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por número, cliente o placa..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-orders"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-40" data-testid="select-filter-status">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="recibido">Recibido</SelectItem>
                  <SelectItem value="en_proceso">En Proceso</SelectItem>
                  <SelectItem value="terminado">Listo</SelectItem>
                  <SelectItem value="entregado">Entregado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredOrders.map((order) => {
          const customer = customers.find(c => c.id === order.customerId);
          const vehicle = vehicles.find(v => v.id === order.vehicleId);
          const status = statusConfig[order.estado as keyof typeof statusConfig];
          const StatusIcon = status.icon;

          return (
            <Card key={order.id} className="hover-elevate" data-testid={`card-order-${order.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-lg" data-testid={`text-order-number-${order.id}`}>
                      #{order.numero}
                    </span>
                  </div>
                  <Badge className={status.color} data-testid={`badge-status-${order.id}`}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {status.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium" data-testid={`text-customer-${order.id}`}>
                      {customer?.nombre}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Car className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm" data-testid={`text-vehicle-${order.id}`}>
                      {vehicle?.placa} - {vehicle?.marca} {vehicle?.modelo}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm" data-testid={`text-date-${order.id}`}>
                      {formatDateTimeRobust(typeof order.fechaEntrada === 'string' ? order.fechaEntrada : order.fechaEntrada?.toISOString())}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span className="font-semibold text-green-600" data-testid={`text-total-${order.id}`}>
                      {formatPrice(order.total)}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handlePrintOrder(order)}
                      data-testid={`button-print-order-${order.id}`}
                      title="Imprimir Orden"
                    >
                      <Printer className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {/* View details */}}
                      data-testid={`button-view-${order.id}`}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => openDialog(order)}
                      data-testid={`button-edit-${order.id}`}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {order.observaciones && (
                  <div className="mt-3 p-2 bg-muted rounded text-sm" data-testid={`text-observations-${order.id}`}>
                    {order.observaciones}
                  </div>
                )}

                {/* Status Actions */}
                <div className="flex gap-1 mt-3">
                  {order.estado === "recibido" && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleStatusChange(order.id, "en_proceso")}
                      data-testid={`button-start-${order.id}`}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Iniciar
                    </Button>
                  )}
                  {order.estado === "en_proceso" && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleStatusChange(order.id, "terminado")}
                      data-testid={`button-finish-${order.id}`}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Finalizar
                    </Button>
                  )}
                  {order.estado === "terminado" && (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => handleStatusChange(order.id, "entregado")}
                        data-testid={`button-deliver-${order.id}`}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Entregar
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={() => handleSale(order)}
                        data-testid={`button-bill-${order.id}`}
                        className="ml-1"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Facturar
                      </Button>
                    </>
                  )}
                  {order.estado === "entregado" && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleSale(order)}
                      data-testid={`button-bill-delivered-${order.id}`}
                    >
                      <FileText className="h-3 w-3 mr-1" />
                      Facturar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredOrders.length === 0 && (
        <Card className="p-8 text-center">
          <Car className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            No se encontraron órdenes
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchTerm || filterStatus !== "all" 
              ? "No hay órdenes que coincidan con los filtros aplicados."
              : "Aún no hay órdenes registradas en el sistema."
            }
          </p>
          {(!searchTerm && filterStatus === "all") && (
            <Button onClick={() => openDialog()} data-testid="button-add-first-order">
              <Plus className="h-4 w-4 mr-2" />
              Crear Primera Orden
            </Button>
          )}
        </Card>
      )}

      {/* Sale Dialog */}
      <SaleDialog
        isOpen={isSaleDialogOpen}
        onClose={handleCloseSaleDialog}
        workOrder={sellingOrder}
        customer={sellingOrder ? customers.find(c => c.id === sellingOrder.customerId) || null : null}
        services={services}
        onOrderDelivered={handleOrderDelivered}
      />

      {/* Print Work Order Dialog */}
      <PrintWorkOrder
        isOpen={isPrintDialogOpen}
        onClose={handleClosePrintDialog}
        workOrder={printingOrder}
      />
    </div>
  );
}