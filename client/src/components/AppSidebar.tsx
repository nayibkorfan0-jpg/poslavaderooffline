import { 
  LayoutDashboard, 
  Users, 
  Car, 
  Settings, 
  Package, 
  CreditCard,
  FileText,
  BarChart3,
  LogOut,
  Building2,
  UserCog
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { type CompanyConfig } from "@shared/schema";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import logoUrl from "@assets/Gemini_Generated_Image_kwl7qlkwl7qlkwl7_1757809609665.png";

type AuthMeResponse = { 
  user?: { 
    id: string; 
    username: string; 
    fullName?: string; 
    email?: string;
    role?: string;
  } 
};

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Órdenes de Servicio",
    url: "/ordenes",
    icon: Car,
  },
  {
    title: "Clientes",
    url: "/clientes",
    icon: Users,
  },
  {
    title: "Servicios",
    url: "/servicios",
    icon: FileText,
  },
  {
    title: "Inventario",
    url: "/inventario",
    icon: Package,
  },
  {
    title: "Ventas",
    url: "/ventas",
    icon: CreditCard,
  },
  {
    title: "Reportes",
    url: "/reportes",
    icon: BarChart3,
  },
  {
    title: "Usuarios",
    url: "/usuarios",
    icon: UserCog,
  },
  {
    title: "Configuración",
    url: "/configuracion",
    icon: Settings,
  },
];

export function AppSidebar() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch company configuration for logo display
  const { data: config } = useQuery<CompanyConfig | null>({
    queryKey: ['/api/company-config'],
  });

  // Fetch current user data
  const { data: authData } = useQuery<AuthMeResponse>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
  });

  // Logout mutation
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/auth/logout", {});
      return response;
    },
    onSuccess: () => {
      toast({
        title: "Sesión cerrada",
        description: "Has cerrado sesión exitosamente",
      });
      
      // Clear all React Query cache and redirect immediately
      queryClient.clear();
      window.location.href = "/";
    },
    onError: (error: any) => {
      // Treat 401 as success (user already logged out)
      if (error.message && error.message.includes("401")) {
        queryClient.clear();
        window.location.href = "/";
        return;
      }
      
      toast({
        title: "Error al cerrar sesión",
        description: error.message || "No se pudo cerrar la sesión",
        variant: "destructive",
      });
    },
  });

  const handleLogout = () => {
    logoutMutation.mutate();
  };
  
  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8">
            <img 
              src={config?.logoPath || logoUrl}
              alt={config?.logoPath ? `${config.razonSocial || config.nombreFantasia || 'Empresa'} - Logo` : "1SOLUTION"}
              className="h-8 w-auto max-w-8 object-contain"
              data-testid="img-logo-sidebar"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                const currentSrc = img.src;
                
                // Triple fallback: company logo → 1SOLUTION logo → Building2 icon
                if (config?.logoPath && currentSrc.includes(config.logoPath)) {
                  // First fallback: company logo failed, try 1SOLUTION logo
                  img.src = logoUrl;
                  img.alt = "1SOLUTION";
                } else if (currentSrc.includes('Gemini_Generated_Image')) {
                  // Second fallback: 1SOLUTION logo failed, show Building2 icon
                  img.style.display = 'none';
                  img.nextElementSibling?.classList.remove('hidden');
                } else {
                  // Final fallback: show Building2 icon
                  img.style.display = 'none';
                  img.nextElementSibling?.classList.remove('hidden');
                }
              }}
            />
            <Building2 className="h-6 w-6 text-primary hidden" data-testid="icon-logo-fallback-sidebar" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-foreground" data-testid="text-app-title">1SOLUTION</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-app-subtitle">Sistema Lavadero</p>
          </div>
        </div>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Gestión completa del negocio</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild data-testid={`link-${item.title.toLowerCase()}`}>
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center gap-3 p-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src="" alt={authData?.user?.username || "Usuario"} />
            <AvatarFallback className="text-xs">
              {authData?.user?.username ? authData.user.username.charAt(0).toUpperCase() : "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate" data-testid="text-username">
              {authData?.user?.fullName || authData?.user?.username || "Usuario"}
            </p>
            <p className="text-xs text-muted-foreground truncate" data-testid="text-user-role">
              {authData?.user?.role || "Usuario"}
            </p>
          </div>
          <Button 
            size="icon" 
            variant="ghost"
            data-testid="button-logout"
            onClick={handleLogout}
            disabled={logoutMutation.isPending}
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Developer credit */}
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-xs text-muted-foreground text-center leading-relaxed">
            DESAROLLADO POR NAYIB KORFAN<br />
            BY 1SOLUTION S.R.L
          </p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}