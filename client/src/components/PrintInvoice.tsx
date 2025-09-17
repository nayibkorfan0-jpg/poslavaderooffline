import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Printer, 
  Download, 
  FileText,
  Building,
  User,
  Calendar,
  Receipt,
  DollarSign
} from "lucide-react";
import type { Sale, Customer, CompanyConfig } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

interface PrintInvoiceProps {
  isOpen: boolean;
  onClose: () => void;
  sale: Sale | null;
  customer: Customer | null;
  saleItems?: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
    type: 'service' | 'product';
  }>;
}

// Format price for Paraguay (Guaraní)
const formatPrice = (price: number | string) => {
  const numPrice = typeof price === 'string' ? parseInt(price) : price;
  return `Gs. ${numPrice.toLocaleString('es-PY')}`;
};

// Format date for Paraguay
const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('es-PY', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

// Convert numbers to words (Spanish) for legal compliance
const numberToWords = (num: number): string => {
  const ones = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
  const teens = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const tens = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const thousands = ['', 'MIL', 'MILLÓN', 'MIL MILLONES'];

  if (num === 0) return 'CERO';
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  if (num < 100) {
    const ten = Math.floor(num / 10);
    const one = num % 10;
    return tens[ten] + (one ? ' Y ' + ones[one] : '');
  }
  if (num < 1000) {
    const hundred = Math.floor(num / 100);
    const rest = num % 100;
    const hundredWord = hundred === 1 ? 'CIENTO' : ones[hundred] + 'CIENTOS';
    return hundredWord + (rest ? ' ' + numberToWords(rest) : '');
  }
  if (num < 1000000) {
    const thousand = Math.floor(num / 1000);
    const rest = num % 1000;
    const thousandWord = thousand === 1 ? 'MIL' : numberToWords(thousand) + ' MIL';
    return thousandWord + (rest ? ' ' + numberToWords(rest) : '');
  }
  
  return 'MONTO EXCESIVO';
};

export default function PrintInvoice({ isOpen, onClose, sale, customer, saleItems = [] }: PrintInvoiceProps) {
  // Fetch company configuration for invoice header
  const { data: companyConfig } = useQuery({
    queryKey: ['/api/company-config'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/company-config');
      if (!response.ok) throw new Error('Failed to fetch company config');
      return response;
    },
    enabled: isOpen && !!sale,
  });

  const handlePrint = (size: '80mm' | 'A4') => {
    if (!sale || !customer || !companyConfig) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const subtotal = parseInt(sale.subtotal);
    const tax = parseInt(sale.impuestos);
    const total = parseInt(sale.total);
    const totalInWords = numberToWords(total) + ' GUARANÍES';

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
            font-family: 'Courier New', monospace;
            ${size === '80mm' ? 'font-size: 10px;' : 'font-size: 12px;'}
            line-height: 1.2;
          }
          .no-print { display: none !important; }
        }
        
        body { 
          font-family: 'Courier New', monospace;
          margin: 0;
          padding: ${size === '80mm' ? '5mm' : '15mm'};
          ${size === '80mm' ? 'font-size: 10px;' : 'font-size: 12px;'}
          line-height: 1.2;
          max-width: ${size === '80mm' ? '70mm' : '190mm'};
        }
        
        .invoice-header { 
          text-align: center; 
          border-bottom: 1px solid #000; 
          padding-bottom: 8px; 
          margin-bottom: 10px;
        }
        
        .company-name { 
          font-weight: bold; 
          ${size === '80mm' ? 'font-size: 12px;' : 'font-size: 16px;'}
          margin-bottom: 4px;
        }
        
        .company-details { 
          ${size === '80mm' ? 'font-size: 8px;' : 'font-size: 10px;'}
          margin-bottom: 2px;
        }
        
        .invoice-title { 
          font-weight: bold; 
          ${size === '80mm' ? 'font-size: 11px;' : 'font-size: 14px;'}
          margin: 8px 0;
          text-decoration: underline;
        }
        
        .fiscal-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          margin: 8px 0;
          ${size === '80mm' ? 'font-size: 8px;' : 'font-size: 10px;'}
        }
        
        .customer-info { 
          margin: 10px 0; 
          padding: 5px 0;
          border-top: 1px solid #000;
          border-bottom: 1px solid #000;
        }
        
        .info-row { 
          display: flex; 
          justify-content: space-between; 
          margin: 2px 0;
          ${size === '80mm' ? 'font-size: 9px;' : 'font-size: 11px;'}
        }
        
        .items-table { 
          width: 100%; 
          border-collapse: collapse; 
          margin: 10px 0;
          ${size === '80mm' ? 'font-size: 8px;' : 'font-size: 10px;'}
        }
        
        .items-table th,
        .items-table td { 
          padding: 2px; 
          text-align: left;
          border-bottom: 1px solid #ccc;
        }
        
        .items-table th { 
          font-weight: bold; 
          border-bottom: 1px solid #000;
        }
        
        .amount { text-align: right; }
        
        .totals { 
          margin-top: 10px; 
          padding-top: 8px;
          border-top: 1px solid #000;
        }
        
        .total-row { 
          display: flex; 
          justify-content: space-between; 
          margin: 2px 0;
          ${size === '80mm' ? 'font-size: 9px;' : 'font-size: 11px;'}
        }
        
        .total-final { 
          font-weight: bold; 
          ${size === '80mm' ? 'font-size: 11px;' : 'font-size: 13px;'}
          border-top: 1px solid #000;
          padding-top: 4px;
          margin-top: 4px;
        }
        
        .total-words {
          margin: 8px 0;
          padding: 4px;
          border: 1px solid #000;
          text-align: center;
          font-weight: bold;
          ${size === '80mm' ? 'font-size: 8px;' : 'font-size: 10px;'}
        }
        
        .footer { 
          text-align: center; 
          margin-top: 15px; 
          padding-top: 10px;
          border-top: 1px solid #000;
          ${size === '80mm' ? 'font-size: 8px;' : 'font-size: 10px;'}
        }
        
        .payment-info {
          margin: 8px 0;
          text-align: center;
          font-weight: bold;
        }
        
        .legal-notice {
          margin-top: 10px;
          text-align: center;
          ${size === '80mm' ? 'font-size: 7px;' : 'font-size: 9px;'}
          color: #666;
        }

        @media screen {
          .print-controls {
            position: fixed;
            top: 10px;
            right: 10px;
            background: white;
            padding: 10px;
            border: 1px solid #ccc;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          }
        }
      </style>
    `;

    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>Factura ${sale.numeroFactura}</title>
          ${styles}
        </head>
        <body>
          <div class="print-controls no-print">
            <button onclick="window.print()" style="margin-right: 10px; padding: 8px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer;">Imprimir</button>
            <button onclick="window.close()" style="padding: 8px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer;">Cerrar</button>
          </div>

          <div class="invoice-header">
            <div class="company-name">${companyConfig.nombreFantasia || companyConfig.razonSocial}</div>
            <div class="company-details">${companyConfig.razonSocial}</div>
            <div class="company-details">RUC: ${companyConfig.ruc}</div>
            <div class="company-details">${companyConfig.direccion}</div>
            <div class="company-details">${companyConfig.ciudad}</div>
            ${companyConfig.telefono ? `<div class="company-details">Tel: ${companyConfig.telefono}</div>` : ''}
            
            <div class="invoice-title">FACTURA</div>
            
            <div class="fiscal-info">
              <div>Timbrado N°: ${companyConfig.timbradoNumero}</div>
              <div>Válido hasta: ${new Date(companyConfig.timbradoHasta).toLocaleDateString('es-PY')}</div>
              <div>Establecimiento: ${companyConfig.establecimiento}</div>
              <div>Punto Expedición: ${companyConfig.puntoExpedicion}</div>
            </div>
            
            <div style="font-weight: bold; margin: 8px 0;">
              N° ${sale.numeroFactura}
            </div>
          </div>

          <div class="customer-info">
            <div class="info-row">
              <span>Fecha:</span>
              <span>${formatDate(typeof sale.fecha === 'string' ? sale.fecha : sale.fecha?.toISOString?.())}</span>
            </div>
            <div class="info-row">
              <span>Cliente:</span>
              <span>${customer.nombre}</span>
            </div>
            <div class="info-row">
              <span>Documento:</span>
              <span>${customer.docNumero}</span>
            </div>
            ${customer.regimenTurismo ? `
              <div class="info-row">
                <span>Condición:</span>
                <span>RÉGIMEN DE TURISMO</span>
              </div>
            ` : ''}
            ${sale.workOrderId ? `
              <div class="info-row">
                <span>Orden de Trabajo:</span>
                <span>#${sale.workOrderId}</span>
              </div>
            ` : ''}
          </div>

          <table class="items-table">
            <thead>
              <tr>
                <th>Descripción</th>
                <th style="text-align: center;">Cant.</th>
                <th class="amount">P. Unit.</th>
                <th class="amount">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${saleItems.map(item => `
                <tr>
                  <td>${item.name}</td>
                  <td style="text-align: center;">${item.quantity}</td>
                  <td class="amount">${formatPrice(item.price)}</td>
                  <td class="amount">${formatPrice(item.total)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <div class="total-row">
              <span>Subtotal:</span>
              <span>${formatPrice(subtotal)}</span>
            </div>
            
            ${customer.regimenTurismo ? `
              <div class="total-row">
                <span>IVA (Exento - Turismo):</span>
                <span>Gs. 0</span>
              </div>
            ` : `
              <div class="total-row">
                <span>IVA (10%):</span>
                <span>${formatPrice(tax)}</span>
              </div>
            `}
            
            <div class="total-row total-final">
              <span>TOTAL:</span>
              <span>${formatPrice(total)}</span>
            </div>
          </div>

          <div class="total-words">
            Son: ${totalInWords}
          </div>

          <div class="payment-info">
            Forma de Pago: ${getPaymentMethodName(sale.medioPago)}
          </div>

          <div class="footer">
            <div>¡Gracias por su preferencia!</div>
            <div style="margin-top: 8px;">
              Original: Cliente | Duplicado: Archivo
            </div>
          </div>

          <div class="legal-notice">
            Ley 125/91 que establece el nuevo régimen tributario.<br/>
            Decreto 12084 que reglamenta la Ley 125/91.
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
    
    // Auto-focus print window and trigger print dialog
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  const getPaymentMethodName = (method: string) => {
    const methods: Record<string, string> = {
      efectivo: "Efectivo",
      tarjeta: "Tarjeta de Crédito/Débito",
      transferencia: "Transferencia Bancaria",
      cuenta: "Cuenta Corriente"
    };
    return methods[method] || method;
  };

  const handleDownloadPDF = () => {
    // For a production environment, you would implement PDF generation here
    // using libraries like jsPDF or by calling a backend service
    alert("Función de descarga PDF no implementada. Use la función de impresión del navegador.");
  };

  if (!sale || !customer) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Imprimir Factura {sale.numeroFactura}
          </DialogTitle>
          <DialogDescription>
            Seleccione el tipo de impresión según su impresora
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Invoice Preview Info */}
          <div className="bg-muted p-4 rounded-lg">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span className="font-medium">Cliente:</span>
                  <span>{customer.nombre}</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="font-medium">Documento:</span>
                  <span>{customer.docNumero}</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">Fecha:</span>
                  <span>{formatDate(typeof sale.fecha === 'string' ? sale.fecha : sale.fecha?.toISOString?.())}</span>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  <span className="font-medium">Total:</span>
                  <span className="font-bold">{formatPrice(sale.total)}</span>
                </div>
              </div>
            </div>
            
            {customer.regimenTurismo && (
              <div className="mt-2">
                <Badge variant="secondary">
                  Régimen de Turismo - Exento de IVA
                </Badge>
              </div>
            )}
          </div>

          <Separator />

          {/* Print Options */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Opciones de Impresión</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 80mm Thermal Printer Option */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Printer className="h-5 w-5" />
                  <h4 className="font-medium">Impresora Térmica (80mm)</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Para impresoras de tickets térmicas estándar de punto de venta
                </p>
                <Button 
                  onClick={() => handlePrint('80mm')}
                  className="w-full"
                  data-testid="button-print-80mm"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  Imprimir Ticket
                </Button>
              </div>

              {/* A4 Printer Option */}
              <div className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  <h4 className="font-medium">Impresora A4</h4>
                </div>
                <p className="text-sm text-muted-foreground">
                  Para impresoras láser o de inyección de tinta formato carta
                </p>
                <Button 
                  onClick={() => handlePrint('A4')}
                  variant="outline"
                  className="w-full"
                  data-testid="button-print-a4"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Imprimir A4
                </Button>
              </div>
            </div>

            {/* Additional Options */}
            <div className="flex gap-2 pt-4 border-t">
              <Button 
                onClick={handleDownloadPDF}
                variant="outline" 
                size="sm"
                data-testid="button-download-pdf"
              >
                <Download className="h-4 w-4 mr-2" />
                Descargar PDF
              </Button>
              
              <div className="ml-auto">
                <Button variant="ghost" onClick={onClose}>
                  Cerrar
                </Button>
              </div>
            </div>
          </div>

          {/* Legal Notice */}
          <div className="text-xs text-muted-foreground bg-muted p-3 rounded">
            <p className="font-medium mb-1">Cumplimiento Fiscal Paraguay:</p>
            <p>Esta factura cumple con los requisitos del Decreto 12084 que reglamenta la Ley 125/91 del régimen tributario paraguayo.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}