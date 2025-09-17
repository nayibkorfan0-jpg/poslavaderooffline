import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Printer, 
  FileText,
  User,
  Calendar,
  Car,
  Clock,
  CheckCircle,
  Play,
  AlertTriangle,
  Loader2
} from "lucide-react";
import type { WorkOrder, Customer, Vehicle, Service } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PrintWorkOrderProps {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder | null;
}

// Robust HTML escaping utility to prevent XSS attacks
const escapeHTML = (str: string | number | null | undefined): string => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

// Format price for Paraguay (Guaraní)
const formatPrice = (price: number | string) => {
  const numPrice = typeof price === 'string' ? parseInt(price) : price;
  return `Gs. ${numPrice.toLocaleString('es-PY')}`;
};

// Format date for Paraguay - accepts both string and Date
const formatDate = (date: string | Date) => {
  const dateObj = date instanceof Date ? date : new Date(date);
  return dateObj.toLocaleDateString('es-PY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Status configuration for display
const statusConfig = {
  recibido: { 
    label: "Recibido", 
    color: "#1976d2",
    bgColor: "#e3f2fd",
    icon: Clock 
  },
  "en_proceso": { 
    label: "En Proceso", 
    color: "#f57c00",
    bgColor: "#fff3e0",
    icon: Play 
  },
  terminado: { 
    label: "Listo", 
    color: "#388e3c",
    bgColor: "#e8f5e8",
    icon: CheckCircle 
  },
  entregado: { 
    label: "Entregado", 
    color: "#616161",
    bgColor: "#f5f5f5",
    icon: CheckCircle 
  }
};

export default function PrintWorkOrder({ isOpen, onClose, workOrder }: PrintWorkOrderProps) {
  const { toast } = useToast();
  
  // Fetch work order details with services
  const { data: workOrderDetails, isLoading, isError, error } = useQuery({
    queryKey: ['/api/print/work-orders', workOrder?.id],
    queryFn: async () => {
      if (!workOrder?.id) return null;
      const response = await apiRequest('GET', `/api/print/work-orders/${workOrder.id}`);
      if (!response.ok) throw new Error('Failed to fetch work order details');
      return response;
    },
    enabled: isOpen && !!workOrder?.id,
    retry: 3,
  });

  // Handle errors with toast notifications
  if (isError && error) {
    toast({
      title: "Error al cargar orden",
      description: `No se pudo obtener los detalles de la orden: ${error.message}`,
      variant: "destructive",
    });
  }

  const handlePrint = (size: '80mm' | 'A4') => {
    if (!workOrder || !workOrderDetails) return;

    const { customer, vehicle, orderItems } = workOrderDetails;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const total = parseInt(workOrder.total);
    const status = statusConfig[workOrder.estado as keyof typeof statusConfig] || { label: workOrder.estado, color: "#000", bgColor: "#f5f5f5" };

    // CSS styles for different paper sizes
    const styles = `
      <style>
        @media print {
          @page {
            ${size === '80mm' 
              ? 'size: 80mm auto; margin: 5mm;' 
              : 'size: A4; margin: 15mm;'
            }
          }
          body { 
            margin: 0; 
            padding: 0;
            font-family: 'Arial', sans-serif;
            ${size === '80mm' ? 'font-size: 11px;' : 'font-size: 13px;'}
            line-height: 1.3;
          }
          .no-print { display: none !important; }
        }
        
        body { 
          font-family: 'Arial', sans-serif;
          margin: 0;
          padding: ${size === '80mm' ? '5mm' : '15mm'};
          ${size === '80mm' ? 'font-size: 11px;' : 'font-size: 13px;'}
          line-height: 1.3;
          max-width: ${size === '80mm' ? '70mm' : '190mm'};
          color: #333;
        }
        
        .order-header { 
          text-align: center; 
          border-bottom: 2px solid #000; 
          padding-bottom: 12px; 
          margin-bottom: 15px;
        }
        
        .company-name { 
          font-weight: bold; 
          ${size === '80mm' ? 'font-size: 14px;' : 'font-size: 18px;'}
          margin-bottom: 6px;
          color: #000;
        }
        
        .order-title { 
          font-weight: bold; 
          ${size === '80mm' ? 'font-size: 12px;' : 'font-size: 16px;'}
          margin: 10px 0;
          text-decoration: underline;
        }
        
        .order-number {
          font-weight: bold;
          ${size === '80mm' ? 'font-size: 13px;' : 'font-size: 16px;'}
          margin: 8px 0;
        }
        
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 6px;
          font-weight: bold;
          ${size === '80mm' ? 'font-size: 10px;' : 'font-size: 12px;'}
          background-color: ${status.bgColor};
          color: ${status.color};
          margin: 8px 0;
        }
        
        .order-info { 
          margin: 15px 0; 
          padding: 8px 0;
          border-top: 1px solid #ddd;
          border-bottom: 1px solid #ddd;
        }
        
        .info-row { 
          display: flex; 
          justify-content: space-between; 
          margin: 3px 0;
          ${size === '80mm' ? 'font-size: 10px;' : 'font-size: 12px;'}
        }
        
        .info-label {
          font-weight: bold;
          min-width: 30%;
        }
        
        .customer-section,
        .vehicle-section {
          margin: 12px 0;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }
        
        .section-title {
          font-weight: bold;
          ${size === '80mm' ? 'font-size: 11px;' : 'font-size: 13px;'}
          margin-bottom: 6px;
          color: #555;
          text-transform: uppercase;
        }
        
        .services-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 12px 0;
          ${size === '80mm' ? 'font-size: 9px;' : 'font-size: 11px;'}
        }
        
        .services-table th,
        .services-table td { 
          padding: 4px 2px; 
          text-align: left;
          border-bottom: 1px solid #ddd;
        }
        
        .services-table th { 
          font-weight: bold; 
          border-bottom: 2px solid #000;
          background-color: #f8f9fa;
          ${size === '80mm' ? 'font-size: 9px;' : 'font-size: 10px;'}
        }
        
        .amount { text-align: right; }
        
        .total-section { 
          margin-top: 15px; 
          padding-top: 10px;
          border-top: 2px solid #000;
        }
        
        .total-row { 
          display: flex; 
          justify-content: space-between; 
          margin: 4px 0;
          ${size === '80mm' ? 'font-size: 11px;' : 'font-size: 13px;'}
          font-weight: bold;
        }
        
        .observations {
          margin: 15px 0;
          padding: 8px;
          background-color: #fff9c4;
          border-left: 4px solid #fbc02d;
          border-radius: 4px;
        }
        
        .observations-title {
          font-weight: bold;
          margin-bottom: 4px;
          ${size === '80mm' ? 'font-size: 10px;' : 'font-size: 12px;'}
        }
        
        .footer { 
          text-align: center; 
          margin-top: 20px; 
          padding-top: 15px;
          border-top: 1px solid #ddd;
          ${size === '80mm' ? 'font-size: 9px;' : 'font-size: 11px;'}
          color: #666;
        }
        
        .operational-notice {
          margin-top: 12px;
          text-align: center;
          ${size === '80mm' ? 'font-size: 8px;' : 'font-size: 10px;'}
          color: #888;
          font-style: italic;
        }

        @media screen {
          .print-controls {
            position: fixed;
            top: 10px;
            right: 10px;
            background: white;
            padding: 12px;
            border: 1px solid #ddd;
            border-radius: 6px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 1000;
          }
          
          .print-btn {
            margin-right: 8px; 
            padding: 10px 16px; 
            background: #007bff; 
            color: white; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer;
            font-weight: 500;
          }
          
          .close-btn {
            padding: 10px 16px; 
            background: #6c757d; 
            color: white; 
            border: none; 
            border-radius: 4px; 
            cursor: pointer;
          }
          
          .print-btn:hover { background: #0056b3; }
          .close-btn:hover { background: #545b62; }
        }
      </style>
    `;

    const orderHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Orden de Trabajo ${workOrder.numero}</title>
          ${styles}
        </head>
        <body>
          <div class="print-controls no-print">
            <button onclick="window.print()" class="print-btn">📄 Imprimir</button>
            <button onclick="window.close()" class="close-btn">✕ Cerrar</button>
          </div>

          <div class="order-header">
            <div class="company-name">1SOLUTION - SISTEMA POS</div>
            <div style="font-size: ${size === '80mm' ? '10px' : '12px'}; color: #666;">
              Sistema de Gestión para Lavaderos
            </div>
            
            <div class="order-title">ORDEN DE TRABAJO</div>
            
            <div class="order-number">N° ${escapeHTML(workOrder.numero)}</div>
            
            <div class="status-badge">
              Estado: ${escapeHTML(status.label)}
            </div>
          </div>

          <div class="order-info">
            <div class="info-row">
              <span class="info-label">Fecha de Entrada:</span>
              <span>${escapeHTML(formatDate(workOrder.fechaEntrada))}</span>
            </div>
          </div>

          <div class="customer-section">
            <div class="section-title">👤 Información del Cliente</div>
            <div class="info-row">
              <span class="info-label">Nombre:</span>
              <span>${escapeHTML(customer.nombre)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Documento:</span>
              <span>${escapeHTML(customer.docTipo)} ${escapeHTML(customer.docNumero)}</span>
            </div>
            ${customer.telefono ? `
              <div class="info-row">
                <span class="info-label">Teléfono:</span>
                <span>${escapeHTML(customer.telefono)}</span>
              </div>
            ` : ''}
          </div>

          <div class="vehicle-section">
            <div class="section-title">🚗 Información del Vehículo</div>
            <div class="info-row">
              <span class="info-label">Placa:</span>
              <span style="font-weight: bold;">${escapeHTML(vehicle.placa)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Marca/Modelo:</span>
              <span>${escapeHTML(vehicle.marca)} ${escapeHTML(vehicle.modelo)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Color:</span>
              <span>${escapeHTML(vehicle.color)}</span>
            </div>
            ${vehicle.observaciones ? `
              <div class="info-row">
                <span class="info-label">Observaciones:</span>
                <span>${escapeHTML(vehicle.observaciones)}</span>
              </div>
            ` : ''}
          </div>

          ${orderItems && orderItems.length > 0 ? `
            <div style="margin: 15px 0;">
              <div class="section-title">🛠️ Servicios Realizados</div>
              <table class="services-table">
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th style="text-align: center; width: 15%;">Cant.</th>
                    <th class="amount" style="width: 25%;">Precio Unit.</th>
                    <th class="amount" style="width: 25%;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${orderItems.map((item: any) => `
                    <tr>
                      <td>${escapeHTML(item.name)}</td>
                      <td style="text-align: center;">${escapeHTML(item.quantity)}</td>
                      <td class="amount">${escapeHTML(formatPrice(item.price))}</td>
                      <td class="amount">${escapeHTML(formatPrice(item.total))}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}

          <div class="total-section">
            <div class="total-row">
              <span>TOTAL:</span>
              <span>${escapeHTML(formatPrice(total))}</span>
            </div>
          </div>

          ${workOrder.observaciones ? `
            <div class="observations">
              <div class="observations-title">⚠️ Observaciones:</div>
              <div style="font-size: ${size === '80mm' ? '9px' : '11px'};">
                ${escapeHTML(workOrder.observaciones)}
              </div>
            </div>
          ` : ''}

          <div class="footer">
            <div style="font-weight: bold;">¡Gracias por confiar en nosotros!</div>
            <div style="margin-top: 8px;">
              Copia: Cliente | Original: Archivo
            </div>
          </div>

          <div class="operational-notice">
            Documento operativo - No válido como comprobante fiscal
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(orderHTML);
    printWindow.document.close();
    
    // Auto-focus print window and trigger print dialog
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (!workOrder) {
    return null;
  }

  const status = statusConfig[workOrder.estado as keyof typeof statusConfig];
  const StatusIcon = status?.icon || Clock;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Imprimir Orden de Trabajo #{workOrder.numero}
          </DialogTitle>
          <DialogDescription>
            Generar documento operativo de la orden de trabajo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Loading State */}
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-20 w-full" />
            </div>
          )}
          
          {/* Error State */}
          {isError && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                <div className="text-sm">
                  <div className="font-medium text-red-800 mb-1">Error al cargar orden</div>
                  <div className="text-red-700">
                    No se pudieron obtener los detalles de la orden. Verifique su conexión e intente nuevamente.
                  </div>
                </div>
              </div>
            </div>
          )}
          
          {/* Order Preview Info */}
          {!isLoading && !isError && (
            <div className="bg-muted p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <StatusIcon className="h-4 w-4" />
                  <span className="font-medium">Estado:</span>
                  <Badge variant="secondary">{status?.label || workOrder.estado}</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Fecha:</span>
                  <span>{formatDate(workOrder.fechaEntrada)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Car className="h-4 w-4" />
                  <span className="font-medium">Total:</span>
                  <span className="font-bold">{formatPrice(workOrder.total)}</span>
                </div>
                {workOrderDetails?.customer && (
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">Cliente:</span>
                    <span>{workOrderDetails.customer.nombre}</span>
                  </div>
                )}
              </div>
            </div>
            
            {workOrder.observaciones && (
              <div className="mt-3 p-2 bg-yellow-50 border-l-4 border-yellow-400 rounded">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5" />
                  <div>
                    <div className="text-sm font-medium text-yellow-800">Observaciones:</div>
                    <div className="text-sm text-yellow-700">{workOrder.observaciones}</div>
                  </div>
                </div>
              </div>
            )}
            </div>
          )}

          <Separator />

          {/* Print Options */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Opciones de Impresión</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 80mm Thermal Printer Option */}
              <Card className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <Printer className="h-5 w-5" />
                    <CardTitle className="text-lg">Impresora 80mm</CardTitle>
                  </div>
                  <CardDescription>
                    Impresora térmica de tickets (POS)
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    • Formato compacto<br/>
                    • Ideal para órdenes rápidas<br/>
                    • Papel térmico de 80mm
                  </div>
                  <Button 
                    onClick={() => handlePrint('80mm')} 
                    className="w-full"
                    disabled={isLoading || isError || !workOrderDetails}
                    data-testid="button-print-80mm"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Cargando...
                      </>
                    ) : (
                      <>
                        <Printer className="h-4 w-4 mr-2" />
                        Imprimir 80mm
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* A4 Printer Option */}
              <Card className="border-2">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    <CardTitle className="text-lg">Impresora A4</CardTitle>
                  </div>
                  <CardDescription>
                    Impresora láser o inyección de tinta
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm text-muted-foreground">
                    • Formato estándar<br/>
                    • Mayor detalle y claridad<br/>
                    • Papel A4 tradicional
                  </div>
                  <Button 
                    onClick={() => handlePrint('A4')} 
                    variant="outline" 
                    className="w-full"
                    disabled={isLoading || isError || !workOrderDetails}
                    data-testid="button-print-a4"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Cargando...
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4 mr-2" />
                        Imprimir A4
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="text-sm">
                <div className="font-medium text-blue-800 mb-1">Nota Importante</div>
                <div className="text-blue-700">
                  Este documento es para control operativo interno. No constituye un comprobante fiscal válido.
                  Para facturar al cliente, utilice la función "Facturar" desde la lista de órdenes.
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}