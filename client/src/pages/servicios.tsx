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
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { 
  FileText, 
  Plus, 
  Edit, 
  Trash2, 
  Clock, 
  DollarSign, 
  Search,
  Filter,
  Sparkles,
  Car,
  Droplets,
  Wind,
  Package,
  Tag
} from "lucide-react";
import { insertServiceSchema, insertServiceComboSchema, type Service, type ServiceCombo } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Service form schema - transform numbers to strings for price inputs
const serviceFormSchema = insertServiceSchema.extend({
  precio: z.union([z.string(), z.number()]).transform(val => String(val))
});

// Service combo form schema - extends backend schema with frontend-only fields
const comboFormSchema = insertServiceComboSchema.extend({
  serviceIds: z.array(z.string())
    .min(2, "Un combo debe incluir al menos 2 servicios")
});

type ServiceFormData = z.infer<typeof serviceFormSchema>;
type ComboFormData = z.infer<typeof comboFormSchema>;

const categories = [
  { value: "basico", label: "Básico", icon: Droplets, color: "blue" },
  { value: "premium", label: "Premium", icon: Sparkles, color: "purple" },
  { value: "motor", label: "Motor", icon: Car, color: "green" },
  { value: "tapizado", label: "Tapizado", icon: Package, color: "orange" },
  { value: "encerado", label: "Encerado", icon: Droplets, color: "yellow" },
  { value: "ozono", label: "Ozono", icon: Wind, color: "teal" },
];

// Format price for Paraguay (Guaraní)
const formatPrice = (price: number | string) => {
  const numPrice = typeof price === 'string' ? parseInt(price) : price;
  return `Gs. ${numPrice.toLocaleString('es-PY')}`;
};

// Get category details
const getCategoryDetails = (category: string) => {
  return categories.find(c => c.value === category) || categories[0];
};

