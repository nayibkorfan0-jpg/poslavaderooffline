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
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Plus, 
  Edit, 
  Search,
  Filter,
  User,
  Phone,
  Mail,
  MapPin,
  Hash,
  Car,
  Plane,
  Eye,
  Calendar,
  Trash2,
  PlusCircle
} from "lucide-react";
import { insertCustomerSchema, insertVehicleSchema, type Customer, type Vehicle } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

// Customer form schema with additional validation
const customerFormSchema = insertCustomerSchema.extend({
  docNumero: z.string()
    .min(1, "El número de documento es obligatorio")
    .max(20, "El número de documento no puede exceder 20 caracteres"),
  telefono: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  direccion: z.string().optional(),
  // Tourism fields - conditional validation
  pais: z.string().optional(),
  pasaporte: z.string().optional(),
  fechaIngreso: z.string().optional(),
}).refine((data) => {
  if (data.regimenTurismo) {
    return data.pais && data.pasaporte && data.fechaIngreso;
  }
  return true;
}, {
  message: "Para régimen turismo es obligatorio país, pasaporte y fecha de ingreso",
  path: ["pais"],
});

type CustomerFormData = z.infer<typeof customerFormSchema>;

// Vehicle form schema  
const vehicleFormSchema = insertVehicleSchema.extend({
  placa: z.string()
    .min(1, "La placa es obligatoria")
    .max(20, "La placa no puede exceder 20 caracteres"),
  marca: z.string()
    .min(1, "La marca es obligatoria")
    .max(50, "La marca no puede exceder 50 caracteres"),
  modelo: z.string()
    .min(1, "El modelo es obligatorio")
    .max(50, "El modelo no puede exceder 50 caracteres"),
  color: z.string()
    .min(1, "El color es obligatorio")
    .max(30, "El color no puede exceder 30 caracteres")
});

type VehicleFormData = z.infer<typeof vehicleFormSchema>;

// Document types
const docTypes = [
  { value: "CI", label: "Cédula de Identidad" },
  { value: "RUC", label: "RUC" },
  { value: "Pasaporte", label: "Pasaporte" },
];


