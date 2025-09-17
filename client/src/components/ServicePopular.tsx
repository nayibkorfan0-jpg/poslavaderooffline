import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCurrency } from "@/lib/utils";

interface ServiceStats {
  name: string;
  count: number;
  revenue: number;
  vehicleBreakdown: {
    auto: number;
    suv: number;
    camioneta: number;
    moto: number;
  };
  percentage: number;
}

interface ServicePopularProps {
  services: ServiceStats[];
  totalServices: number;
  totalRevenue: number;
  mostPopular: string;
  isEmpty?: boolean;
  isLoading?: boolean;
}

export function ServicePopular({ services, totalServices, totalRevenue, mostPopular, isEmpty = false, isLoading = false }: ServicePopularProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl" data-testid="text-services-title">Servicios Populares</CardTitle>
        <p className="text-sm text-muted-foreground" data-testid="text-services-count">
          {totalServices} servicios hoy
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-3 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-4 bg-muted rounded w-8"></div>
              </div>
              <div className="flex items-center justify-between">
                <div className="h-3 bg-muted rounded w-1/4"></div>
                <div className="h-3 bg-muted rounded w-16"></div>
              </div>
              <div className="h-2 bg-muted rounded w-full"></div>
            </div>
          ))
        ) : isEmpty ? (
          // Empty state
          <div className="text-center py-8">
            <div className="text-muted-foreground mb-2">No hay servicios realizados hoy</div>
            <div className="text-sm text-muted-foreground">Los servicios aparecerán aquí una vez que comiences a atender clientes</div>
          </div>
        ) : (
          services.map((service, index) => (
            <div key={service.name} className="space-y-3" data-testid={`service-item-${index}`}>
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground" data-testid={`text-service-name-${index}`}>
                  {service.name}
                </h4>
                <span className="text-sm font-medium text-muted-foreground" data-testid={`text-service-percentage-${index}`}>
                  {service.percentage}%
                </span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground" data-testid={`text-service-count-${index}`}>
                  {service.count} servicios
                </span>
                <span className="font-medium text-foreground" data-testid={`text-service-revenue-${index}`}>
                  {formatCurrency(service.revenue)}
                </span>
              </div>

              <div className="flex gap-4 text-xs text-muted-foreground">
                {service.vehicleBreakdown.auto > 0 && (
                  <span data-testid={`text-auto-count-${index}`}>Auto: {service.vehicleBreakdown.auto}</span>
                )}
                {service.vehicleBreakdown.suv > 0 && (
                  <span data-testid={`text-suv-count-${index}`}>SUV: {service.vehicleBreakdown.suv}</span>
                )}
                {service.vehicleBreakdown.camioneta > 0 && (
                  <span data-testid={`text-camioneta-count-${index}`}>Camioneta: {service.vehicleBreakdown.camioneta}</span>
                )}
                {service.vehicleBreakdown.moto > 0 && (
                  <span data-testid={`text-moto-count-${index}`}>Moto: {service.vehicleBreakdown.moto}</span>
                )}
              </div>

              <Progress value={service.percentage} className="h-2" />
            </div>
          ))
        )}

        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Servicio más popular</span>
            <span className="font-medium text-foreground" data-testid="text-most-popular">
              {mostPopular}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Ingresos por servicios</span>
            <span className="font-medium text-foreground" data-testid="text-total-revenue">
              {formatCurrency(totalRevenue)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}