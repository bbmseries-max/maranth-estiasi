// src/app/core/models/common.model.ts

export type UnitOfMeasure = 'KG' | 'LITER' | 'PCS' | 'PACK';
export type Role = 'MANAGER' | 'WAITER' | 'KITCHEN' | 'BAR' | 'ADMIN' | 'BARISTA';
export type EmployeeRole = Role;
export type GreekVatRate = 13 | 24 | 0;

export function stripGreekAccents(str: string): string {
  if (!str) return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}