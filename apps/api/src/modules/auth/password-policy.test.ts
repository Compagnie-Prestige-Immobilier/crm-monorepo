import { validateSync } from 'class-validator';
import { describe, expect, it } from 'vitest';

import { IsPasswordLength } from './password-policy.js';

class Sample {
  @IsPasswordLength()
  password!: string;
}

const accepts = (password: string): boolean => {
  const sample = new Sample();
  sample.password = password;
  return validateSync(sample).length === 0;
};

describe('IsPasswordLength', () => {
  it('accepte les bornes 8 et 24, refuse 7 et 25', () => {
    expect(accepts('a'.repeat(8))).toBe(true);
    expect(accepts('a'.repeat(24))).toBe(true);
    expect(accepts('a'.repeat(7))).toBe(false);
    expect(accepts('a'.repeat(25))).toBe(false);
  });

  it('nomme les bornes effectives dans le message', () => {
    const sample = new Sample();
    sample.password = 'court';
    const [error] = validateSync(sample);
    expect(Object.values(error?.constraints ?? {})[0]).toContain('entre 8 et 24');
  });
});
