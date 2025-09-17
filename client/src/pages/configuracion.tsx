import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Building2, Upload, AlertTriangle, CheckCircle, Calendar, MapPin, Phone, Mail, Hash, FileText, Coins, Network, Shield, Lock, Key, Server, TestTube, UserCheck, Trash2 } from "lucide-react";
import { insertCompanyConfigSchema, type CompanyConfig, insertDnitConfigSchema, type DnitConfig, changePasswordSchema } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ImageUpload } from "@/components/ImageUpload";
import { validateRUC } from "@/lib/utils";

// Extend the schema with additional frontend validations
const configFormSchema = insertCompanyConfigSchema.extend({
  ruc: z.string()
    .min(1, "El RUC es obligatorio")
    .max(50, "El RUC no puede exceder 50 caracteres"),
  timbradoDesde: z.string()
    .min(1, "La fecha de inicio del timbrado es obligatoria"),
  timbradoHasta: z.string()
    .min(1, "La fecha de vencimiento del timbrado es obligatoria"),
  establecimiento: z.string()
    .length(3, "El establecimiento debe tener exactamente 3 dígitos")
    .regex(/^\d{3}$/, "El establecimiento debe ser numérico"),
  puntoExpedicion: z.string()
    .length(3, "El punto de expedición debe tener exactamente 3 dígitos")
    .regex(/^\d{3}$/, "El punto de expedición debe ser numérico"),
}).refine((data) => {
  const startDate = new Date(data.timbradoDesde);
  const endDate = new Date(data.timbradoHasta);
  return endDate > startDate;
}, {
  message: "La fecha de vencimiento debe ser posterior a la fecha de inicio",
  path: ["timbradoHasta"],
});

type ConfigFormData = z.infer<typeof configFormSchema>;

// DNIT form schema with frontend validations
const dnitFormSchema = insertDnitConfigSchema.extend({
  endpointUrl: z.string().url("Debe ser una URL válida").min(1, "La URL del endpoint es requerida"),
  authToken: z.string().min(1, "El token de autenticación es requerido"),
  certificateData: z.string().optional(),
  certificatePassword: z.string().optional(),
  operationMode: z.enum(["testing", "production"]).default("testing"),
  isActive: z.boolean().default(false),
});

type DnitFormData = z.infer<typeof dnitFormSchema>;

