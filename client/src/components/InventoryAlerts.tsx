import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Package } from "lucide-react";

interface InventoryItem {
  id: string;
  name: string;
  currentStock: number;
  minStock: number;
  unit: string;
  supplier: string;
  lastOrder: string;
  status: 'critico' | 'bajo';
}

interface InventoryAlertsProps {
  items: InventoryItem[];
  totalProducts: number;
  criticalCount: number;
  lowCount: number;
  isEmpty?: boolean;
  isLoading?: boolean;
}

export function InventoryAlerts({ items, totalProducts, criticalCount, lowCount, isEmpty = false, isLoading = false }: InventoryAlertsProps) {
  const getStatusColor = (status: string) => {
    return status === 'critico' ? 'destructive' : 'secondary';
  };

  const getStatusLabel = (status: string) => {
    return status === 'critico' ? 'CRÍTICO' : 'BAJO';
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-xl flex items-center gap-2" data-testid="text-inventory-title">
            <Package className="h-5 w-5" />
            Alertas de Inventario
          </CardTitle>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="flex items-center gap-1 text-critical" data-testid="text-critical-count">
              <AlertTriangle className="h-4 w-4" />
              {criticalCount} críticos
            </span>
            <span className="flex items-center gap-1 text-warning" data-testid="text-low-count">
              <AlertTriangle className="h-4 w-4" />
              {lowCount} bajos
            </span>
          </div>
        </div>
        <Button 
          variant="outline" 
          size="sm"
          data-testid="button-manage-inventory"
          onClick={() => console.log('Navigate to inventory management')}
        >
          Gestionar inventario
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          // Loading skeleton
          Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="p-4 border rounded-lg space-y-3 animate-pulse">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-4 bg-muted rounded w-32"></div>
                  <div className="h-6 bg-muted rounded w-16"></div>
                </div>
                <div className="h-8 bg-muted rounded w-24"></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i}>
                    <div className="h-3 bg-muted rounded w-16 mb-1"></div>
                    <div className="h-4 bg-muted rounded w-20"></div>
                  </div>
                ))}
              </div>
            </div>
          ))
        ) : isEmpty ? (
          // Empty state
          <div className="text-center py-8">
            <div className="text-muted-foreground mb-2">No hay alertas de inventario</div>
            <div className="text-sm text-muted-foreground">Agrega productos a tu inventario para ver alertas de stock bajo</div>
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="p-4 border rounded-lg space-y-3" data-testid={`inventory-item-${item.id}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h4 className="font-medium text-foreground" data-testid={`text-item-name-${item.id}`}>
                    {item.name}
                  </h4>
                  <Badge variant={getStatusColor(item.status)} data-testid={`badge-status-${item.id}`}>
                    {getStatusLabel(item.status)}
                  </Badge>
                </div>
                <Button 
                  size="sm"
                  data-testid={`button-order-${item.id}`}
                  onClick={() => console.log(`Order ${item.name}`)}
                >
                  Realizar pedido
                </Button>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Stock actual:</span>
                  <div className="font-medium text-foreground" data-testid={`text-current-stock-${item.id}`}>
                    {item.currentStock} {item.unit}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Stock mínimo:</span>
                  <div className="font-medium text-foreground" data-testid={`text-min-stock-${item.id}`}>
                    {item.minStock} {item.unit}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Proveedor:</span>
                  <div className="font-medium text-foreground" data-testid={`text-supplier-${item.id}`}>
                    {item.supplier}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Último pedido:</span>
                  <div className="font-medium text-foreground" data-testid={`text-last-order-${item.id}`}>
                    {item.lastOrder}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}

        <div className="border-t pt-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="font-semibold text-lg text-foreground" data-testid="text-total-products">
                {totalProducts}
              </div>
              <div className="text-sm text-muted-foreground">Productos total</div>
            </div>
            <div>
              <div className="font-semibold text-lg text-critical" data-testid="text-critical-products">
                {criticalCount}
              </div>
              <div className="text-sm text-muted-foreground">Stock crítico</div>
            </div>
            <div>
              <div className="font-semibold text-lg text-warning" data-testid="text-reorder-needed">
                {lowCount}
              </div>
              <div className="text-sm text-muted-foreground">Necesita reorden</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}