import {
  registerDecorator,
  ValidatorConstraint,
  type ValidationOptions,
  type ValidatorConstraintInterface,
} from 'class-validator';

// Bornes lues à l'exécution : class-validator fige ses décorateurs à la
// compilation, donc @MinLength(env) est impossible. Les mêmes défauts que le
// schéma d'environnement, coercition directe pour rester lisible hors DI.
const bound = (raw: string | undefined, fallback: number): number => {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

export const passwordMinLength = (): number => bound(process.env.PASSWORD_MIN_LENGTH, 8);
export const passwordMaxLength = (): number => bound(process.env.PASSWORD_MAX_LENGTH, 24);

@ValidatorConstraint({ name: 'passwordLength', async: false })
class PasswordLengthConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return (
      typeof value === 'string' &&
      value.length >= passwordMinLength() &&
      value.length <= passwordMaxLength()
    );
  }

  defaultMessage(): string {
    return `Le mot de passe doit faire entre ${passwordMinLength()} et ${passwordMaxLength()} caractères.`;
  }
}

export function IsPasswordLength(options?: ValidationOptions): PropertyDecorator {
  return (object, propertyName) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      ...(options ? { options } : {}),
      validator: PasswordLengthConstraint,
    });
  };
}