// Password change form schema with frontend validations
const passwordFormSchema = changePasswordSchema.extend({
  confirmPassword: z.string().min(1, "Confirme la nueva contraseña"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

type PasswordFormData = z.infer<typeof passwordFormSchema>;

// Extended DnitConfig type for API responses that don't expose sensitive data
interface SafeDnitConfig extends Omit<DnitConfig, 'authToken' | 'certificatePassword'> {
  hasAuthToken: boolean;
  hasCertificatePassword: boolean;
}

export default function ConfiguracionPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [timbradoStatus, setTimbradoStatus] = useState<'valid' | 'warning' | 'expired'>('valid');
  const [daysLeft, setDaysLeft] = useState<number>(0);
  const [connectionTestLoading, setConnectionTestLoading] = useState(false);

  // Fetch current configuration
  const { data: config, isLoading } = useQuery<CompanyConfig | null>({
    queryKey: ['/api/company-config'],
  });

  // Fetch DNIT configuration
  const { data: dnitConfig, isLoading: dnitLoading } = useQuery<SafeDnitConfig | null>({
    queryKey: ['/api/dnit-config'],
  });

  // Fetch current user for password change
  const { data: currentUser } = useQuery<{user: any}>({
    queryKey: ['/api/auth/me'],
  });

  const form = useForm<ConfigFormData>({
    resolver: zodResolver(configFormSchema),
    defaultValues: {
      ruc: "",
      razonSocial: "",
      nombreFantasia: "",
      timbradoNumero: "",
      timbradoDesde: "",
      timbradoHasta: "",
      establecimiento: "001",
      puntoExpedicion: "001",
      direccion: "",
      ciudad: "Asunción",
      telefono: "",
      email: "",
      logoPath: "",
      moneda: "PYG",
    },
  });

  // DNIT form setup
  const dnitForm = useForm<DnitFormData>({
    resolver: zodResolver(dnitFormSchema),
    defaultValues: {
      endpointUrl: "",
      authToken: "",
      certificateData: "",
      certificatePassword: "",
      operationMode: "testing",
      isActive: false,
    },
  });

  // Password change form setup
  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Update form when data is loaded
  useEffect(() => {
    if (config) {
      form.reset({
        ruc: config.ruc,
        razonSocial: config.razonSocial,
        nombreFantasia: config.nombreFantasia || "",
        timbradoNumero: config.timbradoNumero,
        timbradoDesde: config.timbradoDesde,
        timbradoHasta: config.timbradoHasta,
        establecimiento: config.establecimiento,
        puntoExpedicion: config.puntoExpedicion,
        direccion: config.direccion,
        ciudad: config.ciudad,
        telefono: config.telefono || "",
        email: config.email || "",
        logoPath: config.logoPath || "",
        moneda: config.moneda,
      });
    }
  }, [config, form]);

  // Update DNIT form when data is loaded
  useEffect(() => {
    if (dnitConfig) {
      dnitForm.reset({
        endpointUrl: dnitConfig.endpointUrl,
        authToken: dnitConfig.hasAuthToken ? "••••••••" : "", // Show placeholder for existing token
        certificateData: dnitConfig.certificateData || "",
        certificatePassword: dnitConfig.hasCertificatePassword ? "••••••••" : "", // Show placeholder for existing password
        operationMode: dnitConfig.operationMode,
        isActive: dnitConfig.isActive,
      });
    }
  }, [dnitConfig, dnitForm]);

  // Watch timbrado dates for status calculation
  const timbradoHasta = form.watch("timbradoHasta");
  
  useEffect(() => {
    if (timbradoHasta) {
      const endDate = new Date(timbradoHasta);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const diffTime = endDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      setDaysLeft(diffDays);
      
      if (diffDays < 0) {
        setTimbradoStatus('expired');
      } else if (diffDays <= 30) {
        setTimbradoStatus('warning');
      } else {
        setTimbradoStatus('valid');
      }
    }
  }, [timbradoHasta]);

  // Mutation for saving configuration
  const saveMutation = useMutation({
    mutationFn: async (data: ConfigFormData) => {
      return apiRequest('PUT', '/api/company-config', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/company-config'] });
      toast({
        title: "Configuración guardada",
        description: "La configuración de la empresa se ha guardado correctamente.",
      });
    },
    onError: (error: any) => {
      console.error('Error saving config:', error);
      toast({
        title: "Error al guardar",
        description: error.message || "No se pudo guardar la configuración.",
        variant: "destructive",
      });
    },
  });

  // Mutation for saving DNIT configuration
  const saveDnitMutation = useMutation({
    mutationFn: async (data: DnitFormData) => {
      // Only send non-placeholder values
      const payload: Partial<DnitFormData> = { ...data };
      if (payload.authToken === "••••••••") {
        payload.authToken = undefined; // Don't update if placeholder
      }
      if (payload.certificatePassword === "••••••••") {
        payload.certificatePassword = undefined; // Don't update if placeholder
      }
      return apiRequest('PUT', '/api/dnit-config', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/dnit-config'] });
      toast({
        title: "Configuración DNIT guardada",
        description: "La configuración de integración DNIT se ha guardado correctamente.",
      });
    },
    onError: (error: any) => {
      console.error('Error saving DNIT config:', error);
      toast({
        title: "Error al guardar configuración DNIT",
        description: error.message || "No se pudo guardar la configuración DNIT.",
        variant: "destructive",
      });
    },
  });

  // Mutation for changing password
  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      if (!currentUser?.user?.id) {
        throw new Error("Usuario no identificado");
      }
      
      const { confirmPassword, ...passwordData } = data;
      return apiRequest('POST', `/api/users/${currentUser.user.id}/change-password`, passwordData);
    },
    onSuccess: () => {
      passwordForm.reset();
      toast({
        title: "Contraseña actualizada",
        description: "Su contraseña se ha cambiado correctamente.",
      });
    },
    onError: (error: any) => {
      console.error('Error changing password:', error);
      toast({
        title: "Error al cambiar contraseña",
        description: error.message || "No se pudo cambiar la contraseña.",
        variant: "destructive",
      });
    },
  });

  // Mutation for testing DNIT connection
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/dnit-config/test-connection', {});
      return response;
    },
    onSuccess: (result: { success: boolean; error?: string }) => {
      queryClient.invalidateQueries({ queryKey: ['/api/dnit-config'] });
      if (result.success) {
        toast({
          title: "Conexión exitosa",
          description: "La conexión con DNIT se estableció correctamente.",
        });
      } else {
        toast({
          title: "Error de conexión",
          description: result.error || "No se pudo conectar con DNIT.",
          variant: "destructive",
        });
      }
    },
    onError: (error: any) => {
      console.error('Error testing DNIT connection:', error);
      toast({
        title: "Error al probar conexión",
        description: error.message || "Error interno al probar la conexión DNIT.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ConfigFormData) => {
    saveMutation.mutate(data);
  };

  // DNIT submit functions
  const onDnitSubmit = (data: DnitFormData) => {
    saveDnitMutation.mutate(data);
  };

  // Password change submit function  
  const onPasswordSubmit = (data: PasswordFormData) => {
    changePasswordMutation.mutate(data);
  };

  const handleTestConnection = async () => {
    if (!dnitConfig) {
      toast({
        title: "Configuración requerida",
        description: "Debe guardar la configuración DNIT antes de probar la conexión.",
        variant: "destructive",
      });
      return;
    }
    
    setConnectionTestLoading(true);
    try {
      await testConnectionMutation.mutateAsync();
    } finally {
      setConnectionTestLoading(false);
    }
  };

  const getTimbradoStatusBadge = () => {
    switch (timbradoStatus) {
      case 'expired':
        return (
          <Badge variant="destructive" className="ml-2">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Vencido hace {Math.abs(daysLeft)} días
          </Badge>
        );
      case 'warning':
        return (
          <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
            <Calendar className="w-3 h-3 mr-1" />
            Vence en {daysLeft} días
          </Badge>
        );
      case 'valid':
        return (
          <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="w-3 h-3 mr-1" />
            Válido por {daysLeft} días
          </Badge>
        );
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando configuración...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Building2 className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold text-foreground" data-testid="text-config-title">
            Configuración de Empresa
          </h1>
          <p className="text-muted-foreground" data-testid="text-config-subtitle">
            Configure los datos fiscales y empresariales para Paraguay
          </p>
        </div>
      </div>

      {/* Timbrado Status Alert */}
      {timbradoHasta && timbradoStatus !== 'valid' && (
        <Alert className={`border-l-4 ${
          timbradoStatus === 'expired' 
            ? 'border-l-red-500 bg-red-50 dark:bg-red-950/20' 
            : 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20'
        }`}>
          <AlertTriangle className={`h-4 w-4 ${
            timbradoStatus === 'expired' ? 'text-red-600' : 'text-orange-600'
          }`} />
          <AlertDescription className={timbradoStatus === 'expired' ? 'text-red-800 dark:text-red-200' : 'text-orange-800 dark:text-orange-200'}>
            {timbradoStatus === 'expired' 
              ? `⚠️ Timbrado vencido hace ${Math.abs(daysLeft)} días. No se pueden emitir facturas.`
              : `⚠️ Timbrado vence en ${daysLeft} días. Se recomienda renovar pronto.`
            }
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Información de la Empresa
              </CardTitle>
              <CardDescription>
                Datos básicos de identificación empresarial
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="ruc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Hash className="h-4 w-4" />
                        RUC *
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="80000000-0" 
                          {...field} 
                          data-testid="input-ruc"
                        />
                      </FormControl>
                      <FormDescription>
                        Formato paraguayo: 8 dígitos + guión + dígito verificador
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="moneda"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Coins className="h-4 w-4" />
                        Moneda
                      </FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-moneda">
                            <SelectValue placeholder="Seleccione la moneda" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="PYG">PYG - Guaraní Paraguayo</SelectItem>
                          <SelectItem value="USD">USD - Dólar Americano</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="razonSocial"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Razón Social *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Nombre oficial de la empresa" 
                        {...field} 
                        data-testid="input-razon-social"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="nombreFantasia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nombre de Fantasía</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Nombre comercial (opcional)" 
                        {...field} 
                        value={field.value || ""}
                        data-testid="input-nombre-fantasia"
                      />
                    </FormControl>
                    <FormDescription>
                      Nombre comercial bajo el cual opera la empresa
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Timbrado Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Información de Timbrado
                {timbradoHasta && getTimbradoStatusBadge()}
              </CardTitle>
              <CardDescription>
                Datos del timbrado fiscal para facturación
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="timbradoNumero"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Número de Timbrado *</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="12345678" 
                        {...field} 
                        data-testid="input-timbrado-numero"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="timbradoDesde"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Inicio *</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          data-testid="input-timbrado-desde"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="timbradoHasta"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Vencimiento *</FormLabel>
                      <FormControl>
                        <Input 
                          type="date" 
                          {...field} 
                          data-testid="input-timbrado-hasta"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="establecimiento"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>Establecimiento *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="001" 
                          maxLength={3}
                          {...field} 
                          data-testid="input-establecimiento"
                          className="max-w-28 font-mono tabular-nums"
                        />
                      </FormControl>
                      <FormDescription>
                        Código de 3 dígitos (ej: 001)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="puntoExpedicion"
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormLabel>Punto de Expedición *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="001" 
                          maxLength={3}
                          {...field} 
                          data-testid="input-punto-expedicion"
                          className="max-w-28 font-mono tabular-nums"
                        />
                      </FormControl>
                      <FormDescription>
                        Código de 3 dígitos (ej: 001)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Información de Contacto
              </CardTitle>
              <CardDescription>
                Datos de ubicación y contacto
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="direccion"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dirección *</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Dirección completa de la empresa" 
                        {...field} 
                        data-testid="input-direccion"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="ciudad"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ciudad *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Asunción" 
                          {...field} 
                          data-testid="input-ciudad"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="telefono"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        Teléfono
                      </FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="+595 21 123456" 
                          {...field} 
                          value={field.value || ""}
                          data-testid="input-telefono"
                        />
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
                      <FormLabel className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </FormLabel>
                      <FormControl>
                        <Input 
                          type="email" 
                          placeholder="empresa@email.com" 
                          {...field} 
                          value={field.value || ""}
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>

          {/* Logo Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Logo de la Empresa
              </CardTitle>
              <CardDescription>
                Subir logo para facturas y reportes (opcional)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="logoPath"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <ImageUpload
                        value={field.value || ""}
                        onChange={field.onChange}
                        placeholder="Seleccionar logo de la empresa"
                        data-testid="upload-logo"
                      />
                    </FormControl>
                    <FormDescription>
                      Formatos soportados: JPG, PNG. Tamaño máximo: 5MB.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Submit Button */}
          <div className="flex justify-end">
            <Button 
              type="submit" 
              disabled={saveMutation.isPending}
              data-testid="button-save-config"
            >
              {saveMutation.isPending ? (
                <>
                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                  Guardando...
                </>
              ) : (
                "Guardar Configuración"
              )}
            </Button>
          </div>
        </form>
      </Form>

      {/* DNIT Configuration Section */}
      <div className="mt-8">
        <Separator className="mb-6" />
        
        {/* DNIT Header */}
        <div className="flex items-center gap-3 mb-6">
          <Network className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-semibold text-foreground" data-testid="text-dnit-title">
              Integración DNIT
            </h2>
            <p className="text-muted-foreground" data-testid="text-dnit-subtitle">
              Configure la integración con el sistema fiscal paraguayo para envío automático de facturas
            </p>
          </div>
        </div>

        {/* DNIT Status Alert */}
        {dnitConfig && (
          <Alert className={`mb-6 border-l-4 ${
            dnitConfig.isActive && dnitConfig.lastConnectionStatus === 'success'
              ? 'border-l-green-500 bg-green-50 dark:bg-green-950/20'
              : dnitConfig.lastConnectionStatus === 'failed'
              ? 'border-l-red-500 bg-red-50 dark:bg-red-950/20'
              : 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20'
          }`}>
            <Shield className={`h-4 w-4 ${
              dnitConfig.isActive && dnitConfig.lastConnectionStatus === 'success'
                ? 'text-green-600'
                : dnitConfig.lastConnectionStatus === 'failed'
                ? 'text-red-600'
                : 'text-orange-600'
            }`} />
            <AlertDescription className={
              dnitConfig.isActive && dnitConfig.lastConnectionStatus === 'success'
                ? 'text-green-800 dark:text-green-200'
                : dnitConfig.lastConnectionStatus === 'failed'
                ? 'text-red-800 dark:text-red-200'
                : 'text-orange-800 dark:text-orange-200'
            }>
              {dnitConfig.isActive && dnitConfig.lastConnectionStatus === 'success'
                ? '✅ Integración DNIT activa y funcionando correctamente'
                : dnitConfig.lastConnectionStatus === 'failed'
                ? `❌ Error en la integración DNIT: ${dnitConfig.lastConnectionError || 'Error desconocido'}`
                : !dnitConfig.isActive
                ? '⏸️ Integración DNIT configurada pero inactiva'
                : '⚠️ Integración DNIT configurada pero no probada'
              }
            </AlertDescription>
          </Alert>
        )}

        <Form {...dnitForm}>
          <form onSubmit={dnitForm.handleSubmit(onDnitSubmit)} className="space-y-6">
            {/* Connection Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="h-5 w-5" />
                  Configuración de Conexión
                </CardTitle>
                <CardDescription>
                  Configure los datos de conexión al sistema DNIT
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={dnitForm.control}
                  name="endpointUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL del Endpoint DNIT *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://api.dnit.gov.py/facturacion/v1" 
                          {...field} 
                          data-testid="input-dnit-endpoint"
                        />
                      </FormControl>
                      <FormDescription>
                        URL base del servicio web DNIT para envío de facturas electrónicas
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={dnitForm.control}
                  name="authToken"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Token de Autenticación *</FormLabel>
                      <FormControl>
                        <Input 
                          type="password"
                          placeholder="Token de acceso DNIT" 
                          {...field} 
                          data-testid="input-dnit-token"
                        />
                      </FormControl>
                      <FormDescription>
                        Token de autenticación proporcionado por DNIT para acceder a los servicios
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={dnitForm.control}
                    name="operationMode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modo de Operación *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-operation-mode">
                              <SelectValue placeholder="Seleccionar modo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="testing">Testing (Pruebas)</SelectItem>
                            <SelectItem value="production">Producción</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Modo testing para pruebas, producción para facturas reales
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={dnitForm.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                        <div className="space-y-0.5">
                          <FormLabel className="text-base">
                            Integración Activa
                          </FormLabel>
                          <FormDescription>
                            Habilitar envío automático de facturas a DNIT
                          </FormDescription>
                        </div>
                        <FormControl>
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border border-input bg-background"
                            checked={field.value}
                            onChange={field.onChange}
                            data-testid="checkbox-dnit-active"
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Certificate Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5" />
                  Certificado Digital
                </CardTitle>
                <CardDescription>
                  Configure el certificado digital para firma de documentos (requerido para producción)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={dnitForm.control}
                  name="certificateData"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Certificado Digital (.p12)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Contenido del certificado digital en formato Base64 o cargue archivo .p12"
                          rows={4}
                          {...field} 
                          data-testid="textarea-certificate"
                        />
                      </FormControl>
                      <FormDescription>
                        Certificado digital .p12 convertido a Base64 para firma de facturas electrónicas
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={dnitForm.control}
                  name="certificatePassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña del Certificado</FormLabel>
                      <FormControl>
                        <Input 
                          type="password"
                          placeholder="Contraseña del certificado digital" 
                          {...field} 
                          data-testid="input-certificate-password"
                        />
                      </FormControl>
                      <FormDescription>
                        Contraseña para desencriptar el certificado digital
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-between">
              <Button 
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={connectionTestLoading || testConnectionMutation.isPending || !dnitConfig}
                data-testid="button-test-connection"
                className="flex items-center gap-2"
              >
                {connectionTestLoading || testConnectionMutation.isPending ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full"></div>
                    Probando conexión...
                  </>
                ) : (
                  <>
                    <TestTube className="h-4 w-4" />
                    Probar Conexión
                  </>
                )}
              </Button>

              <Button 
                type="submit" 
                disabled={saveDnitMutation.isPending}
                data-testid="button-save-dnit-config"
              >
                {saveDnitMutation.isPending ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                    Guardando...
                  </>
                ) : (
                  "Guardar Configuración DNIT"
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>

      {/* Security Configuration Section */}
      <div className="mt-8">
        <Separator className="mb-6" />
        
        {/* Security Header */}
        <div className="flex items-center gap-3 mb-6">
          <UserCheck className="h-8 w-8 text-primary" />
          <div>
            <h2 className="text-2xl font-semibold text-foreground" data-testid="text-security-title">
              Configuración de Seguridad
            </h2>
            <p className="text-muted-foreground" data-testid="text-security-subtitle">
              Cambie su contraseña de acceso al sistema
            </p>
          </div>
        </div>

        {/* Current User Info */}
        {currentUser?.user && (
          <Alert className="mb-6 border-l-4 border-l-blue-500 bg-blue-50 dark:bg-blue-950/20">
            <UserCheck className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800 dark:text-blue-200">
              <strong>Usuario actual:</strong> {currentUser.user.username} 
              {currentUser.user.fullName && ` (${currentUser.user.fullName})`}
              <br />
              <strong>Rol:</strong> {currentUser.user.role}
              {currentUser.user.email && <><br /><strong>Email:</strong> {currentUser.user.email}</>}
            </AlertDescription>
          </Alert>
        )}

        <Form {...passwordForm}>
          <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Lock className="h-5 w-5" />
                  Cambiar Contraseña
                </CardTitle>
                <CardDescription>
                  Actualice su contraseña de acceso al sistema. La nueva contraseña debe tener al menos 6 caracteres.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contraseña Actual *</FormLabel>
                      <FormControl>
                        <Input 
                          type="password"
                          placeholder="Ingrese su contraseña actual" 
                          {...field} 
                          data-testid="input-current-password"
                        />
                      </FormControl>
                      <FormDescription>
                        Para verificar su identidad, ingrese su contraseña actual
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nueva Contraseña *</FormLabel>
                      <FormControl>
                        <Input 
                          type="password"
                          placeholder="Ingrese su nueva contraseña (mín. 6 caracteres)" 
                          {...field} 
                          data-testid="input-new-password"
                        />
                      </FormControl>
                      <FormDescription>
                        Use una contraseña segura con al menos 6 caracteres
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirmar Nueva Contraseña *</FormLabel>
                      <FormControl>
                        <Input 
                          type="password"
                          placeholder="Confirme su nueva contraseña" 
                          {...field} 
                          data-testid="input-confirm-password"
                        />
                      </FormControl>
                      <FormDescription>
                        Repita la nueva contraseña para confirmar
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Password Change Button */}
            <div className="flex justify-end">
              <Button 
                type="submit" 
                disabled={changePasswordMutation.isPending || !currentUser?.user?.id}
                data-testid="button-change-password"
                className="flex items-center gap-2"
              >
                {changePasswordMutation.isPending ? (
                  <>
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    Cambiando contraseña...
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4" />
                    Cambiar Contraseña
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>

        {/* System Reset Section - DANGEROUS */}
        <div className="mt-8">
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Zona Peligrosa - Resetear Sistema
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                <AlertTriangle className="h-4 w-4 inline mr-1 text-destructive" />
                <strong>¡CUIDADO!</strong> Esta acción eliminará TODOS los datos del sistema de forma permanente.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-destructive/50">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p><strong>Se eliminarán PERMANENTEMENTE:</strong></p>
                    <ul className="list-disc pl-6 space-y-1 text-sm">
                      <li>Todas las ventas e facturas</li>
                      <li>Todas las órdenes de servicio</li>
                      <li>Todos los clientes y vehículos</li>
                      <li>Todo el inventario y productos</li>
                      <li>Todos los servicios y combos</li>
                    </ul>
                    <p className="text-sm text-muted-foreground mt-3">
                      <strong>Se conservarán:</strong> Configuración de empresa, usuario administrador, configuración DNIT
                    </p>
                  </div>
                </AlertDescription>
              </Alert>

              <ResetSystemButton />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Separate component for reset system functionality
function ResetSystemButton() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const resetSystemMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/admin/reset-system", {});
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Sistema reseteado exitosamente",
        description: "Todos los datos han sido eliminados. El sistema está como nuevo.",
      });
      
      // Clear React Query cache and force page reload
      queryClient.clear();
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
    onError: (error: any) => {
      toast({
        title: "Error al resetear sistema",
        description: error.message || "No se pudo resetear el sistema",
        variant: "destructive",
      });
    },
  });

  const handleResetSystem = () => {
    resetSystemMutation.mutate();
    setIsConfirmOpen(false);
  };

  return (
    <>
      <div className="flex justify-center">
        <Button 
          variant="destructive"
          onClick={() => setIsConfirmOpen(true)}
          disabled={resetSystemMutation.isPending}
          data-testid="button-open-reset-confirm"
          className="flex items-center gap-2"
        >
          <Trash2 className="h-4 w-4" />
          Resetear Sistema Completo
        </Button>
      </div>

      {/* Confirmation Dialog */}
      {isConfirmOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="max-w-md w-full mx-4 border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <AlertTriangle className="h-5 w-5" />
                ¿Confirmar Reseteo del Sistema?
              </CardTitle>
              <CardDescription>
                Esta acción NO se puede deshacer. ¿Está completamente seguro?
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Se eliminarán <strong>TODOS</strong> los datos de ventas, clientes, inventario y servicios.
                </AlertDescription>
              </Alert>
              
              <div className="flex gap-3 justify-end">
                <Button 
                  variant="outline"
                  onClick={() => setIsConfirmOpen(false)}
                  disabled={resetSystemMutation.isPending}
                  data-testid="button-cancel-reset"
                >
                  Cancelar
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleResetSystem}
                  disabled={resetSystemMutation.isPending}
                  data-testid="button-confirm-reset"
                  className="flex items-center gap-2"
                >
                  {resetSystemMutation.isPending ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Reseteando...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      SÍ, Resetear Todo
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}