export default function ClientesPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [showTourism, setShowTourism] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  
  // Vehicle state
  const [isVehicleDialogOpen, setIsVehicleDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [selectedCustomerForVehicle, setSelectedCustomerForVehicle] = useState<Customer | null>(null);

  // Real data queries
  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ['/api/customers'],
    select: (data) => Array.isArray(data) ? data : []
  });

  const { data: vehicles = [], isLoading: vehiclesLoading } = useQuery<Vehicle[]>({
    queryKey: ['/api/vehicles'],
    select: (data) => Array.isArray(data) ? data : []
  });

  // Ensure data is always arrays
  const customersArr = Array.isArray(customers) ? customers : [];
  const vehiclesArr = Array.isArray(vehicles) ? vehicles : [];
  
  // Filter customers
  const filteredCustomers = customersArr.filter(customer => {
    const searchLower = (searchTerm || "").toLowerCase();
    const matchesSearch = 
      String(customer.nombre || "").toLowerCase().includes(searchLower) ||
      String(customer.docNumero || "").toLowerCase().includes(searchLower) ||
      String(customer.email || "").toLowerCase().includes(searchLower) ||
      String(customer.telefono || "").toLowerCase().includes(searchLower);
    
    const matchesType = filterType === "all" || String(customer.docTipo || "") === filterType;
    const matchesTourism = !showTourism || customer.regimenTurismo;
    
    return matchesSearch && matchesType && matchesTourism;
  });

  // Form setup
  const form = useForm<CustomerFormData>({
    resolver: zodResolver(customerFormSchema),
    defaultValues: {
      nombre: "",
      docTipo: "CI",
      docNumero: "",
      email: "",
      telefono: "",
      direccion: "",
      regimenTurismo: false,
      pais: "",
      pasaporte: "",
      fechaIngreso: "",
    },
  });

  // Watch tourism regime to show/hide fields
  const watchTourism = form.watch("regimenTurismo");

  // Vehicle form setup
  const vehicleForm = useForm<VehicleFormData>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: {
      customerId: "",
      placa: "",
      marca: "",
      modelo: "",
      color: "",
      observaciones: "",
    },
  });

  // Real mutations
  const createMutation = useMutation({
    mutationFn: async (data: CustomerFormData) => {
      console.log("Sending POST request with data:", data);
      const result = await apiRequest('POST', '/api/customers', data);
      console.log("POST response:", result);
      return result;
    },
    onSuccess: (result) => {
      console.log("Customer created successfully:", result);
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Cliente creado",
        description: "El cliente se ha registrado correctamente.",
      });
    },
    onError: (error: Error) => {
      console.error("Error creating customer:", error);
      toast({
        title: "Error",
        description: `No se pudo crear el cliente: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: CustomerFormData }) => {
      return await apiRequest('PUT', `/api/customers/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/customers'] });
      setIsDialogOpen(false);
      setEditingCustomer(null);
      form.reset();
      toast({
        title: "Cliente actualizado",
        description: "Los datos del cliente se han actualizado correctamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudo actualizar el cliente: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Vehicle mutations
  const createVehicleMutation = useMutation({
    mutationFn: async (data: VehicleFormData) => {
      return await apiRequest('POST', '/api/vehicles', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      setIsVehicleDialogOpen(false);
      setSelectedCustomerForVehicle(null);
      vehicleForm.reset();
      toast({
        title: "Vehículo agregado",
        description: "El vehículo se ha registrado correctamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudo agregar el vehículo: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const updateVehicleMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: VehicleFormData }) => {
      return await apiRequest('PUT', `/api/vehicles/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      setIsVehicleDialogOpen(false);
      setEditingVehicle(null);
      vehicleForm.reset();
      toast({
        title: "Vehículo actualizado",
        description: "Los datos del vehículo se han actualizado correctamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudo actualizar el vehículo: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const deleteVehicleMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      return await apiRequest('DELETE', `/api/vehicles/${vehicleId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/vehicles'] });
      toast({
        title: "Vehículo eliminado",
        description: "El vehículo se ha eliminado correctamente.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: `No se pudo eliminar el vehículo: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  // Customer form handlers
  const onSubmit = (data: CustomerFormData) => {
    try {
      console.log("Form data:", data);
      
      // Normalize empty date strings to undefined to prevent render crashes
      const processedData = {
        ...data,
        fechaIngreso: data.fechaIngreso?.trim() || undefined
      };
      
      if (editingCustomer) {
        console.log("Updating customer:", editingCustomer.id);
        updateMutation.mutate({ id: editingCustomer.id, data: processedData });
      } else {
        console.log("Creating new customer");
        createMutation.mutate(processedData);
      }
    } catch (error) {
      console.error("Error in onSubmit:", error);
      toast({
        title: "Error",
        description: "Error inesperado al procesar el formulario",
        variant: "destructive",
      });
    }
  };

  const openDialog = (customer?: Customer) => {
    if (customer) {
      setEditingCustomer(customer);
      form.reset({
        nombre: customer.nombre,
        docTipo: customer.docTipo,
        docNumero: customer.docNumero,
        email: customer.email || "",
        telefono: customer.telefono || "",
        direccion: customer.direccion || "",
        regimenTurismo: customer.regimenTurismo,
        pais: customer.pais || "",
        pasaporte: customer.pasaporte || "",
        fechaIngreso: customer.fechaIngreso || "",
      });
    } else {
      setEditingCustomer(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  // Vehicle form handlers
  const onVehicleSubmit = (data: VehicleFormData) => {
    if (editingVehicle) {
      updateVehicleMutation.mutate({ id: editingVehicle.id, data });
    } else {
      createVehicleMutation.mutate(data);
    }
  };

  const openVehicleDialog = (customer: Customer, vehicle?: Vehicle) => {
    setSelectedCustomerForVehicle(customer);
    if (vehicle) {
      setEditingVehicle(vehicle);
      vehicleForm.reset({
        customerId: vehicle.customerId,
        placa: vehicle.placa,
        marca: vehicle.marca,
        modelo: vehicle.modelo,
        color: vehicle.color,
        observaciones: vehicle.observaciones || "",
      });
    } else {
      setEditingVehicle(null);
      vehicleForm.reset({
        customerId: customer.id,
        placa: "",
        marca: "",
        modelo: "",
        color: "",
        observaciones: "",
      });
    }
    setIsVehicleDialogOpen(true);
  };

  const handleDeleteVehicle = (vehicleId: string) => {
    if (confirm("¿Estás seguro de que deseas eliminar este vehículo?")) {
      deleteVehicleMutation.mutate(vehicleId);
    }
  };

  // Helper function to get vehicles for a customer
  const getCustomerVehicles = (customerId: string) => {
    return vehiclesArr.filter(vehicle => vehicle.customerId === customerId);
  };

  const formatDate = (dateString?: string | null) => {
    if (!dateString || dateString.trim() === '') return "-";
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    return date.toLocaleDateString('es-PY', {
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
          <p className="text-muted-foreground">Cargando clientes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-customers-title">
              Gestión de Clientes
            </h1>
            <p className="text-muted-foreground" data-testid="text-customers-subtitle">
              Administre clientes locales y turistas
            </p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} data-testid="button-add-customer">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Cliente
            </Button>
          </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingCustomer ? "Editar Cliente" : "Nuevo Cliente"}
              </DialogTitle>
              <DialogDescription>
                {editingCustomer ? "Modifique los datos del cliente" : "Registre un nuevo cliente en el sistema"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="nombre"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre Completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan Pérez García" {...field} data-testid="input-customer-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="docTipo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Documento *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-doc-type">
                              <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {docTypes.map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
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
                    name="docNumero"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número *</FormLabel>
                        <FormControl>
                          <Input placeholder="12345678" {...field} data-testid="input-doc-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="telefono"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Teléfono</FormLabel>
                        <FormControl>
                          <Input placeholder="+595 21 123456" {...field} value={field.value || ""} data-testid="input-phone" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="cliente@email.com" {...field} value={field.value || ""} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="direccion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dirección</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Av. España 1234, Asunción" {...field} value={field.value || ""} data-testid="input-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="regimenTurismo"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          data-testid="checkbox-tourism-regime"
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel className="flex items-center gap-2">
                          <Plane className="h-4 w-4" />
                          Régimen Turismo
                        </FormLabel>
                        <FormDescription>
                          Marque si el cliente es extranjero/turista
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />

                {watchTourism && (
                  <div className="space-y-4 p-4 border rounded-md bg-blue-50 dark:bg-blue-950/20">
                    <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      Información de Turismo
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="pais"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>País de Origen *</FormLabel>
                            <FormControl>
                              <Input placeholder="USA, BRA, ARG..." {...field} value={field.value || ""} data-testid="input-country" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="pasaporte"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Pasaporte *</FormLabel>
                            <FormControl>
                              <Input placeholder="US123456789" {...field} value={field.value || ""} data-testid="input-passport" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="fechaIngreso"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fecha de Ingreso *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value || ""} data-testid="input-entry-date" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel-customer"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-customer"
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Guardando...
                      </>
                    ) : (
                      editingCustomer ? "Actualizar" : "Crear Cliente"
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Vehicle Dialog */}
        <Dialog open={isVehicleDialogOpen} onOpenChange={setIsVehicleDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingVehicle ? "Editar Vehículo" : "Nuevo Vehículo"}
              </DialogTitle>
              <DialogDescription>
                {editingVehicle 
                  ? "Modifique los datos del vehículo" 
                  : `Registre un nuevo vehículo para ${selectedCustomerForVehicle?.nombre}`
                }
              </DialogDescription>
            </DialogHeader>
            <Form {...vehicleForm}>
              <form onSubmit={vehicleForm.handleSubmit(onVehicleSubmit)} className="space-y-4">
                <FormField
                  control={vehicleForm.control}
                  name="placa"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Placa / Patente *</FormLabel>
                      <FormControl>
                        <Input placeholder="ABC123" {...field} data-testid="input-vehicle-plate" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={vehicleForm.control}
                    name="marca"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marca *</FormLabel>
                        <FormControl>
                          <Input placeholder="Toyota" {...field} data-testid="input-vehicle-brand" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={vehicleForm.control}
                    name="modelo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modelo *</FormLabel>
                        <FormControl>
                          <Input placeholder="Corolla" {...field} data-testid="input-vehicle-model" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={vehicleForm.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color *</FormLabel>
                      <FormControl>
                        <Input placeholder="Blanco" {...field} data-testid="input-vehicle-color" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={vehicleForm.control}
                  name="observaciones"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Observaciones</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Detalles adicionales del vehículo..." 
                          {...field} 
                          value={field.value || ""} 
                          data-testid="input-vehicle-notes" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end gap-2">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsVehicleDialogOpen(false)}
                    data-testid="button-cancel-vehicle"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createVehicleMutation.isPending || updateVehicleMutation.isPending}
                    data-testid="button-save-vehicle"
                  >
                    {(createVehicleMutation.isPending || updateVehicleMutation.isPending) ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Guardando...
                      </>
                    ) : (
                      editingVehicle ? "Actualizar" : "Agregar Vehículo"
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
                  placeholder="Buscar por nombre, documento, email o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-customers"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40" data-testid="select-filter-doc-type">
                  <SelectValue placeholder="Tipo documento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="CI">Cédula</SelectItem>
                  <SelectItem value="RUC">RUC</SelectItem>
                  <SelectItem value="Pasaporte">Pasaporte</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant={showTourism ? "default" : "outline"}
                onClick={() => setShowTourism(!showTourism)}
                data-testid="button-filter-tourism"
              >
                <Plane className="h-4 w-4 mr-2" />
                Solo Turistas
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredCustomers.map((customer) => {
          const customerVehicles = vehiclesArr.filter(v => v.customerId === customer.id);
          
          return (
            <Card key={customer.id} className="hover-elevate" data-testid={`card-customer-${customer.id}`}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <User className="h-5 w-5 text-primary" />
                    <span className="font-semibold text-lg truncate" data-testid={`text-customer-name-${customer.id}`}>
                      {customer.nombre || "Sin nombre"}
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {customer.regimenTurismo && (
                      <Badge variant="secondary" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                        <Plane className="h-3 w-3 mr-1" />
                        Turista
                      </Badge>
                    )}
                    <Badge variant="outline">
                      {customer.docTipo}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium" data-testid={`text-doc-number-${customer.id}`}>
                      {customer.docNumero || "Sin documento"}
                    </span>
                  </div>
                  {customer.telefono && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm" data-testid={`text-phone-${customer.id}`}>
                        {customer.telefono || "Sin teléfono"}
                      </span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm truncate" data-testid={`text-email-${customer.id}`}>
                        {customer.email || "Sin email"}
                      </span>
                    </div>
                  )}
                  {customer.direccion && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm" data-testid={`text-address-${customer.id}`}>
                        {customer.direccion}
                      </span>
                    </div>
                  )}
                </div>

                {customer.regimenTurismo && (
                  <>
                    <Separator />
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">País:</span>
                        <span className="font-medium">{customer.pais}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pasaporte:</span>
                        <span className="font-medium">{customer.pasaporte}</span>
                      </div>
                      {customer.fechaIngreso && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ingreso:</span>
                          <span className="font-medium">{formatDate(customer.fechaIngreso)}</span>
                        </div>
                      )}
                    </div>
                  </>
                )}

                <Separator />

                {/* Vehicle Management Section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Vehículos ({getCustomerVehicles(customer.id).length})</span>
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openVehicleDialog(customer)}
                        data-testid={`button-add-vehicle-${customer.id}`}
                      >
                        <PlusCircle className="h-3 w-3" />
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => openDialog(customer)}
                        data-testid={`button-edit-${customer.id}`}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {getCustomerVehicles(customer.id).length > 0 ? (
                    <div className="space-y-1">
                      {getCustomerVehicles(customer.id).slice(0, 3).map((vehicle) => (
                        <div key={vehicle.id} className="flex items-center justify-between group hover:bg-muted/50 p-1 rounded">
                          <div className="flex items-center gap-2 text-sm flex-1">
                            <Car className="h-3 w-3 text-muted-foreground" />
                            <span className="truncate" data-testid={`text-vehicle-${vehicle.id}`}>
                              {vehicle.placa} - {vehicle.marca} {vehicle.modelo}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {vehicle.color}
                            </Badge>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="h-6 w-6 p-0"
                              onClick={() => openVehicleDialog(customer, vehicle)}
                              data-testid={`button-edit-vehicle-${vehicle.id}`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost"
                              className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteVehicle(vehicle.id)}
                              data-testid={`button-delete-vehicle-${vehicle.id}`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                      {getCustomerVehicles(customer.id).length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{getCustomerVehicles(customer.id).length - 3} vehículos más
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground flex items-center justify-center p-4 border-2 border-dashed border-muted rounded-lg">
                      <div className="text-center">
                        <Car className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                        <p>Sin vehículos registrados</p>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          onClick={() => openVehicleDialog(customer)}
                          className="mt-2"
                          data-testid={`button-add-first-vehicle-${customer.id}`}
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          Agregar vehículo
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="text-xs text-muted-foreground">
                  Cliente desde {formatDate(typeof customer.createdAt === 'string' ? customer.createdAt : customer.createdAt?.toISOString())}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredCustomers.length === 0 && (
        <Card className="p-8 text-center">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            No se encontraron clientes
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {searchTerm || filterType !== "all" || showTourism
              ? "No hay clientes que coincidan con los filtros aplicados."
              : "Aún no hay clientes registrados en el sistema."
            }
          </p>
          {(!searchTerm && filterType === "all" && !showTourism) && (
            <Button onClick={() => openDialog()} data-testid="button-add-first-customer">
              <Plus className="h-4 w-4 mr-2" />
              Registrar Primer Cliente
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}