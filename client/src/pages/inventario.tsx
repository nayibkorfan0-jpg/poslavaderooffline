import { useState } from "react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Package, 
  Plus, 
  Edit, 
  Search,
  Filter,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Package2,
  Calendar,
  User,
  Eye,
  ShoppingCart,
  Minus,
  RefreshCw
} from "lucide-react";
import { insertInventoryItemSchema, type InventoryItem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Inventory form schema
const inventoryFormSchema = insertInventoryItemSchema;

type InventoryFormData = z.infer<typeof inventoryFormSchema>;

// Stock level categories
const getStockStatus = (current: number, minimum: number) => {
  if (current <= 0) {
    return { 
      status: 'agotado', 
      label: 'Agotado', 
      color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      icon: AlertTriangle 
    };
  } else if (current <= minimum) {
    return { 
      status: 'critico', 
      label: 'Stock Crítico', 
      color: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      icon: TrendingDown 
    };
  } else if (current <= minimum * 1.5) {
    return { 
      status: 'bajo', 
      label: 'Stock Bajo', 
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      icon: TrendingDown 
    };
  } else {
    return { 
      status: 'normal', 
      label: 'Stock Normal', 
      color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      icon: TrendingUp 
    };
  }
};

// Unit types
const unitTypes = [
  { value: "UN", label: "Unidades" },
  { value: "LT", label: "Litros" },
  { value: "KG", label: "Kilogramos" },
  { value: "MT", label: "Metros" },
  { value: "BOT", label: "Botellas" },
  { value: "GAL", label: "Galones" },
];


export default function InventarioPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterAlert, setFilterAlert] = useState<string>("all");
  const [filterUnit, setFilterUnit] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isStockDialogOpen, setIsStockDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [stockItem, setStockItem] = useState<InventoryItem | null>(null);
  const [stockQuantity, setStockQuantity] = useState<string>("");
  const [stockAction, setStockAction] = useState<'add' | 'remove'>('add');

  // Real data queries
  const { data: inventory = [], isLoading } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory'],
    select: (data) => Array.isArray(data) ? data : []
  });

  // Ensure inventory is always an array
  const inventoryArr = Array.isArray(inventory) ? inventory : [];
  
  // Filter inventory
  const filteredInventory = inventoryArr.filter(item => {
    const matchesSearch = 
      item.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.descripcion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.proveedor?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAlert = filterAlert === "all" || item.estadoAlerta === filterAlert;
    const matchesUnit = filterUnit === "all" || item.unidadMedida === filterUnit;
    
    return matchesSearch && matchesAlert && matchesUnit;
  });

  // Calculate stats
  const stats = {
    total: inventoryArr.length,
    critical: inventoryArr.filter(item => item.stockActual <= 0 || item.estadoAlerta === 'critico').length,
    low: inventoryArr.filter(item => item.estadoAlerta === 'bajo').length,
    normal: inventoryArr.filter(item => item.estadoAlerta === 'normal').length,
  };

  // Form setup
  const form = useForm<InventoryFormData>({
    resolver: zodResolver(inventoryFormSchema),
    defaultValues: {
      nombre: "",
      descripcion: "",
      stockActual: 0,
      stockMinimo: 0,
      unidadMedida: "UN",
      proveedor: "",
      ultimoPedido: "",
      estadoAlerta: "normal",
      activo: true,
    },
  });

  // Real mutations
  const createMutation = useMutation({
    mutationFn: async (data: InventoryFormData) => {
      return await apiRequest('POST', '/api/inventory', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Producto creado",
        description: "El producto se ha agregado al inventario.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudo crear el producto: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InventoryFormData }) => {
      return await apiRequest('PUT', `/api/inventory/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      setIsDialogOpen(false);
      setEditingItem(null);
      form.reset();
      toast({
        title: "Producto actualizado",
        description: "Los datos del producto se han actualizado.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudo actualizar el producto: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateStockMutation = useMutation({
    mutationFn: async ({ id, action, quantity }: { id: string; action: 'add' | 'remove'; quantity: number }) => {
      return await apiRequest('PUT', `/api/inventory/${id}/stock`, { action, quantity });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['/api/inventory'] });
      setIsStockDialogOpen(false);
      setStockItem(null);
      setStockQuantity("");
      toast({
        title: `Stock ${variables.action === 'add' ? 'agregado' : 'descontado'}`,
        description: `Se han ${variables.action === 'add' ? 'agregado' : 'descontado'} ${variables.quantity} unidades.`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudo actualizar el stock: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InventoryFormData) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleStockUpdate = () => {
    const quantity = parseInt(stockQuantity);
    if (!stockItem || !quantity || quantity <= 0) return;
    
    updateStockMutation.mutate({
      id: stockItem.id,
      action: stockAction,
      quantity
    });
  };

  const openDialog = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      form.reset({
        nombre: item.nombre,
        descripcion: item.descripcion || "",
        stockActual: item.stockActual,
        stockMinimo: item.stockMinimo,
        unidadMedida: item.unidadMedida,
        proveedor: item.proveedor || "",
        ultimoPedido: item.ultimoPedido || "",
        estadoAlerta: item.estadoAlerta,
        activo: item.activo,
      });
    } else {
      setEditingItem(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const openStockDialog = (item: InventoryItem) => {
    setStockItem(item);
    setStockQuantity("");
    setStockAction('add');
    setIsStockDialogOpen(true);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Nunca";
    return new Date(dateString).toLocaleDateString('es-PY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando inventario...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-inventory-title">
              Control de Inventario
            </h1>
            <p className="text-muted-foreground" data-testid="text-inventory-subtitle">
              Gestione productos, stock y alertas
            </p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} data-testid="button-add-product">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Producto
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingItem ? "Editar Producto" : "Nuevo Producto"}
              </DialogTitle>
              <DialogDescription>
                {editingItem ? "Modifique los datos del producto" : "Agregue un nuevo producto al inventario"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del Producto *</FormLabel>
                      <FormControl>
                        <Input placeholder="Shampoo para Auto" {...field} data-testid="input-product-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="descripcion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Descripción del producto..." 
                          {...field} 
                          value={field.value || ""}
                          data-testid="input-product-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="stockActual"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock Actual *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0" 
                            {...field} 
                            data-testid="input-current-stock"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="stockMinimo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stock Mínimo *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="0" 
                            {...field} 
                            data-testid="input-minimum-stock"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="unidadMedida"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidad *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-unit">
                              <SelectValue placeholder="Unidad" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {unitTypes.map((unit) => (
                              <SelectItem key={unit.value} value={unit.value}>
                                {unit.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="proveedor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Proveedor</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Nombre del proveedor" 
                          {...field} 
                          value={field.value || ""}
                          data-testid="input-supplier"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="ultimoPedido"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Último Pedido</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          value={field.value || ""}
                          data-testid="input-last-order"
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
                    data-testid="button-cancel-product"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-product"
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Guardando...
                      </>
                    ) : (
                      editingItem ? "Actualizar" : "Crear Producto"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stock Update Dialog */}
      <Dialog open={isStockDialogOpen} onOpenChange={setIsStockDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Actualizar Stock</DialogTitle>
            <DialogDescription>
              Agregue o descuente stock de {stockItem?.nombre}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant={stockAction === 'add' ? 'default' : 'outline'}
                onClick={() => setStockAction('add')}
                data-testid="button-add-stock"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar
              </Button>
              <Button 
                variant={stockAction === 'remove' ? 'default' : 'outline'}
                onClick={() => setStockAction('remove')}
                data-testid="button-remove-stock"
              >
                <Minus className="h-4 w-4 mr-2" />
                Descontar
              </Button>
            </div>
            
            <div>
              <label className="text-sm font-medium">
                Cantidad a {stockAction === 'add' ? 'agregar' : 'descontar'}
              </label>
              <Input
                type="number"
                placeholder="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                data-testid="input-stock-quantity"
              />
            </div>

            {stockItem && (
              <div className="p-3 bg-muted rounded text-sm">
                <div className="flex justify-between">
                  <span>Stock actual:</span>
                  <span className="font-medium">{stockItem.stockActual} {stockItem.unidadMedida}</span>
                </div>
                <div className="flex justify-between">
                  <span>Stock mínimo:</span>
                  <span className="font-medium">{stockItem.stockMinimo} {stockItem.unidadMedida}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={() => setIsStockDialogOpen(false)}
                data-testid="button-cancel-stock"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleStockUpdate}
                disabled={updateStockMutation.isPending || !stockQuantity || parseInt(stockQuantity) <= 0}
                data-testid="button-confirm-stock"
              >
                {updateStockMutation.isPending ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Actualizando...
                  </>
                ) : (
                  stockAction === 'add' ? 'Agregar Stock' : 'Descontar Stock'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Package2 className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Total Productos</p>
                <p className="text-2xl font-semibold" data-testid="stat-total-products">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div>
                <p className="text-sm text-muted-foreground">Stock Crítico</p>
                <p className="text-2xl font-semibold text-red-600" data-testid="stat-critical-products">{stats.critical}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Stock Bajo</p>
                <p className="text-2xl font-semibold text-orange-600" data-testid="stat-low-products">{stats.low}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Stock Normal</p>
                <p className="text-2xl font-semibold text-green-600" data-testid="stat-normal-products">{stats.normal}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Critical Stock Alert */}
      {stats.critical > 0 && (
        <Alert className="border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800 dark:text-red-200">
            ⚠️ Hay {stats.critical} productos con stock crítico o agotado que requieren atención inmediata.
          </AlertDescription>
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar productos, descripción o proveedor..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-inventory"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filterAlert} onValueChange={setFilterAlert}>
                <SelectTrigger className="w-40" data-testid="select-filter-alert">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="critico">Crítico</SelectItem>
                  <SelectItem value="bajo">Bajo</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterUnit} onValueChange={setFilterUnit}>
                <SelectTrigger className="w-32" data-testid="select-filter-unit">
                  <SelectValue placeholder="Unidad" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  {unitTypes.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.value}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Inventory Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredInventory.map((item) => {
          const status = getStockStatus(item.stockActual, item.stockMinimo);
          const StatusIcon = status.icon;
          
          return (
            <Card key={item.id} className="hover-elevate" data-testid={`card-product-${item.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-lg truncate" data-testid={`text-product-name-${item.id}`}>
                      {item.nombre}
                    </span>
                  </div>
                  <Badge className={status.color} data-testid={`badge-status-${item.id}`}>
                    <StatusIcon className="h-3 w-3 mr-1" />
                    {status.label}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {item.descripcion && (
                  <p className="text-sm text-muted-foreground" data-testid={`text-description-${item.id}`}>
                    {item.descripcion}
                  </p>
                )}

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Stock Actual:</span>
                    <span className={`text-lg font-bold ${
                      item.stockActual <= 0 ? 'text-red-600' :
                      item.stockActual <= item.stockMinimo ? 'text-orange-600' :
                      'text-green-600'
                    }`} data-testid={`text-current-stock-${item.id}`}>
                      {item.stockActual} {item.unidadMedida}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Stock Mínimo:</span>
                    <span className="text-sm font-medium" data-testid={`text-minimum-stock-${item.id}`}>
                      {item.stockMinimo} {item.unidadMedida}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-1">
                  {item.proveedor && (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm" data-testid={`text-supplier-${item.id}`}>
                        {item.proveedor}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm" data-testid={`text-last-order-${item.id}`}>
                      Último pedido: {formatDate(item.ultimoPedido)}
                    </span>
                  </div>
                </div>

                <div className="flex gap-1 mt-3">
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => openStockDialog(item)}
                    className="flex-1"
                    data-testid={`button-update-stock-${item.id}`}
                  >
                    <RefreshCw className="h-3 w-3 mr-1" />
                    Stock
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => openDialog(item)}
                    data-testid={`button-edit-${item.id}`}
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredInventory.length === 0 && (
        <Card className="p-8 text-center">
          <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            No se encontraron productos
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchTerm || filterAlert !== "all" || filterUnit !== "all"
              ? "No hay productos que coincidan con los filtros aplicados."
              : "Aún no hay productos en el inventario."
            }
          </p>
          {(!searchTerm && filterAlert === "all" && filterUnit === "all") && (
            <Button onClick={() => openDialog()} data-testid="button-add-first-product">
              <Plus className="h-4 w-4 mr-2" />
              Agregar Primer Producto
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}