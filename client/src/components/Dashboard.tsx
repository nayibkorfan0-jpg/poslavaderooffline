import { MetricCard } from "./MetricCard";
import { TimbradoAlert } from "./TimbradoAlert";
import { RecentSales } from "./RecentSales";
import { ServicePopular } from "./ServicePopular";
import { InventoryAlerts } from "./InventoryAlerts";
import { formatDateTime } from "@/lib/utils";
import { DollarSign, Car, Users, Package, Settings, Building2 } from "lucide-react";
import logoUrl from "@assets/Gemini_Generated_Image_kwl7qlkwl7qlkwl7_1757809609665.png";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { type CompanyConfig, type Sale, type InventoryItem, type WorkOrder } from "@shared/schema";

export function Dashboard() {
  const currentDateTime = new Date();
  
  // Fetch company configuration for header display
  const { data: config } = useQuery<CompanyConfig | null>({
    queryKey: ['/api/company-config'],
  });
  
  // Fetch real data from backend - always fresh with auto-refresh
  const { data: sales = [], isLoading: salesLoading } = useQuery<Sale[]>({
    queryKey: ['/api/sales'],
    staleTime: 0, // Always fresh
    gcTime: 0, // No cache retention
    refetchInterval: 30000, // Auto-refresh every 30 seconds
    refetchOnWindowFocus: true, // Refresh when user returns to tab
  });
  
  const { data: inventory = [], isLoading: inventoryLoading } = useQuery<InventoryItem[]>({
    queryKey: ['/api/inventory'],
    staleTime: 0, // Always fresh
    gcTime: 0, // No cache retention
    refetchInterval: 60000, // Auto-refresh every minute
    refetchOnWindowFocus: true,
  });
  
  const { data: workOrders = [], isLoading: ordersLoading } = useQuery<WorkOrder[]>({
    queryKey: ['/api/work-orders'],
    staleTime: 0, // Always fresh
    gcTime: 0, // No cache retention
    refetchInterval: 15000, // Auto-refresh every 15 seconds
    refetchOnWindowFocus: true,
  });
  
  // Get company display name for subtitle - show real company data
  const getCompanyDisplayName = () => {
    if (!config) return 'Empresa no configurada';
    
    const companyName = config.nombreFantasia || config.razonSocial;
    return companyName || 'Empresa no configurada';
  };
  
  const getCompanySubtitle = () => {
    if (!config) return 'Gestión completa del negocio • Configure los datos de su empresa';
    
    const parts = [];
    // Add company name first
    const companyName = config.nombreFantasia || config.razonSocial;
    if (companyName) parts.push(companyName);
    
    // Add location
    if (config.ciudad) parts.push(config.ciudad);
    
    // Add RUC
    if (config.ruc) parts.push(`RUC: ${config.ruc}`);
    
    return parts.length > 0 ? parts.join(' • ') : 'Gestión completa del negocio';
  };
  
  // Calculate metrics from real data
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  
  // Sales metrics
  const todaySales = sales.filter(sale => new Date(sale.createdAt) >= todayStart);
  const todayRevenue = todaySales.reduce((sum, sale) => sum + parseInt(sale.total), 0);
  
  // Inventory alerts
  const criticalInventory = inventory.filter(item => item.estadoAlerta === 'critico');
  const lowInventory = inventory.filter(item => item.estadoAlerta === 'bajo');
  const stockIssues = criticalInventory.length + lowInventory.length;
  
  // Work orders metrics
  const todayOrders = workOrders.filter(order => new Date(order.createdAt) >= todayStart);
  const completedToday = todayOrders.filter(order => order.estado === 'entregado');
  
  const metrics = [
    {
      title: "Ventas de Hoy",
      value: todayRevenue > 0 ? `Gs. ${todayRevenue.toLocaleString('es-PY')}` : "Gs. 0",
      icon: <DollarSign />,
      trend: todaySales.length > 0 ? { value: `${todaySales.length} ventas`, type: 'up' as const } : { value: 'Sin ventas', type: 'neutral' as const }
    },
    {
      title: "Servicios Realizados", 
      value: completedToday.length.toString(),
      icon: <Car />,
      trend: completedToday.length > 0 ? { value: `${completedToday.length} completados`, type: 'up' as const } : { value: 'Sin servicios', type: 'neutral' as const }
    },
    {
      title: "Órdenes Activas",
      value: todayOrders.length.toString(),
      icon: <Users />,
      trend: todayOrders.length > 0 ? { value: `${todayOrders.length} órdenes`, type: 'up' as const } : { value: 'Sin órdenes', type: 'neutral' as const }
    },
    {
      title: "Alertas de Stock",
      value: stockIssues.toString(),
      icon: <Package />,
      trend: stockIssues > 0 ? { value: `${criticalInventory.length} críticos`, type: 'down' as const } : { value: 'Stock normal', type: 'up' as const }
    }
  ];

  // Transform recent sales data for display
  const recentSales = todaySales.slice(0, 5).map(sale => ({
    id: sale.id,
    client: 'Cliente', // We'll need to fetch customer name separately if needed
    time: new Date(sale.createdAt).toLocaleTimeString('es-PY', { hour: '2-digit', minute: '2-digit' }),
    service: 'Servicios varios', // We'll need to fetch service details from sale items
    vehicle: '-',
    status: 'completado' as const,
    amount: parseInt(sale.total),
    orderNumber: sale.numeroFactura
  }));

  // Calculate service popularity from real data (simplified for now)
  const serviceStats = todaySales.length > 0 ? [
    {
      name: 'Servicios Generales',
      count: todaySales.length,
      revenue: todayRevenue,
      vehicleBreakdown: { auto: 0, suv: 0, camioneta: 0, moto: 0 },
      percentage: 100
    }
  ] : [];

  // Transform inventory data for alerts component
  const inventoryAlerts = [...criticalInventory, ...lowInventory].map(item => ({
    id: item.id,
    name: item.nombre,
    currentStock: item.stockActual,
    minStock: item.stockMinimo,
    unit: item.unidadMedida || 'unidades',
    supplier: item.proveedor || 'Sin proveedor',
    lastOrder: item.ultimoPedido || 'Sin pedidos',
    status: item.estadoAlerta as 'critico' | 'bajo'
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10">
            <img 
              src={config?.logoPath || logoUrl}
              alt={config?.logoPath ? `${config.razonSocial || config.nombreFantasia || 'Empresa'} - Logo` : "1SOLUTION - Sistema de gestión para lavaderos"}
              className="w-10 h-10 object-contain"
              data-testid="img-logo-dashboard"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                const currentSrc = img.src;
                
                // Triple fallback: company logo → 1SOLUTION logo → Building2 icon
                if (config?.logoPath && currentSrc.includes(config.logoPath)) {
                  // First fallback: company logo failed, try 1SOLUTION logo
                  img.src = logoUrl;
                  img.alt = "1SOLUTION - Sistema de gestión para lavaderos";
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
            <Building2 className="h-6 w-6 text-primary hidden" data-testid="icon-logo-fallback" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-dashboard-title">
              Dashboard - 1SOLUTION
            </h1>
            <p className="text-muted-foreground" data-testid="text-dashboard-subtitle">
              {getCompanySubtitle()}
            </p>
            {config && (
              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                {config.establecimiento && config.puntoExpedicion && (
                  <span>Timbrado: {config.establecimiento}-{config.puntoExpedicion}</span>
                )}
                {config.moneda && (
                  <span>Moneda: {config.moneda}</span>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground" data-testid="text-current-time">
              {formatDateTime(currentDateTime)}
            </p>
          </div>
          <Button
            size="icon"
            variant="outline"
            data-testid="button-settings"
            onClick={() => console.log('Navigate to settings')}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Timbrado Alert */}
      <TimbradoAlert />

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {salesLoading || inventoryLoading || ordersLoading ? (
          // Loading skeleton
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="bg-card p-6 rounded-lg animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-muted rounded w-1/2 mb-2"></div>
              <div className="h-3 bg-muted rounded w-2/3"></div>
            </div>
          ))
        ) : (
          metrics.map((metric, index) => (
            <MetricCard
              key={index}
              title={metric.title}
              value={metric.value}
              icon={metric.icon}
              trend={metric.trend}
            />
          ))
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Column */}
        <div className="space-y-6">
          <RecentSales 
            sales={recentSales} 
            total={todayRevenue}
            isEmpty={recentSales.length === 0}
            isLoading={salesLoading}
          />
          <ServicePopular
            services={serviceStats}
            totalServices={completedToday.length}
            totalRevenue={todayRevenue}
            mostPopular={serviceStats.length > 0 ? serviceStats[0].name : "Ninguno"}
            isEmpty={serviceStats.length === 0}
            isLoading={salesLoading}
          />
        </div>

        {/* Right Column */}
        <div>
          <InventoryAlerts
            items={inventoryAlerts}
            totalProducts={inventory.length}
            criticalCount={criticalInventory.length}
            lowCount={lowInventory.length}
            isEmpty={inventoryAlerts.length === 0}
            isLoading={inventoryLoading}
          />
        </div>
      </div>
    </div>
  );
}