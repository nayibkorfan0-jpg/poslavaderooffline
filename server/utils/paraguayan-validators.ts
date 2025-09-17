/**
 * Paraguayan-specific validation utilities
 * Includes RUC validation with checksum and timbrado date validation
 */

/**
 * Validates Paraguayan RUC format and checksum
 * Format: 80000000-0 (8 digits + dash + 1 check digit)
 * @param ruc The RUC string to validate
 * @returns true if valid, false otherwise
 */
export function validateRUC(ruc: string): boolean {
  if (!ruc || typeof ruc !== 'string') {
    return false;
  }

  // Remove spaces and normalize
  const cleanRUC = ruc.trim();
  
  // Check basic format: 8 digits + dash + 1 digit
  const rucPattern = /^\d{8}-\d$/;
  if (!rucPattern.test(cleanRUC)) {
    return false;
  }

  // Extract base number and check digit
  const [baseNumber, checkDigitStr] = cleanRUC.split('-');
  const checkDigit = parseInt(checkDigitStr);
  
  // Calculate checksum using Paraguayan RUC algorithm
  const multipliers = [2, 3, 4, 5, 6, 7, 2, 3];
  let sum = 0;
  
  for (let i = 0; i < 8; i++) {
    sum += parseInt(baseNumber[i]) * multipliers[i];
  }
  
  const remainder = sum % 11;
  let calculatedCheckDigit;
  
  if (remainder < 2) {
    calculatedCheckDigit = 0;
  } else {
    calculatedCheckDigit = 11 - remainder;
  }
  
  return calculatedCheckDigit === checkDigit;
}

/**
 * Validates timbrado dates and provides detailed feedback
 * @param fechaDesde Start date string (YYYY-MM-DD)
 * @param fechaHasta End date string (YYYY-MM-DD)
 * @returns Validation result with isValid flag and error message
 */
export function validateTimbradoDates(fechaDesde: string, fechaHasta: string): {
  isValid: boolean;
  error?: string;
  warning?: string;
} {
  try {
    const startDate = new Date(fechaDesde);
    const endDate = new Date(fechaHasta);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time for accurate comparison
    
    // Check if dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return {
        isValid: false,
        error: "Las fechas deben ser válidas y estar en formato YYYY-MM-DD"
      };
    }
    
    // Check if end date is after start date
    if (endDate <= startDate) {
      return {
        isValid: false,
        error: "La fecha de vencimiento debe ser posterior a la fecha de inicio"
      };
    }
    
    // Check if start date is not too far in the past (more than 5 years)
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(today.getFullYear() - 5);
    
    if (startDate < fiveYearsAgo) {
      return {
        isValid: false,
        error: "La fecha de inicio no puede ser mayor a 5 años en el pasado"
      };
    }
    
    // Check if timbrado is already expired
    if (endDate < today) {
      return {
        isValid: false,
        error: "El timbrado ya ha vencido. Debe renovarlo antes de continuar."
      };
    }
    
    // Warning if timbrado expires within 30 days
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    
    if (endDate <= thirtyDaysFromNow) {
      return {
        isValid: true,
        warning: "El timbrado vence en menos de 30 días. Se recomienda renovarlo pronto."
      };
    }
    
    return { isValid: true };
    
  } catch (error) {
    return {
      isValid: false,
      error: "Error al procesar las fechas del timbrado"
    };
  }
}

/**
 * Calculates days until timbrado expiration
 * @param fechaHasta End date string (YYYY-MM-DD)
 * @returns Number of days until expiration (negative if expired)
 */
export function getDaysUntilTimbradoExpiration(fechaHasta: string): number {
  try {
    const endDate = new Date(fechaHasta);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const diffTime = endDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return diffDays;
  } catch (error) {
    return -999; // Return large negative number to indicate error/expired
  }
}

/**
 * Gets timbrado status based on expiration date
 * @param fechaHasta End date string (YYYY-MM-DD)
 * @returns Status object with color and message
 */
export function getTimbradoStatus(fechaHasta: string): {
  status: 'expired' | 'warning' | 'valid';
  daysLeft: number;
  message: string;
  color: 'red' | 'orange' | 'green';
} {
  const daysLeft = getDaysUntilTimbradoExpiration(fechaHasta);
  
  if (daysLeft < 0) {
    return {
      status: 'expired',
      daysLeft,
      message: `Timbrado vencido hace ${Math.abs(daysLeft)} días`,
      color: 'red'
    };
  } else if (daysLeft <= 30) {
    return {
      status: 'warning',
      daysLeft,
      message: `Timbrado vence en ${daysLeft} días`,
      color: 'orange'
    };
  } else {
    return {
      status: 'valid',
      daysLeft,
      message: `Timbrado válido por ${daysLeft} días más`,
      color: 'green'
    };
  }
}

/**
 * Validates if timbrado is active and billing operations are allowed
 * This function is used to block billing/invoice operations when timbrado is expired
 * @param companyConfig Company configuration object with timbrado data
 * @returns Validation result for billing operations
 */
export function validateActiveTimbrado(companyConfig: {
  timbradoHasta?: string;
  timbradoNumero?: string;
  establecimiento?: string;
  puntoExpedicion?: string;
} | null): {
  isValid: boolean;
  error?: string;
  blocksInvoicing: boolean;
  daysLeft?: number;
} {
  // Check if company configuration exists
  if (!companyConfig) {
    return {
      isValid: false,
      error: "Configuración de empresa no encontrada. Debe configurar los datos fiscales antes de emitir facturas.",
      blocksInvoicing: true
    };
  }

  // Check if required timbrado fields are present
  if (!companyConfig.timbradoHasta) {
    return {
      isValid: false,
      error: "Fecha de vencimiento de timbrado no configurada. Complete la configuración fiscal.",
      blocksInvoicing: true
    };
  }

  if (!companyConfig.timbradoNumero) {
    return {
      isValid: false,
      error: "Número de timbrado no configurado. Complete la configuración fiscal.",
      blocksInvoicing: true
    };
  }

  if (!companyConfig.establecimiento || !companyConfig.puntoExpedicion) {
    return {
      isValid: false,
      error: "Establecimiento y punto de expedición no configurados. Complete la configuración fiscal.",
      blocksInvoicing: true
    };
  }

  // Check if timbrado is expired
  const daysLeft = getDaysUntilTimbradoExpiration(companyConfig.timbradoHasta);
  
  if (daysLeft < 0) {
    return {
      isValid: false,
      error: `Timbrado vencido hace ${Math.abs(daysLeft)} días. No se pueden emitir facturas con timbrado vencido.`,
      blocksInvoicing: true,
      daysLeft
    };
  }

  // Timbrado is valid - billing allowed
  return {
    isValid: true,
    blocksInvoicing: false,
    daysLeft
  };
}