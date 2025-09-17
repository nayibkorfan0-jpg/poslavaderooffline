import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { X, AlertTriangle, Calendar, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { type CompanyConfig } from "@shared/schema";

export function TimbradoAlert() {
  const [dismissed, setDismissed] = useState(false);
  const [, setLocation] = useLocation();

  // Fetch company configuration
  const { data: config, isLoading } = useQuery<CompanyConfig | null>({
    queryKey: ['/api/company-config'],
  });

  // Fetch timbrado status from backend API (more reliable)
  const { data: timbradoStatusApi, isLoading: isLoadingStatus } = useQuery<{
    isValid: boolean;
    blocksInvoicing: boolean;
    daysLeft?: number;
    error?: string;
  }>({
    queryKey: ['/api/timbrado/status'],
  });

  // Calculate timbrado status using backend response
  const getTimbradoStatus = () => {
    if (!config || !timbradoStatusApi) {
      return {
        status: 'missing' as const,
        daysLeft: 0,
        message: 'Configuración de timbrado faltante'
      };
    }

    if (!timbradoStatusApi.isValid) {
      return {
        status: 'expired' as const,
        daysLeft: timbradoStatusApi.daysLeft || -1,
        message: timbradoStatusApi.error || 'Timbrado vencido'
      };
    } else if (timbradoStatusApi.daysLeft !== undefined && timbradoStatusApi.daysLeft <= 30) {
      return {
        status: 'warning' as const,
        daysLeft: timbradoStatusApi.daysLeft,
        message: `Timbrado vence en ${timbradoStatusApi.daysLeft} días`
      };
    } else {
      return {
        status: 'valid' as const,
        daysLeft: timbradoStatusApi.daysLeft || 0,
        message: `Timbrado válido por ${timbradoStatusApi.daysLeft || 0} días más`
      };
    }
  };

  const timbradoStatus = getTimbradoStatus();

  // Don't show alert if dismissed, loading, or timbrado is valid (more than 30 days)
  if (dismissed || isLoading || isLoadingStatus || timbradoStatus.status === 'valid') return null;

  // Determine alert styling based on status
  const getAlertClasses = () => {
    switch (timbradoStatus.status) {
      case 'expired':
        return "border-l-4 border-l-red-500 bg-red-50 dark:bg-red-950/20";
      case 'warning':
        return "border-l-4 border-l-orange-500 bg-orange-50 dark:bg-orange-950/20";
      case 'missing':
        return "border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20";
      default:
        return "border-l-4 border-l-gray-500 bg-gray-50 dark:bg-gray-950/20";
    }
  };

  const getIconAndBadge = () => {
    switch (timbradoStatus.status) {
      case 'expired':
        return {
          icon: <AlertTriangle className="h-4 w-4 text-red-600" />,
          badge: <Badge variant="destructive" className="text-xs">CRÍTICO</Badge>,
          iconColor: 'text-red-600'
        };
      case 'warning':
        return {
          icon: <Calendar className="h-4 w-4 text-orange-600" />,
          badge: <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">ADVERTENCIA</Badge>,
          iconColor: 'text-orange-600'
        };
      case 'missing':
        return {
          icon: <AlertTriangle className="h-4 w-4 text-yellow-600" />,
          badge: <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">CONFIGURACIÓN</Badge>,
          iconColor: 'text-yellow-600'
        };
      default:
        return {
          icon: <CheckCircle className="h-4 w-4 text-green-600" />,
          badge: <Badge variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">VÁLIDO</Badge>,
          iconColor: 'text-green-600'
        };
    }
  };

  const { icon, badge, iconColor } = getIconAndBadge();

  const getMessage = () => {
    switch (timbradoStatus.status) {
      case 'expired':
        return "🚨 CRÍTICO: El timbrado ha VENCIDO. No se pueden emitir más facturas.";
      case 'warning':
        return "⚠️ ADVERTENCIA: El timbrado vencerá pronto.";
      case 'missing':
        return "⚙️ CONFIGURACIÓN: Es necesario configurar los datos del timbrado.";
      default:
        return "✅ El timbrado está vigente.";
    }
  };

  return (
    <Alert className={`${getAlertClasses()} mb-6`} data-testid="alert-timbrado">
      {icon}
      <AlertDescription className="flex items-center justify-between w-full">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            {badge}
            <h3 className="font-semibold text-foreground">Control de Timbrado DGII</h3>
          </div>
          <p className={`text-sm mb-2 ${
            timbradoStatus.status === 'expired' ? 'text-red-800 dark:text-red-200' :
            timbradoStatus.status === 'warning' ? 'text-orange-800 dark:text-orange-200' :
            timbradoStatus.status === 'missing' ? 'text-yellow-800 dark:text-yellow-200' :
            'text-foreground'
          }`}>
            {getMessage()}
          </p>
          
          {config && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm mb-3">
              <div>
                <span className="font-medium">Timbrado:</span> {config.timbradoNumero || 'No configurado'}
              </div>
              <div>
                <span className="font-medium">Establecimiento:</span> {config.establecimiento}-{config.puntoExpedicion}
              </div>
              <div>
                <span className="font-medium">Vencimiento:</span> {config.timbradoHasta || 'No configurado'}
              </div>
            </div>
          )}
          
          <div className="flex gap-2">
            <Button 
              size="sm" 
              className=""
              data-testid="button-timbrado-config"
              onClick={() => setLocation('/configuracion')}
            >
              {timbradoStatus.status === 'missing' ? 'Configurar Timbrado' : 'Ir a Configuración'}
            </Button>
            
            {timbradoStatus.status === 'expired' && (
              <Button 
                size="sm" 
                variant="outline"
                disabled
                data-testid="button-facturas-disabled"
              >
                Facturación Bloqueada
              </Button>
            )}
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="icon"
          onClick={() => setDismissed(true)}
          data-testid="button-dismiss-alert"
          className="ml-4"
        >
          <X className="h-4 w-4" />
        </Button>
      </AlertDescription>
    </Alert>
  );
}