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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { 
  Users, 
  Plus, 
  Edit, 
  Search,
  Filter,
  User as UserIcon,
  Mail,
  Hash,
  Calendar,
  Crown,
  Shield,
  Eye,
  MoreHorizontal,
  AlertTriangle,
  CheckCircle,
  Clock,
  UserX
} from "lucide-react";
import { insertUserSchema, type PublicUser } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatDate, formatDateTimeRobust } from "@/lib/utils";

// Base user form schema aligned with backend insertUserSchema
const baseUserFormSchema = insertUserSchema.extend({
  username: z.string()
    .min(3, "El usuario debe tener al menos 3 caracteres")
    .max(50, "El usuario no puede exceder 50 caracteres")
    .regex(/^[a-zA-Z0-9_]+$/, "Solo se permiten letras, números y guión bajo"),
  password: z.string()
    .min(8, "La contraseña debe tener al menos 8 caracteres")
    .regex(/[A-Z]/, "Debe contener al menos una mayúscula")
    .regex(/[a-z]/, "Debe contener al menos una minúscula")
    .regex(/[0-9]/, "Debe contener al menos un número"),
  confirmPassword: z.string().min(1, "Confirme la contraseña"),
  fullName: z.string().min(1, "El nombre completo es requerido").optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  expirationDate: z.string().optional(),
});

// Create schema for new users (with password confirmation)
const userFormSchema = baseUserFormSchema.refine((data) => data.password === data.confirmPassword, {
  message: "Las contraseñas no coinciden",
  path: ["confirmPassword"],
});

// Update schema for editing (no password fields)
const userUpdateSchema = baseUserFormSchema.omit({ password: true, confirmPassword: true });

type UserFormData = z.infer<typeof userFormSchema>;

// Role options
const roleOptions = [
  { value: "admin", label: "Administrador", description: "Acceso completo al sistema" },
  { value: "user", label: "Usuario", description: "Acceso a funciones básicas" },
  { value: "readonly", label: "Solo Lectura", description: "Solo puede ver información" },
];

// Subscription type options
const subscriptionOptions = [
  { value: "free", label: "Gratis", description: "50 facturas/mes" },
  { value: "basic", label: "Básico", description: "200 facturas/mes" },
  { value: "premium", label: "Premium", description: "1000 facturas/mes" },
  { value: "enterprise", label: "Empresarial", description: "Ilimitado" },
];