export default function ServiciosPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [isServiceDialogOpen, setIsServiceDialogOpen] = useState(false);
  const [isComboDialogOpen, setIsComboDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editingCombo, setEditingCombo] = useState<ServiceCombo | null>(null);

  // Fetch services
  const { data: services = [], isLoading: servicesLoading } = useQuery<Service[]>({
    queryKey: ['/api/services'],
    select: (data) => Array.isArray(data) ? data : []
  });

  // Fetch service combos
  const { data: combos = [], isLoading: combosLoading } = useQuery<ServiceCombo[]>({
    queryKey: ['/api/service-combos'],
    select: (data) => Array.isArray(data) ? data : []
  });

  // Ensure data is always arrays
  const servicesArr = Array.isArray(services) ? services : [];
  const combosArr = Array.isArray(combos) ? combos : [];
  
  // Filter services
  const filteredServices = servicesArr.filter(service => {
    const matchesSearch = service.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         service.descripcion?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || service.categoria === filterCategory;
    const matchesActive = showInactive || service.activo;
    return matchesSearch && matchesCategory && matchesActive;
  });

  // Filter combos
  const filteredCombos = combosArr.filter(combo => {
    const matchesSearch = combo.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         combo.descripcion?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActive = showInactive || combo.activo;
    return matchesSearch && matchesActive;
  });

  // Service form
  const serviceForm = useForm<ServiceFormData>({
    resolver: zodResolver(serviceFormSchema),
    defaultValues: {
      nombre: "",
      descripcion: "",
      precio: "0",
      duracionMin: 30,
      categoria: "basico",
      activo: true,
    },
  });

  // Combo form
  const comboForm = useForm<ComboFormData>({
    resolver: zodResolver(comboFormSchema),
    defaultValues: {
      nombre: "",
      descripcion: "",
      precioTotal: "0",
      serviceIds: [],
      activo: true,
    },
  });

  // Service mutations
  const createServiceMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/services', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      setIsServiceDialogOpen(false);
      serviceForm.reset();
      toast({
        title: "Servicio creado",
        description: "El servicio se ha creado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear servicio",
        description: error.message || "No se pudo crear el servicio.",
        variant: "destructive",
      });
    },
  });

  const updateServiceMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest('PUT', `/api/services/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      setIsServiceDialogOpen(false);
      setEditingService(null);
      serviceForm.reset();
      toast({
        title: "Servicio actualizado",
        description: "El servicio se ha actualizado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar servicio",
        description: error.message || "No se pudo actualizar el servicio.",
        variant: "destructive",
      });
    },
  });

  const deleteServiceMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/services/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/services'] });
      toast({
        title: "Servicio desactivado",
        description: "El servicio se ha desactivado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al desactivar servicio",
        description: error.message || "No se pudo desactivar el servicio.",
        variant: "destructive",
      });
    },
  });

  // Combo mutations
  const createComboMutation = useMutation({
    mutationFn: async (data: any) => {
      return apiRequest('POST', '/api/service-combos', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-combos'] });
      setIsComboDialogOpen(false);
      comboForm.reset();
      toast({
        title: "Combo creado",
        description: "El combo se ha creado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al crear combo",
        description: error.message || "No se pudo crear el combo.",
        variant: "destructive",
      });
    },
  });

  const updateComboMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      return apiRequest('PUT', `/api/service-combos/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-combos'] });
      setIsComboDialogOpen(false);
      setEditingCombo(null);
      comboForm.reset();
      toast({
        title: "Combo actualizado",
        description: "El combo se ha actualizado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar combo",
        description: error.message || "No se pudo actualizar el combo.",
        variant: "destructive",
      });
    },
  });

  const deleteComboMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest('DELETE', `/api/service-combos/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/service-combos'] });
      toast({
        title: "Combo desactivado",
        description: "El combo se ha desactivado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al desactivar combo",
        description: error.message || "No se pudo desactivar el combo.",
        variant: "destructive",
      });
    },
  });

  // Handle service form submission
  const onServiceSubmit = (data: ServiceFormData) => {
    if (editingService) {
      updateServiceMutation.mutate({ id: editingService.id, data });
    } else {
      createServiceMutation.mutate(data);
    }
  };

  // Handle combo form submission
  const onComboSubmit = (data: ComboFormData) => {
    if (editingCombo) {
      updateComboMutation.mutate({ id: editingCombo.id, data });
    } else {
      createComboMutation.mutate(data);
    }
  };

  // Open service dialog for editing
  const openServiceDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      serviceForm.reset({
        nombre: service.nombre,
        descripcion: service.descripcion || "",
        precio: service.precio,
        duracionMin: service.duracionMin,
        categoria: service.categoria,
        activo: service.activo,
      });
    } else {
      setEditingService(null);
      serviceForm.reset();
    }
    setIsServiceDialogOpen(true);
  };

  // Open combo dialog for editing
  const openComboDialog = (combo?: ServiceCombo) => {
    if (combo) {
      setEditingCombo(combo);
      comboForm.reset({
        nombre: combo.nombre,
        descripcion: combo.descripcion || "",
        precioTotal: combo.precioTotal,
        serviceIds: [], // TODO: Fetch combo services
        activo: combo.activo,
      });
    } else {
      setEditingCombo(null);
      comboForm.reset();
    }
    setIsComboDialogOpen(true);
  };

  if (servicesLoading || combosLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando servicios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileText className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-services-title">
              Gestión de Servicios
            </h1>
            <p className="text-muted-foreground" data-testid="text-services-subtitle">
              Administre servicios individuales y combos del lavadero
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={isServiceDialogOpen} onOpenChange={setIsServiceDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openServiceDialog()} data-testid="button-add-service">
                <Plus className="h-4 w-4 mr-2" />
                Nuevo Servicio
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingService ? "Editar Servicio" : "Nuevo Servicio"}
                </DialogTitle>
                <DialogDescription>
                  {editingService ? "Modifique los datos del servicio" : "Agregue un nuevo servicio al catálogo"}
                </DialogDescription>
              </DialogHeader>
              <Form {...serviceForm}>
                <form onSubmit={serviceForm.handleSubmit(onServiceSubmit)} className="space-y-4">
                  <FormField
                    control={serviceForm.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Servicio *</FormLabel>
                        <FormControl>
                          <Input placeholder="Lavado completo" {...field} data-testid="input-service-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={serviceForm.control}
                    name="descripcion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Descripción del servicio..." 
                            {...field} 
                            value={field.value || ""}
                            data-testid="input-service-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={serviceForm.control}
                      name="precio"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Precio (PYG) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="50000" 
                              value={field.value}
                              onChange={(e) => field.onChange(e.target.value)}
                              data-testid="input-service-price"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={serviceForm.control}
                      name="duracionMin"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Duración (min) *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number" 
                              placeholder="30" 
                              value={field.value}
                              onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                              data-testid="input-service-duration"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={serviceForm.control}
                    name="categoria"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoría *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-service-category">
                              <SelectValue placeholder="Seleccione una categoría" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.value} value={category.value}>
                                {category.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsServiceDialogOpen(false)}
                      data-testid="button-cancel-service"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createServiceMutation.isPending || updateServiceMutation.isPending}
                      data-testid="button-save-service"
                    >
                      {(createServiceMutation.isPending || updateServiceMutation.isPending) ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                          Guardando...
                        </>
                      ) : (
                        editingService ? "Actualizar" : "Crear Servicio"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>

          <Dialog open={isComboDialogOpen} onOpenChange={setIsComboDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" onClick={() => openComboDialog()} data-testid="button-add-combo">
                <Package className="h-4 w-4 mr-2" />
                Nuevo Combo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>
                  {editingCombo ? "Editar Combo" : "Nuevo Combo"}
                </DialogTitle>
                <DialogDescription>
                  {editingCombo ? "Modifique los datos del combo" : "Cree un combo con múltiples servicios"}
                </DialogDescription>
              </DialogHeader>
              <Form {...comboForm}>
                <form onSubmit={comboForm.handleSubmit(onComboSubmit)} className="space-y-4">
                  <FormField
                    control={comboForm.control}
                    name="nombre"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre del Combo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Lavado Premium Total" {...field} data-testid="input-combo-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={comboForm.control}
                    name="descripcion"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Descripción</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Descripción del combo..." 
                            {...field} 
                            value={field.value || ""}
                            data-testid="input-combo-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={comboForm.control}
                    name="precioTotal"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Precio Total (PYG) *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            placeholder="120000" 
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value)}
                            data-testid="input-combo-price"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={comboForm.control}
                    name="serviceIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Servicios Incluidos *</FormLabel>
                        <FormDescription>
                          Seleccione al menos 2 servicios para el combo
                        </FormDescription>
                        <div className="space-y-2 max-h-40 overflow-y-auto">
                          {services.filter(s => s.activo).map((service) => (
                            <div key={service.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={service.id}
                                checked={field.value.includes(service.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    field.onChange([...field.value, service.id]);
                                  } else {
                                    field.onChange(field.value.filter(id => id !== service.id));
                                  }
                                }}
                                data-testid={`checkbox-service-${service.id}`}
                              />
                              <label htmlFor={service.id} className="text-sm">
                                {service.nombre} - {formatPrice(service.precio)}
                              </label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end gap-2 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => setIsComboDialogOpen(false)}
                      data-testid="button-cancel-combo"
                    >
                      Cancelar
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createComboMutation.isPending || updateComboMutation.isPending}
                      data-testid="button-save-combo"
                    >
                      {(createComboMutation.isPending || updateComboMutation.isPending) ? (
                        <>
                          <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                          Guardando...
                        </>
                      ) : (
                        editingCombo ? "Actualizar" : "Crear Combo"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar servicios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-services"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-40" data-testid="select-filter-category">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las categorías</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category.value} value={category.value}>
                      {category.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-inactive"
                  checked={showInactive}
                  onCheckedChange={(checked) => setShowInactive(checked === true)}
                  data-testid="checkbox-show-inactive"
                />
                <label htmlFor="show-inactive" className="text-sm">
                  Mostrar inactivos
                </label>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Grid */}
      <div className="space-y-6">
        {/* Individual Services */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Tag className="h-5 w-5" />
            Servicios Individuales ({filteredServices.length})
          </h2>
          
          {filteredServices.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No hay servicios</h3>
                <p className="text-muted-foreground">
                  {searchTerm || filterCategory !== "all" ? "No se encontraron servicios con los filtros aplicados." : "Comience agregando su primer servicio."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredServices.map((service) => {
                const categoryDetails = getCategoryDetails(service.categoria);
                const CategoryIcon = categoryDetails.icon;
                
                return (
                  <Card key={service.id} className={`hover-elevate ${!service.activo ? 'opacity-60' : ''}`}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-lg bg-${categoryDetails.color}-100 dark:bg-${categoryDetails.color}-950`}>
                            <CategoryIcon className={`h-4 w-4 text-${categoryDetails.color}-600 dark:text-${categoryDetails.color}-400`} />
                          </div>
                          <div>
                            <CardTitle className="text-base" data-testid={`text-service-name-${service.id}`}>
                              {service.nombre}
                            </CardTitle>
                            <Badge variant="secondary" className="text-xs">
                              {categoryDetails.label}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openServiceDialog(service)}
                            data-testid={`button-edit-service-${service.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteServiceMutation.mutate(service.id)}
                            disabled={deleteServiceMutation.isPending}
                            data-testid={`button-delete-service-${service.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {service.descripcion && (
                        <p className="text-sm text-muted-foreground" data-testid={`text-service-description-${service.id}`}>
                          {service.descripcion}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span data-testid={`text-service-duration-${service.id}`}>
                            {service.duracionMin} min
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-primary" />
                          <span className="font-semibold text-primary" data-testid={`text-service-price-${service.id}`}>
                            {formatPrice(service.precio)}
                          </span>
                        </div>
                      </div>
                      {!service.activo && (
                        <Badge variant="destructive" className="w-full justify-center">
                          Inactivo
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <Separator />

        {/* Service Combos */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Package className="h-5 w-5" />
            Combos y Paquetes ({filteredCombos.length})
          </h2>
          
          {filteredCombos.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No hay combos</h3>
                <p className="text-muted-foreground">
                  {searchTerm ? "No se encontraron combos con los filtros aplicados." : "Comience creando su primer combo de servicios."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredCombos.map((combo) => (
                <Card key={combo.id} className={`hover-elevate ${!combo.activo ? 'opacity-60' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-950">
                          <Package className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                          <CardTitle className="text-base" data-testid={`text-combo-name-${combo.id}`}>
                            {combo.nombre}
                          </CardTitle>
                          <Badge variant="secondary" className="text-xs bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                            Combo
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => openComboDialog(combo)}
                          data-testid={`button-edit-combo-${combo.id}`}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteComboMutation.mutate(combo.id)}
                          disabled={deleteComboMutation.isPending}
                          data-testid={`button-delete-combo-${combo.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {combo.descripcion && (
                      <p className="text-sm text-muted-foreground" data-testid={`text-combo-description-${combo.id}`}>
                        {combo.descripcion}
                      </p>
                    )}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-primary" data-testid={`text-combo-price-${combo.id}`}>
                          {formatPrice(combo.precioTotal)}
                        </span>
                      </div>
                    </div>
                    {!combo.activo && (
                      <Badge variant="destructive" className="w-full justify-center">
                        Inactivo
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}