import { BadRequestException } from '@nestjs/common';
import { assertPin, normalizePhone } from '../src/auth/phone';

describe('authentication input contract', () => {
  it.each([
    ['77 123 45 67', '+221771234567'],
    ['+221 77 123 45 67', '+221771234567'],
    ['221771234567', '+221771234567'],
    ['+33612345678', '+33612345678'],
  ])('normalizes %s to E.164', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each(['77123456', '+22177123456', 'hello', ''])('rejects an invalid phone: %s', (input) => {
    expect(() => normalizePhone(input)).toThrow(BadRequestException);
  });

  it.each(['1234', '12345678'])('accepts an allowed PIN length', (pin) => {
    expect(() => assertPin(pin)).not.toThrow();
  });

  it.each(['123', '123456789', '12a4', ''])('rejects an unsafe PIN: %s', (pin) => {
    expect(() => assertPin(pin)).toThrow(BadRequestException);
  });
});
