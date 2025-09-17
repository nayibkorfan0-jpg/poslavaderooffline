import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

interface SaleItem {
  id: string;
  client: string;
  time: string;
  service: string;
  vehicle: string;
  status: 'completado' | 'en_proceso' | 'pendiente';
  amount: number;
  orderNumber: string;
}

interface RecentSalesProps {
  sales: SaleItem[];
  total: number;
  isEmpty?: boolean;
  isLoading?: boolean;
}

const statusColors = {
  'completado': 'success',
  'en_proceso': 'warning', 
  'pendiente': 'secondary'
} as const;

const statusLabels = {
  'completado': 'Completado',
  'en_proceso': 'En proceso',
  'pendiente': 'Pendiente'
} as const;

export function RecentSales({ sales, total, isEmpty = false, isLoading = false }: RecentSalesProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-xl" data-testid="text-sales-title">Ventas Recientes</CardTitle>
        <Button 
          variant="outline" 
          size="sm"
          data-testid="button-view-all-sales"
          onClick={() => console.log('View all sales triggered')}
        >
          Ver todas
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg animate-pulse">
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-muted rounded w-1/3"></div>
                <div className="h-3 bg-muted rounded w-1/2"></div>
                <div className="h-3 bg-muted rounded w-1/4"></div>
              </div>
              <div className="h-6 bg-muted rounded w-20"></div>
            </div>
          ))
        ) : isEmpty ? (
          // Empty state
          <div className="text-center py-8">
            <div className="text-muted-foreground mb-2">No hay ventas registradas hoy</div>
            <div className="text-sm text-muted-foreground">Las ventas aparecerán aquí una vez que comiences a facturar</div>
          </div>
        ) : (
          sales.map((sale) => (
            <div key={sale.id} className="flex items-center justify-between p-3 rounded-lg hover-elevate" data-testid={`sale-item-${sale.id}`}>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="font-medium text-foreground" data-testid={`text-client-${sale.id}`}>
                    {sale.client}
                  </h4>
                  <span className="text-sm text-muted-foreground" data-testid={`text-time-${sale.id}`}>
                    {sale.time}
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-sm text-foreground" data-testid={`text-service-${sale.id}`}>
                    {sale.service} • {sale.vehicle}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={statusColors[sale.status] as any} data-testid={`badge-status-${sale.id}`}>
                    {statusLabels[sale.status]}
                  </Badge>
                  <span className="text-xs text-muted-foreground" data-testid={`text-order-${sale.id}`}>
                    {sale.orderNumber}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-foreground" data-testid={`text-amount-${sale.id}`}>
                  {formatCurrency(sale.amount)}
                </div>
              </div>
            </div>
          ))
        )}
        
        <div className="border-t pt-4 mt-4">
          <div className="flex justify-between items-center">
            <span className="font-medium text-foreground">Total del día:</span>
            <span className="font-semibold text-lg text-foreground" data-testid="text-daily-total">
              {formatCurrency(total)}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}