import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatDateTimeRobust } from "@/lib/utils";
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Users,
  Car,
  Calendar,
  Download,
  Eye,
  Star,
  Clock,
  Package,
  CreditCard,
  FileText,
  RefreshCw
} from "lucide-react";

// Format price for Paraguay (Guaraní)
const formatPrice = (price: number) => {
  return `Gs. ${price.toLocaleString('es-PY')}`;
};

// Remove old formatDate - now imported from utils

export default function ReportesPage() {
  const [period, setPeriod] = useState<string>("week");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // Simulated queries
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['/api/reports/sales', period],
  });

  const { data: servicesData, isLoading: servicesLoading } = useQuery({
    queryKey: ['/api/reports/services'],
    queryFn: async () => {
      await new Promise(resolve => setTimeout(resolve, 300));
      const response = await fetch('/api/reports/services');
      if (!response.ok) throw new Error('Failed to fetch services data');
      return response.json();
    }
  });

  const { data: customersData, isLoading: customersLoading } = useQuery({
    queryKey: ['/api/reports/customers'],
  });

  // Calculate current period stats from real data
  const currentWeekSales = (salesData as any)?.daily?.reduce((sum: number, day: any) => sum + (day.amount || 0), 0) || 0;
  const currentWeekOrders = (salesData as any)?.daily?.reduce((sum: number, day: any) => sum + (day.orders || 0), 0) || 0;
  const avgOrderValue = currentWeekOrders > 0 ? Math.round(currentWeekSales / currentWeekOrders) : 0;
  const totalCustomers = (customersData as any)?.length || 0;

  // Format price for Paraguay (Guaraní)
  const formatPrice = (price: number) => {
    return `Gs. ${price.toLocaleString('es-PY')}`;
  };

  if (salesLoading || servicesLoading || customersLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando reportes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold text-foreground" data-testid="text-reports-title">
              Reportes de Negocio
            </h1>
            <p className="text-muted-foreground" data-testid="text-reports-subtitle">
              Análisis de ventas, servicios y rendimiento
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" data-testid="button-export-report">
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <Button variant="outline" data-testid="button-refresh-reports">
            <RefreshCw className="h-4 w-4 mr-2" />
            Actualizar
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex gap-2">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="w-32" data-testid="select-period">
                  <SelectValue placeholder="Período" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Hoy</SelectItem>
                  <SelectItem value="week">Esta Semana</SelectItem>
                  <SelectItem value="month">Este Mes</SelectItem>
                  <SelectItem value="quarter">Trimestre</SelectItem>
                  <SelectItem value="year">Año</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
              
              {period === "custom" && (
                <>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-40"
                    placeholder="Desde"
                    data-testid="input-date-from"
                  />
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-40"
                    placeholder="Hasta"
                    data-testid="input-date-to"
                  />
                </>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div>
                <p className="text-sm text-muted-foreground">Ventas del Período</p>
                <p className="text-2xl font-semibold text-green-600" data-testid="metric-period-sales">
                  {formatPrice(currentWeekSales)}
                </p>
                <div className="flex items-center gap-1 text-xs">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-600">+12% vs anterior</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Car className="h-8 w-8 text-blue-600" />
              <div>
                <p className="text-sm text-muted-foreground">Órdenes Completadas</p>
                <p className="text-2xl font-semibold text-blue-600" data-testid="metric-orders-completed">
                  {currentWeekOrders}
                </p>
                <div className="flex items-center gap-1 text-xs">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-600">+8% vs anterior</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CreditCard className="h-8 w-8 text-purple-600" />
              <div>
                <p className="text-sm text-muted-foreground">Ticket Promedio</p>
                <p className="text-2xl font-semibold text-purple-600" data-testid="metric-average-ticket">
                  {formatPrice(avgOrderValue)}
                </p>
                <div className="flex items-center gap-1 text-xs">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-600">+3% vs anterior</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-orange-600" />
              <div>
                <p className="text-sm text-muted-foreground">Clientes Activos</p>
                <p className="text-2xl font-semibold text-orange-600" data-testid="metric-active-customers">
                  {totalCustomers}
                </p>
                <div className="flex items-center gap-1 text-xs">
                  <TrendingUp className="h-3 w-3 text-green-500" />
                  <span className="text-green-600">+5% vs anterior</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Ventas por Día
            </CardTitle>
            <CardDescription>
              Evolución de ventas en los últimos 7 días
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {((salesData as any)?.daily || []).map((day: any, index: number) => {
                const dailyData = (salesData as any)?.daily || [];
                const maxAmount = dailyData.length > 0 ? Math.max(...dailyData.map((d: any) => d.amount || 0)) : 1;
                const percentage = maxAmount > 0 ? ((day.amount || 0) / maxAmount) * 100 : 0;
                
                return (
                  <div key={index} className="space-y-2" data-testid={`sales-bar-${index}`}>
                    <div className="flex justify-between text-sm">
                      <span>{formatDate(day.date)}</span>
                      <span className="font-medium">{formatPrice(day.amount)}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{day.orders} órdenes</span>
                      <span>{formatPrice(Math.round(day.amount / day.orders))} promedio</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Services */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Star className="h-5 w-5" />
              Servicios Más Populares
            </CardTitle>
            <CardDescription>
              Ranking de servicios por ingresos generados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {((servicesData as any) || []).map((service: any, index: number) => (
                <div key={service.id} className="flex items-center gap-3" data-testid={`service-rank-${index}`}>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-bold ${
                    index === 0 ? 'bg-yellow-500' :
                    index === 1 ? 'bg-gray-400' :
                    index === 2 ? 'bg-amber-600' :
                    'bg-muted-foreground'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{service.name}</span>
                      <span className="text-sm text-green-600 font-medium">
                        {formatPrice(service.revenue)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>{service.count} servicios</span>
                      <span>{service.percentage}% del total</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Mejores Clientes
            </CardTitle>
            <CardDescription>
              Clientes con mayor facturación y frecuencia
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {((customersData as any) || []).map((customer: any, index: number) => (
                <div key={customer.id} className="flex items-center justify-between p-3 border rounded" data-testid={`top-customer-${index}`}>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                      {customer.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{customer.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {customer.visits} visitas • Última: {formatDate(customer.lastVisit)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-green-600">
                      {formatPrice(customer.spent)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatPrice(Math.round(customer.spent / customer.visits))} promedio
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Inventory Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Alertas de Inventario
            </CardTitle>
            <CardDescription>
              Productos con stock crítico o agotado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Inventory alerts would come from API */}
              {[].map((alert: any, index: number) => (
                <div key={alert.id} className="flex items-center justify-between p-3 border rounded" data-testid={`inventory-alert-${index}`}>
                  <div className="flex items-center gap-3">
                    <Package className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{alert.product}</p>
                      <p className="text-sm text-muted-foreground">
                        Stock actual: {alert.current} | Mínimo: {alert.minimum}
                      </p>
                    </div>
                  </div>
                  <Badge className={
                    alert.status === 'out' 
                      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                      : alert.status === 'critical'
                      ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
                      : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  }>
                    {alert.status === 'out' ? 'Agotado' : 
                     alert.status === 'critical' ? 'Crítico' : 'Bajo'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Acciones Rápidas
          </CardTitle>
          <CardDescription>
            Enlaces rápidos a reportes detallados y exportaciones
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2" data-testid="button-sales-report">
              <DollarSign className="h-6 w-6 text-green-600" />
              <span className="text-sm font-medium">Reporte de Ventas</span>
              <span className="text-xs text-muted-foreground">Detallado por período</span>
            </Button>
            
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2" data-testid="button-services-report">
              <Star className="h-6 w-6 text-blue-600" />
              <span className="text-sm font-medium">Análisis de Servicios</span>
              <span className="text-xs text-muted-foreground">Popularidad y rentabilidad</span>
            </Button>
            
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2" data-testid="button-customers-report">
              <Users className="h-6 w-6 text-purple-600" />
              <span className="text-sm font-medium">Reporte de Clientes</span>
              <span className="text-xs text-muted-foreground">Segmentación y valor</span>
            </Button>
            
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2" data-testid="button-inventory-report">
              <Package className="h-6 w-6 text-orange-600" />
              <span className="text-sm font-medium">Control de Stock</span>
              <span className="text-xs text-muted-foreground">Movimientos y alertas</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}