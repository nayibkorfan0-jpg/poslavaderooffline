import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount).replace('PYG', 'Gs.');
}

export function formatDateTime(date: Date): string {
  return new Intl.DateTimeFormat('es-PY', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Validates Paraguayan RUC format and checksum
 * Format: 80000000-0 (8 digits + dash + 1 check digit)
 * This function matches the backend validation algorithm
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

// ROBUST date formatter - handles all edge cases that were causing crashes
export function formatDate(dateString?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!dateString || dateString.trim() === '') return "-";
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "-";
    
    return date.toLocaleDateString('es-PY', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      ...options
    });
  } catch (error) {
    console.warn('Error formatting date:', dateString, error);
    return "-";
  }
}

// Format date with time  
export function formatDateTimeRobust(dateString?: string | null): string {
  return formatDate(dateString, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
