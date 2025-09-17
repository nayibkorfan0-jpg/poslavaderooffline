import { Switch, Route } from "wouter";
import { queryClient, getQueryFn } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Dashboard } from "@/components/Dashboard";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LoginForm } from "@/components/LoginForm";
import NotFound from "@/pages/not-found";
import ConfiguracionPage from "@/pages/configuracion";
import ServiciosPage from "@/pages/servicios";
import OrdenesPage from "@/pages/ordenes";
import ClientesPage from "@/pages/clientes";
import InventarioPage from "@/pages/inventario";
import VentasPage from "@/pages/ventas";
import ReportesPage from "@/pages/reportes";
import UsuariosPage from "@/pages/usuarios";
import { Component, ReactNode } from "react";

// Error Boundary to prevent white screens
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('=== CRITICAL ERROR CAUGHT BY ERROR BOUNDARY ===');
    console.error('Error:', error);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
    console.error('=== END ERROR BOUNDARY ===');
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <h2 className="text-lg font-semibold mb-2">Algo salió mal</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Ocurrió un error inesperado. Por favor, recarga la página.
            </p>
            {/* Show error details for debugging */}
            {this.state.error && (
              <div className="text-xs bg-red-100 dark:bg-red-900 p-2 rounded mb-4 text-left">
                <strong>ERROR:</strong> {this.state.error.message}<br/>
                <strong>STACK:</strong> {this.state.error.stack?.substring(0, 200)}...
              </div>
            )}
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-primary text-primary-foreground rounded"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Dashboard />} />
      <Route path="/dashboard" component={() => <Dashboard />} />
      <Route path="/ordenes" component={() => <OrdenesPage />} />
      <Route path="/clientes" component={() => <ClientesPage />} />
      <Route path="/servicios" component={() => <ServiciosPage />} />
      <Route path="/inventario" component={() => <InventarioPage />} />
      <Route path="/ventas" component={() => <VentasPage />} />
      <Route path="/reportes" component={() => <ReportesPage />} />
      <Route path="/usuarios" component={() => <UsuariosPage />} />
      <Route path="/configuracion" component={() => <ConfiguracionPage />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <TooltipProvider>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1">
            <header className="flex items-center justify-between p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-auto">
              <div className="container mx-auto p-6">
                <Router />
              </div>
            </main>
          </div>
        </div>
        <Toaster />
      </SidebarProvider>
    </TooltipProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <AuthWrapper />
      </ErrorBoundary>
    </QueryClientProvider>
  );
}

type AuthMeResponse = { 
  user?: { 
    id: string; 
    username: string; 
    fullName?: string; 
    email?: string;
    role?: string;
  } 
};

function AuthWrapper() {
  const { data: authData, isLoading, isFetching } = useQuery<AuthMeResponse>({
    queryKey: ["/api/auth/me"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: "always",
    retry: false,
  });

  // Show loading state during initial load or refetch
  if (isLoading || isFetching) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verificando autenticación...</p>
        </div>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!isLoading && !isFetching && !authData?.user) {
    return <LoginForm />;
  }

  // Show authenticated app only when fully loaded and authenticated
  if (!isLoading && !isFetching && authData?.user) {
    return <AuthenticatedApp />;
  }

  // Fallback loading state
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-muted-foreground">Verificando autenticación...</p>
      </div>
    </div>
  );
}

export default App;