export default function UsuariosPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<PublicUser | null>(null);

  // Real API query for users
  const { data: users = [], isLoading, error } = useQuery<PublicUser[]>({
    queryKey: ['/api/users'],
    select: (data) => Array.isArray(data) ? data : []
  });

  // Ensure users is always an array
  const usersArr = Array.isArray(users) ? users : [];
  
  // Filter users
  const filteredUsers = usersArr.filter(user => {
    const matchesSearch = 
      user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.fullName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === "all" || user.role === filterRole;
    
    let matchesStatus = true;
    if (filterStatus === "active") {
      matchesStatus = user.isActive && !user.isBlocked;
    } else if (filterStatus === "inactive") {
      matchesStatus = !user.isActive;
    } else if (filterStatus === "blocked") {
      matchesStatus = user.isBlocked;
    } else if (filterStatus === "expired") {
      matchesStatus = user.expirationDate ? new Date(user.expirationDate) < new Date() : false;
    }
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Form setup
  const form = useForm<UserFormData>({
    resolver: zodResolver(editingUser ? userUpdateSchema : userFormSchema),
    defaultValues: {
      username: "",
      password: "",
      confirmPassword: "",
      fullName: "",
      email: "",
      role: "user" as const,
      subscriptionType: "free" as const,
      monthlyInvoiceLimit: 50,
      expirationDate: "",
      isActive: true,
      isBlocked: false,
    },
  });

  // Watch subscription type to update invoice limit
  const watchSubscriptionType = form.watch("subscriptionType");

  // Update invoice limit based on subscription type
  const updateInvoiceLimit = (subscriptionType: string) => {
    const limits = {
      free: 50,
      basic: 200,
      premium: 1000,
      enterprise: 10000,
    };
    form.setValue("monthlyInvoiceLimit", limits[subscriptionType as keyof typeof limits] || 50);
  };

  // Real create mutation
  const createMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const { confirmPassword, expirationDate, ...userData } = data;
      
      // Prepare payload matching backend insertUserSchema
      const payload = {
        ...userData,
        email: userData.email || null,
        fullName: userData.fullName || null,
        expirationDate: expirationDate && !isNaN(Date.parse(expirationDate)) ? new Date(expirationDate).toISOString() : null,
      };
      
      const response = await apiRequest('POST', '/api/users', payload);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDialogOpen(false);
      form.reset();
      toast({
        title: "Usuario creado",
        description: "El usuario se ha registrado correctamente.",
      });
    },
    onError: (error: any) => {
      let errorMessage = "No se pudo crear el usuario.";
      
      if (error.message?.includes("Admin access required") || error.message?.includes("403")) {
        errorMessage = "Requiere permisos de administrador para crear usuarios.";
      } else if (error.message?.includes("Authentication required") || error.message?.includes("401")) {
        errorMessage = "Debe iniciar sesión para realizar esta acción.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error al crear usuario",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserFormData> }) => {
      const { expirationDate, ...userData } = data;
      
      // Prepare payload for backend updateUserSchema
      const payload = {
        ...userData,
        email: userData.email || null,
        fullName: userData.fullName || null,
        expirationDate: expirationDate && !isNaN(Date.parse(expirationDate)) ? new Date(expirationDate).toISOString() : null,
      };
      
      const response = await apiRequest('PUT', `/api/users/${id}`, payload);
      return response;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsDialogOpen(false);
      setEditingUser(null);
      form.reset();
      toast({
        title: "Usuario actualizado",
        description: "Los datos del usuario se han actualizado correctamente.",
      });
    },
    onError: (error: any) => {
      let errorMessage = "No se pudo actualizar el usuario.";
      
      if (error.message?.includes("Admin access required") || error.message?.includes("403")) {
        errorMessage = "Requiere permisos de administrador para modificar usuarios.";
      } else if (error.message?.includes("Authentication required") || error.message?.includes("401")) {
        errorMessage = "Debe iniciar sesión para realizar esta acción.";
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast({
        title: "Error al actualizar usuario",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const response = await apiRequest('PUT', `/api/users/${id}`, { isActive });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: "Estado actualizado",
        description: "El estado del usuario se ha actualizado correctamente.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al actualizar estado",
        description: error.message || "No se pudo actualizar el estado del usuario.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: UserFormData) => {
    if (editingUser) {
      // For updates, use the update schema (no password fields)
      const { confirmPassword, password, ...updateData } = data;
      updateMutation.mutate({ id: editingUser.id, data: updateData });
    } else {
      // For creation, include all fields
      createMutation.mutate(data);
    }
  };

  const openDialog = (user?: PublicUser) => {
    if (user) {
      setEditingUser(user);
      form.reset({
        username: user.username,
        password: "", // Don't populate password for security
        confirmPassword: "",
        fullName: user.fullName || "",
        email: user.email || "",
        role: user.role as "admin" | "user" | "readonly",
        subscriptionType: user.subscriptionType as "free" | "basic" | "premium" | "enterprise",
        monthlyInvoiceLimit: user.monthlyInvoiceLimit,
        expirationDate: user.expirationDate && !isNaN(Date.parse(typeof user.expirationDate === 'string' ? user.expirationDate : user.expirationDate.toString())) ? new Date(user.expirationDate).toISOString().split('T')[0] : "",
        isActive: user.isActive,
        isBlocked: user.isBlocked,
      });
    } else {
      setEditingUser(null);
      form.reset();
    }
    setIsDialogOpen(true);
  };

  const toggleUserStatus = (userId: string, currentStatus: boolean) => {
    toggleStatusMutation.mutate({ id: userId, isActive: !currentStatus });
  };

  // Using robust formatDate from utils (handles invalid dates)
  const formatDateOrDefault = (dateString: string | Date | null) => {
    if (!dateString) return "Sin límite";
    const dateStr = dateString instanceof Date ? dateString.toISOString() : dateString;
    return formatDate(dateStr);
  };

  const getStatusBadge = (user: PublicUser) => {
    if (user.isBlocked) {
      return <Badge variant="destructive" className="flex items-center gap-1"><UserX className="h-3 w-3" />Bloqueado</Badge>;
    }
    if (!user.isActive) {
      return <Badge variant="secondary" className="flex items-center gap-1"><Clock className="h-3 w-3" />Inactivo</Badge>;
    }
    if (user.expirationDate && new Date(user.expirationDate) < new Date()) {
      return <Badge variant="destructive" className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Expirado</Badge>;
    }
    return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Activo</Badge>;
  };

  const getRoleBadge = (role: string) => {
    const roleConfig = {
      admin: { label: "Admin", icon: Crown, variant: "default" },
      user: { label: "Usuario", icon: UserIcon, variant: "secondary" },
      readonly: { label: "Lectura", icon: Eye, variant: "outline" },
    };
    
    const config = roleConfig[role as keyof typeof roleConfig] || roleConfig.user;
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant as any} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {config.label}
      </Badge>
    );
  };

  const getUsageStatus = (user: PublicUser) => {
    const percentage = (user.currentMonthInvoices / user.monthlyInvoiceLimit) * 100;
    if (percentage >= 100) {
      return <Badge variant="destructive">Límite alcanzado</Badge>;
    }
    if (percentage >= 80) {
      return <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Cerca del límite</Badge>;
    }
    return <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Normal</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando usuarios...</p>
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
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-users-title">
              Gestión de Usuarios
            </h1>
            <p className="text-muted-foreground" data-testid="text-users-subtitle">
              Administre usuarios y permisos del sistema
            </p>
          </div>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openDialog()} data-testid="button-add-user">
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Usuario
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingUser ? "Editar Usuario" : "Nuevo Usuario"}
              </DialogTitle>
              <DialogDescription>
                {editingUser ? "Modifique los datos del usuario" : "Registre un nuevo usuario en el sistema"}
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usuario *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="usuario123" 
                          {...field} 
                          disabled={!!editingUser}
                          data-testid="input-username" 
                        />
                      </FormControl>
                      <FormDescription>
                        Solo letras, números y guión bajo. No se puede cambiar después.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre Completo *</FormLabel>
                      <FormControl>
                        <Input placeholder="Juan Pérez García" {...field} data-testid="input-fullname" />
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
                        <Input type="email" placeholder="usuario@empresa.com" {...field} value={field.value || ""} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {!editingUser && (
                  <>
                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contraseña *</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="********" {...field} data-testid="input-password" />
                          </FormControl>
                          <FormDescription>
                            Mínimo 8 caracteres con mayúscula, minúscula y número
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmar Contraseña *</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="********" {...field} data-testid="input-confirm-password" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rol *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-role">
                              <SelectValue placeholder="Seleccione rol" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {roleOptions.map((role) => (
                              <SelectItem key={role.value} value={role.value}>
                                <div>
                                  <div className="font-medium">{role.label}</div>
                                  <div className="text-xs text-muted-foreground">{role.description}</div>
                                </div>
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
                    name="subscriptionType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Suscripción *</FormLabel>
                        <Select 
                          onValueChange={(value) => {
                            field.onChange(value);
                            updateInvoiceLimit(value);
                          }} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-subscription">
                              <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {subscriptionOptions.map((subscription) => (
                              <SelectItem key={subscription.value} value={subscription.value}>
                                <div>
                                  <div className="font-medium">{subscription.label}</div>
                                  <div className="text-xs text-muted-foreground">{subscription.description}</div>
                                </div>
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
                  name="monthlyInvoiceLimit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Límite Mensual de Facturas *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          max="10000" 
                          {...field} 
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                          data-testid="input-invoice-limit" 
                        />
                      </FormControl>
                      <FormDescription>
                        Cantidad máxima de facturas que puede emitir por mes
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="expirationDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fecha de Expiración</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value || ""} data-testid="input-expiration-date" />
                      </FormControl>
                      <FormDescription>
                        Deje vacío para acceso sin límite de tiempo
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="isActive"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-is-active"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Usuario Activo</FormLabel>
                          <FormDescription>
                            El usuario puede acceder al sistema
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isBlocked"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-is-blocked"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>Usuario Bloqueado</FormLabel>
                          <FormDescription>
                            Bloquear acceso temporalmente
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsDialogOpen(false)}
                    data-testid="button-cancel-user"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createMutation.isPending || updateMutation.isPending}
                    data-testid="button-save-user"
                  >
                    {(createMutation.isPending || updateMutation.isPending) ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        Guardando...
                      </>
                    ) : (
                      editingUser ? "Actualizar" : "Crear Usuario"
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
                  placeholder="Buscar por usuario, nombre o email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  data-testid="input-search-users"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Select value={filterRole} onValueChange={setFilterRole}>
                <SelectTrigger className="w-32" data-testid="select-filter-role">
                  <SelectValue placeholder="Rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="user">Usuario</SelectItem>
                  <SelectItem value="readonly">Lectura</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-32" data-testid="select-filter-status">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="active">Activos</SelectItem>
                  <SelectItem value="inactive">Inactivos</SelectItem>
                  <SelectItem value="blocked">Bloqueados</SelectItem>
                  <SelectItem value="expired">Expirados</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Usuarios del Sistema</CardTitle>
          <CardDescription>
            Total: {filteredUsers.length} usuarios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Suscripción</TableHead>
                <TableHead>Uso Mensual</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Último Acceso</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                  <TableCell>
                    <div>
                      <div className="font-medium" data-testid={`text-username-${user.id}`}>
                        {user.username}
                      </div>
                      <div className="text-sm text-muted-foreground" data-testid={`text-fullname-${user.id}`}>
                        {user.fullName}
                      </div>
                      {user.email && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {user.email}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell data-testid={`badge-role-${user.id}`}>
                    {getRoleBadge(user.role)}
                  </TableCell>
                  <TableCell data-testid={`text-subscription-${user.id}`}>
                    <div>
                      <div className="font-medium capitalize">{user.subscriptionType}</div>
                      <div className="text-xs text-muted-foreground">
                        Expira: {formatDateOrDefault(user.expirationDate)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-testid={`text-usage-${user.id}`}>
                    <div>
                      <div className="font-medium">
                        {user.currentMonthInvoices} / {user.monthlyInvoiceLimit}
                      </div>
                      <div className="text-xs">
                        {getUsageStatus(user)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell data-testid={`badge-status-${user.id}`}>
                    {getStatusBadge(user)}
                  </TableCell>
                  <TableCell data-testid={`text-last-login-${user.id}`}>
                    {user.lastLogin ? formatDateTimeRobust(user.lastLogin instanceof Date ? user.lastLogin.toISOString() : user.lastLogin) : "Nunca"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openDialog(user)}
                        data-testid={`button-edit-${user.id}`}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant={user.isActive ? "outline" : "default"}
                        size="sm"
                        onClick={() => toggleUserStatus(user.id, user.isActive)}
                        disabled={toggleStatusMutation.isPending}
                        data-testid={`button-toggle-status-${user.id}`}
                      >
                        {user.isActive ? (
                          <>
                            <UserX className="h-4 w-4" />
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No se encontraron usuarios</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}