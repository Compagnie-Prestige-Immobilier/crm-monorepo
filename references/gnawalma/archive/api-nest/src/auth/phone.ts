import { BadRequestException } from '@nestjs/common';

/** Normalizes Senegalese local numbers and already-valid E.164 identifiers. */
export function normalizePhone(phone: string): string {
  const compact = phone.replace(/[^\d+]/g, '');
  const digits = compact.replace(/\D/g, '');
  if (/^\d{9}$/.test(digits)) return `+221${digits}`;
  if (/^221\d{9}$/.test(digits)) return `+${digits}`;
  if (compact.startsWith('+221')) {
    throw new BadRequestException('Invalid Senegalese phone number');
  }
  if (/^\+\d{8,15}$/.test(compact)) return compact;
  throw new BadRequestException('Invalid phone number');
}

/** Keeps server-side PIN policy explicit and independently testable. */
export function assertPin(pin: string): void {
  if (!/^\d{4,8}$/.test(pin)) {
    throw new BadRequestException('PIN must contain 4–8 digits');
  }
}
