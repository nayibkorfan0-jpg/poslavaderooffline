import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { 
  CreditCard, 
  Plus, 
  Minus,
  Search,
  AlertTriangle,
  DollarSign,
  User,
  Car,
  FileText,
  Trash2,
  ShoppingCart,
  Calculator,
  Printer,
  Save,
  UserCheck
} from "lucide-react";
import { insertSaleSchema, type WorkOrder, type Customer, type Service, type InventoryItem, type WorkOrderItem } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

// Sale form schema
const saleFormSchema = insertSaleSchema.extend({
  items: z.array(z.object({
    type: z.enum(['service', 'combo', 'product']),
    id: z.string(),
    name: z.string(),
    price: z.number(),
    quantity: z.number().min(1),
    total: z.number(),
  })).min(1, "Debe agregar al menos un item"),
  customerData: z.object({
    id: z.string(),
    nombre: z.string(),
    docNumero: z.string(),
    regimenTurismo: z.boolean(),
  }),
  calculatedSubtotal: z.number(),
  calculatedTax: z.number(),
  calculatedTotal: z.number(),
});

type SaleFormData = z.infer<typeof saleFormSchema>;

interface SaleItem {
  type: 'service' | 'combo' | 'product';
  id: string;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

interface SaleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder | null;
  customer: Customer | null;
  services: Service[];
  onOrderDelivered?: (orderId: string) => void;
}

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

