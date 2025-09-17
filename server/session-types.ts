// Session type declarations for enhanced user management

import { type User } from "@shared/schema";
import { type Request } from "express";
import { type Session, type SessionData } from "express-session";

declare module 'express-session' {
  export interface SessionData {
    user?: {
      id: string;
      username: string;
      fullName?: string;
      email?: string;
      role: string;
      subscriptionType: string;
      monthlyInvoiceLimit: number;
      currentMonthInvoices: number;
      isActive: boolean;
      isBlocked: boolean;
      expirationDate?: Date;
    };
    loginAttempts?: number;
    lastLoginAttempt?: Date;
  }
}

export interface AuthenticatedRequest extends Request {
  session: Session & Partial<SessionData> & {
    user?: {
      id: string;
      username: string;
      fullName?: string;
      email?: string;
      role: string;
      subscriptionType: string;
      monthlyInvoiceLimit: number;
      currentMonthInvoices: number;
      isActive: boolean;
      isBlocked: boolean;
      expirationDate?: Date;
    };
  };
}

// Helper types for user session management
export interface SessionUser {
  id: string;
  username: string;
  fullName?: string;
  email?: string;
  role: string;
  subscriptionType: string;
  monthlyInvoiceLimit: number;
  currentMonthInvoices: number;
  isActive: boolean;
  isBlocked: boolean;
  expirationDate?: Date;
}

// Utility function to create session user from database user
export function createSessionUser(user: User): SessionUser {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName || undefined,
    email: user.email || undefined,
    role: user.role,
    subscriptionType: user.subscriptionType,
    monthlyInvoiceLimit: user.monthlyInvoiceLimit,
    currentMonthInvoices: user.currentMonthInvoices,
    isActive: user.isActive,
    isBlocked: user.isBlocked,
    expirationDate: user.expirationDate ? new Date(user.expirationDate) : undefined,
  };
}

// Authentication status check functions
export function isAuthenticated(req: AuthenticatedRequest): boolean {
  return !!(req.session && req.session.user && req.session.user.isActive && !req.session.user.isBlocked);
}

export function hasRole(req: AuthenticatedRequest, role: string): boolean {
  return isAuthenticated(req) && req.session.user!.role === role;
}

export function hasAnyRole(req: AuthenticatedRequest, roles: string[]): boolean {
  return isAuthenticated(req) && roles.includes(req.session.user!.role);
}

export function canCreateInvoices(req: AuthenticatedRequest): boolean {
  if (!isAuthenticated(req)) return false;
  
  const user = req.session.user!;
  
  // Check if user is blocked or inactive
  if (user.isBlocked || !user.isActive) return false;
  
  // Check if account is expired
  if (user.expirationDate && user.expirationDate < new Date()) return false;
  
  // Check if user has reached monthly invoice limit
  if (user.currentMonthInvoices >= user.monthlyInvoiceLimit) return false;
  
  return true;
}