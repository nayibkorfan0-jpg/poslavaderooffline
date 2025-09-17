import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Eye, EyeOff, Car } from "lucide-react";

const loginSchema = z.object({
  username: z.string().min(1, "El nombre de usuario es requerido"),
  password: z.string().min(1, "La contraseña es requerida"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export function LoginForm() {
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onSubmit", // Explicit mode
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginFormData) => {
      const response = await apiRequest("POST", "/api/auth/login", data);
      return response;
    },
    onSuccess: async (data) => {
      console.log("Login successful, response:", data);
      
      if (!data?.user) {
        console.error("Invalid login response - missing user data");
        toast({
          title: "Error de login",
          description: "Respuesta inválida del servidor",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Login exitoso",
        description: `Bienvenido, ${data.user.fullName || data.user.username}`,
      });
      
      // Set auth data with correct format matching /api/auth/me response
      queryClient.setQueryData(["/api/auth/me"], { user: data.user });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      await queryClient.refetchQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Error de autenticación",
        description: error.message || "Usuario o contraseña incorrectos",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LoginFormData) => {
    console.log("Login form submitting:", { username: data.username, hasPassword: !!data.password });
    loginMutation.mutate(data);
  };

  const handleValidationErrors = (errors: any) => {
    console.log("Login form validation errors:", errors);
    toast({
      title: "Error de validación",
      description: "Por favor complete todos los campos requeridos",
      variant: "destructive",
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-12 h-12 bg-primary rounded-full flex items-center justify-center">
            <Car className="w-6 h-6 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-bold">1SOLUTION</CardTitle>
            <CardDescription className="text-lg">
              Sistema de Gestión para Car Wash
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Usuario</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        data-testid="input-username"
                        placeholder="Ingrese su usuario"
                        autoComplete="username"
                        disabled={loginMutation.isPending}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contraseña</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          data-testid="input-password"
                          type={showPassword ? "text" : "password"}
                          placeholder="Ingrese su contraseña"
                          autoComplete="current-password"
                          disabled={loginMutation.isPending}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="button-login"
              >
                {loginMutation.isPending ? "Iniciando sesión..." : "Iniciar Sesión"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}