export default function SaleDialog({ isOpen, onClose, workOrder, customer, services, onOrderDelivered }: SaleDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [timbradoStatus, setTimbradoStatus] = useState<{ isValid: boolean; error?: string }>({ isValid: true });
  const [markAsDelivered, setMarkAsDelivered] = useState(false);

  // Fetch real inventory items from API
  const { data: inventoryItems = [] } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory'],
    enabled: isOpen,
  });

  // Check timbrado status on component mount
  const { data: timbradoData } = useQuery({
    queryKey: ['/api/timbrado/status'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/timbrado/status');
      if (!response.ok) throw new Error('Failed to check timbrado status');
      return response;
    },
    enabled: isOpen,
  });

  // Fetch WorkOrderItems when workOrder is provided
  const { data: workOrderItems = [], isLoading: workOrderItemsLoading } = useQuery<WorkOrderItem[]>({
    queryKey: ['/api/work-orders', workOrder?.id, 'items'],
    queryFn: async () => {
      if (!workOrder?.id) return [];
      const response = await apiRequest('GET', `/api/work-orders/${workOrder.id}/items`);
      if (!response.ok) throw new Error('Failed to fetch work order items');
      return response;
    },
    enabled: isOpen && !!workOrder?.id,
  });

  useEffect(() => {
    if (timbradoData) {
      setTimbradoStatus({
        isValid: timbradoData.isValid,
        error: timbradoData.error
      });
    }
  }, [timbradoData]);

  // Initialize items from work order items
  useEffect(() => {
    if (workOrder && workOrderItems.length > 0 && isOpen) {
      // Convert WorkOrderItems to SaleItems
      const saleItems = workOrderItems.map(item => {
        let type: 'service' | 'combo' | 'product' = 'service';
        if (item.serviceId) type = 'service';
        else if (item.comboId) type = 'combo';
        else type = 'product';
        
        return {
          type,
          id: item.serviceId || item.comboId || item.id,
          name: item.nombre,
          price: parseInt(item.precio),
          quantity: item.cantidad,
          total: parseInt(item.precio) * item.cantidad,
        };
      });
      setItems(saleItems);
    } else if (!workOrder && isOpen) {
      // Clear items when no work order (standalone sale)
      setItems([]);
    }
  }, [workOrder, workOrderItems, isOpen]);

  // Calculate totals
  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxAmount = customer?.regimenTurismo ? 0 : Math.round(subtotal * TAX_RATE);
  const total = subtotal + taxAmount;

  // Form setup
  const form = useForm<SaleFormData>({
    resolver: zodResolver(saleFormSchema),
    defaultValues: {
      customerId: customer?.id || "",
      workOrderId: workOrder?.id || null,
      medioPago: "efectivo",
      regimenTurismo: customer?.regimenTurismo || false,
      subtotal: "0",
      impuestos: "0",
      total: "0",
      items: [],
      customerData: customer ? {
        id: customer.id,
        nombre: customer.nombre,
        docNumero: customer.docNumero,
        regimenTurismo: customer.regimenTurismo || false,
      } : undefined,
      calculatedSubtotal: 0,
      calculatedTax: 0,
      calculatedTotal: 0,
    },
  });

  // Update form when items or customer change
  useEffect(() => {
    form.setValue('items', items);
    form.setValue('subtotal', subtotal.toString());
    form.setValue('impuestos', taxAmount.toString());
    form.setValue('total', total.toString());
    form.setValue('calculatedSubtotal', subtotal);
    form.setValue('calculatedTax', taxAmount);
    form.setValue('calculatedTotal', total);
    
    if (customer) {
      form.setValue('customerData', {
        id: customer.id,
        nombre: customer.nombre,
        docNumero: customer.docNumero,
        regimenTurismo: customer.regimenTurismo || false,
      });
      form.setValue('regimenTurismo', customer.regimenTurismo || false);
    }
  }, [items, customer, subtotal, taxAmount, total, form]);

  // Create sale mutation
  const createSaleMutation = useMutation({
    mutationFn: async (data: { saleData: SaleFormData; action: 'save' | 'save-print' | 'print' }) => {
      const endpoint = workOrder ? '/api/sales/create-from-order' : '/api/sales';
      const payload = workOrder ? data : data.saleData;
      const response = await apiRequest('POST', endpoint, payload);
      if (!response.ok) throw new Error('Failed to create sale');
      return response;
    },
    onSuccess: (data, variables) => {
      toast({
        title: "Venta creada exitosamente",
        description: `Factura ${data.numeroFactura} generada`,
      });
      
      // Handle printing if requested
      if (variables.action === 'save-print' || variables.action === 'print') {
        handlePrint(data);
      }
      
      // Mark order as delivered if option is selected
      if (markAsDelivered && workOrder && onOrderDelivered) {
        onOrderDelivered(workOrder.id);
      }
      
      // Comprehensive cache invalidation for real-time updates
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] }); // For stock updates
      queryClient.invalidateQueries({ queryKey: ['/api/work-orders'] }); // Always invalidate for dashboard
      queryClient.invalidateQueries({ queryKey: ['/api/company-config'] }); // Dashboard config
      
      // Specific work order invalidation if linked
      if (workOrder) {
        queryClient.invalidateQueries({ queryKey: ['/api/work-orders', workOrder.id] });
        queryClient.invalidateQueries({ queryKey: ['/api/work-orders', workOrder.id, 'items'] });
      }
      
      // Invalidate any dashboard-related aggregated data queries
      queryClient.invalidateQueries({ queryKey: ['/api/dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] }); // For customer updates
      
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear venta",
        description: error.message || "Ocurrió un error inesperado",
        variant: "destructive",
      });
    },
  });

  // Handle print function
  const handlePrint = (saleData: any) => {
    // Open print window with invoice data
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Factura ${saleData.numeroFactura}</title>
            <style>
              body { font-family: monospace; margin: 0; padding: 20px; }
              .invoice { max-width: 300px; margin: 0 auto; }
              .header { text-align: center; border-bottom: 1px solid #000; padding-bottom: 10px; }
              .items { margin: 10px 0; }
              .item { display: flex; justify-content: space-between; margin: 5px 0; }
              .totals { border-top: 1px solid #000; padding-top: 10px; margin-top: 10px; }
              .total-line { display: flex; justify-content: space-between; }
              .footer { text-align: center; margin-top: 20px; border-top: 1px solid #000; padding-top: 10px; }
            </style>
          </head>
          <body>
            <div class="invoice">
              <div class="header">
                <h3>1SOLUTION</h3>
                <p>Car Wash Service</p>
                <p>Factura: ${saleData.numeroFactura}</p>
                <p>Fecha: ${new Date().toLocaleDateString('es-PY')}</p>
              </div>
              <div style="margin: 10px 0;">
                <p><strong>Cliente:</strong> ${customer?.nombre}</p>
                <p><strong>Documento:</strong> ${customer?.docNumero}</p>
                ${customer?.regimenTurismo ? '<p><strong>Régimen Turismo</strong></p>' : ''}
              </div>
              <div class="items">
                ${items.map(item => `
                  <div class="item">
                    <span>${item.name} (${item.quantity})</span>
                    <span>${formatPrice(item.total)}</span>
                  </div>
                `).join('')}
              </div>
              <div class="totals">
                <div class="total-line">
                  <span>Subtotal:</span>
                  <span>${formatPrice(subtotal)}</span>
                </div>
                ${taxAmount > 0 ? `
                  <div class="total-line">
                    <span>IVA (10%):</span>
                    <span>${formatPrice(taxAmount)}</span>
                  </div>
                ` : '<div class="total-line"><span>Exento IVA (Turismo)</span></div>'}
                <div class="total-line" style="font-weight: bold; font-size: 1.2em;">
                  <span>Total:</span>
                  <span>${formatPrice(total)}</span>
                </div>
              </div>
              <div class="footer">
                <p>Medio de Pago: ${form.getValues('medioPago')}</p>
                <p>¡Gracias por su preferencia!</p>
              </div>
            </div>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  // Add item to sale
  const addItem = (type: 'service' | 'product', item: Service | InventoryItem) => {
    const existingItemIndex = items.findIndex(i => i.id === item.id && i.type === type);
    
    if (existingItemIndex >= 0) {
      // Increment quantity if item already exists
      const updatedItems = [...items];
      updatedItems[existingItemIndex].quantity += 1;
      updatedItems[existingItemIndex].total = updatedItems[existingItemIndex].price * updatedItems[existingItemIndex].quantity;
      setItems(updatedItems);
    } else {
      // Add new item
      const newItem: SaleItem = {
        type,
        id: item.id,
        name: 'nombre' in item ? item.nombre : (item as any).nombre,
        price: parseInt('precio' in item ? item.precio : (item as any).precio),
        quantity: 1,
        total: parseInt('precio' in item ? item.precio : (item as any).precio),
      };
      setItems([...items, newItem]);
    }
  };

  // Update item quantity
  const updateItemQuantity = (index: number, quantity: number) => {
    if (quantity <= 0) {
      removeItem(index);
      return;
    }
    
    const updatedItems = [...items];
    updatedItems[index].quantity = quantity;
    updatedItems[index].total = updatedItems[index].price * quantity;
    setItems(updatedItems);
  };

  // Remove item
  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Handle form submission
  const onSubmit = (action: 'save' | 'save-print' | 'print') => {
    const formData = form.getValues();
    
    if (items.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos un item a la venta",
        variant: "destructive",
      });
      return;
    }

    if (!timbradoStatus.isValid) {
      toast({
        title: "Error de Timbrado",
        description: timbradoStatus.error || "Timbrado no válido",
        variant: "destructive",
      });
      return;
    }

    createSaleMutation.mutate({ saleData: formData, action });
  };

  // Filter available products for search
  const filteredProducts = inventoryItems.filter(item =>
    item.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredServices = services.filter(service =>
    service.nombre.toLowerCase().includes(searchTerm.toLowerCase()) && service.activo
  );

  if (!customer) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            {workOrder ? `Punto de Venta - Orden #${workOrder.numero}` : 'Punto de Venta'}
          </DialogTitle>
          <DialogDescription>
            Cliente: {customer.nombre} ({customer.docNumero})
            {customer.regimenTurismo && (
              <Badge variant="secondary" className="ml-2">
                Régimen Turismo
              </Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        {!timbradoStatus.isValid && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {timbradoStatus.error}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-6">
          {/* Left Column - Items Selection */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Agregar Items</h3>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  data-testid="input-search-items"
                  placeholder="Buscar servicios o productos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>

            <ScrollArea className="h-64">
              <div className="space-y-2">
                {searchTerm && (
                  <>
                    {/* Services */}
                    {filteredServices.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Servicios</h4>
                        {filteredServices.map(service => (
                          <div
                            key={service.id}
                            className="flex items-center justify-between p-2 border rounded-md hover-elevate cursor-pointer"
                            onClick={() => addItem('service', service)}
                            data-testid={`service-item-${service.id}`}
                          >
                            <div>
                              <p className="font-medium">{service.nombre}</p>
                              <p className="text-sm text-muted-foreground">{formatPrice(service.precio)}</p>
                            </div>
                            <Button size="sm" variant="outline">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Products */}
                    {filteredProducts.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-2">Productos</h4>
                        {filteredProducts.map(product => (
                          <div
                            key={product.id}
                            className="flex items-center justify-between p-2 border rounded-md hover-elevate cursor-pointer"
                            onClick={() => addItem('product', product)}
                            data-testid={`product-item-${product.id}`}
                          >
                            <div>
                              <p className="font-medium">{product.nombre}</p>
                              <p className="text-sm text-muted-foreground">
                                {formatPrice(15000)} (Stock: {product.stockActual})
                              </p>
                            </div>
                            <Button size="sm" variant="outline">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                
                {searchTerm && filteredServices.length === 0 && filteredProducts.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    No se encontraron resultados
                  </p>
                )}
                
                {!searchTerm && (
                  <p className="text-center text-muted-foreground py-4">
                    Escribe para buscar servicios o productos
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Right Column - Cart and Checkout */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">Items de Venta</h3>
              <ScrollArea className="h-64 border rounded-md p-2">
                {items.length > 0 ? (
                  <div className="space-y-2">
                    {items.map((item, index) => (
                      <div key={`${item.type}-${item.id}-${index}`} className="flex items-center justify-between p-2 bg-muted rounded-md">
                        <div className="flex-1">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatPrice(item.price)} c/u
                          </p>
                          <Badge variant="outline" className="text-xs">
                            {item.type === 'service' ? 'Servicio' : 'Producto'}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateItemQuantity(index, item.quantity - 1)}
                            data-testid={`button-decrease-${index}`}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <span className="w-8 text-center font-medium" data-testid={`quantity-${index}`}>
                            {item.quantity}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateItemQuantity(index, item.quantity + 1)}
                            data-testid={`button-increase-${index}`}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeItem(index)}
                            data-testid={`button-remove-${index}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-right font-medium w-24" data-testid={`total-${index}`}>
                          {formatPrice(item.total)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    No hay items en la venta
                  </p>
                )}
              </ScrollArea>
            </div>

            {/* Payment and Totals */}
            <Form {...form}>
              <div className="space-y-4">
                <FormField
                  control={form.control}
                  name="medioPago"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Medio de Pago</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger data-testid="select-payment-method">
                            <SelectValue placeholder="Seleccionar medio de pago" />
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

                <Card>
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <span data-testid="subtotal-amount">{formatPrice(subtotal)}</span>
                      </div>
                      {customer.regimenTurismo ? (
                        <div className="flex justify-between text-muted-foreground">
                          <span>IVA (Exento - Turismo):</span>
                          <span>Gs. 0</span>
                        </div>
                      ) : (
                        <div className="flex justify-between">
                          <span>IVA (10%):</span>
                          <span data-testid="tax-amount">{formatPrice(taxAmount)}</span>
                        </div>
                      )}
                      <Separator />
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total:</span>
                        <span data-testid="total-amount">{formatPrice(total)}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Mark as delivered option when billing from work order */}
                {workOrder && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="mark-delivered"
                      checked={markAsDelivered}
                      onCheckedChange={(checked) => setMarkAsDelivered(checked === true)}
                      data-testid="checkbox-mark-delivered"
                    />
                    <label htmlFor="mark-delivered" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Marcar orden como entregada después de facturar
                    </label>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={() => onSubmit('save')}
                    disabled={createSaleMutation.isPending || !timbradoStatus.isValid}
                    className="flex-1"
                    data-testid="button-save"
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {createSaleMutation.isPending ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button
                    onClick={() => onSubmit('save-print')}
                    disabled={createSaleMutation.isPending || !timbradoStatus.isValid}
                    className="flex-1"
                    data-testid="button-save-print"
                  >
                    <Printer className="h-4 w-4 mr-2" />
                    Guardar e Imprimir
                  </Button>
                </div>
              </div>
            </Form>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}