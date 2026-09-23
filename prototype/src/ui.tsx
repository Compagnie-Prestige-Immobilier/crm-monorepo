import { Check, ChevronDown, X } from 'lucide-react';
import type { ReactNode } from 'react';
import {
  Button as AriaButton,
  type ButtonProps,
  Dialog,
  FieldError,
  Heading,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Meter,
  Modal,
  ModalOverlay,
  NumberField,
  Popover,
  Select,
  SelectValue,
  TextArea,
  TextField,
} from 'react-aria-components';

import type { Classe } from './bant';
import type { Option } from './fields';

const VARIANTS = {
  primary: 'bg-brand text-white shadow-sm shadow-brand/20 data-[hovered]:bg-brand-hover',
  secondary:
    'border border-line bg-paper text-ink data-[hovered]:border-brand/30 data-[hovered]:bg-brand-soft/50',
  ghost: 'text-muted data-[hovered]:bg-brand-soft/70 data-[hovered]:text-brand',
  whatsapp: 'bg-[#15803d] text-white data-[hovered]:bg-[#166534]',
};
export type Variant = keyof typeof VARIANTS;

export const buttonClass = (variant: Variant = 'secondary') =>
  `focus-ring inline-flex min-h-11 cursor-pointer select-none items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-semibold transition data-[pressed]:scale-[0.97] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 ${VARIANTS[variant]}`;

export function Button({
  variant,
  className = '',
  ...props
}: Omit<ButtonProps, 'className'> & { variant?: Variant; className?: string }) {
  return <AriaButton {...props} className={`${buttonClass(variant)} ${className}`} />;
}

type FieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  isRequired?: boolean;
  isInvalid?: boolean;
  className?: string;
};

function FieldLabel({ label, isRequired }: { label: string; isRequired?: boolean | undefined }) {
  return (
    <Label className="text-[13px] font-semibold text-muted">
      {label}
      {isRequired && (
        <span className="ml-0.5 text-ko" aria-hidden>
          *
        </span>
      )}
    </Label>
  );
}
const errorClass = 'text-xs font-medium text-ko';
const fieldClass = 'group flex flex-col gap-1.5';

const CLEAR = '__clear';
export function SelectField({
  label,
  value,
  onChange,
  options,
  isRequired,
  isInvalid,
  className = '',
}: FieldProps & { options: readonly Option[] }) {
  return (
    <Select
      className={`${fieldClass} ${className}`}
      value={value || null}
      onChange={(key) => onChange(key === null || key === CLEAR ? '' : String(key))}
      isInvalid={isInvalid ?? false}
      placeholder="Sélectionner…"
    >
      <FieldLabel label={label} isRequired={isRequired} />
      <AriaButton className="field-box flex cursor-pointer items-center justify-between gap-2 text-left">
        <SelectValue className="truncate data-[placeholder]:text-muted/60" />
        <ChevronDown size={16} className="shrink-0 text-muted" aria-hidden />
      </AriaButton>
      <FieldError className={errorClass}>Champ obligatoire</FieldError>
      <Popover className="w-(--trigger-width) min-w-60 rounded-xl border border-line bg-paper p-1 shadow-xl shadow-ink/10">
        <ListBox className="max-h-72 overflow-auto outline-none">
          {value ? <MenuOption id={CLEAR} label="Effacer la sélection" muted /> : null}
          {options.map(([key, text]) => (
            <MenuOption key={key} id={key} label={text} />
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}

function MenuOption({ id, label, muted }: { id: string; label: string; muted?: boolean }) {
  return (
    <ListBoxItem
      id={id}
      textValue={label}
      className={`flex min-h-10 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm outline-none data-[focused]:bg-brand-soft data-[selected]:font-semibold data-[selected]:text-brand ${muted ? 'italic text-muted' : ''}`}
    >
      {({ isSelected }) => (
        <>
          {label}
          {isSelected && <Check size={16} aria-hidden />}
        </>
      )}
    </ListBoxItem>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  isRequired,
  isInvalid,
  className = '',
  type = 'text',
  placeholder,
  multiline,
}: FieldProps & { type?: string; placeholder?: string | undefined; multiline?: boolean }) {
  return (
    <TextField
      className={`${fieldClass} ${className}`}
      value={value}
      onChange={onChange}
      isInvalid={isInvalid ?? false}
      type={type}
    >
      <FieldLabel label={label} isRequired={isRequired} />
      {multiline ? (
        <TextArea className="field-box min-h-24 py-2.5" placeholder={placeholder ?? ''} />
      ) : (
        <Input className="field-box" placeholder={placeholder ?? ''} />
      )}
      <FieldError className={errorClass}>Champ obligatoire</FieldError>
    </TextField>
  );
}

export function NumberInput({
  label,
  value,
  onChange,
  isRequired,
  isInvalid,
  className = '',
}: FieldProps) {
  return (
    <NumberField
      className={`${fieldClass} ${className}`}
      value={value === '' ? NaN : Number(value)}
      onChange={(n) => onChange(Number.isNaN(n) ? '' : String(n))}
      minValue={0}
      formatOptions={{ maximumFractionDigits: 2 }}
      isInvalid={isInvalid ?? false}
    >
      <FieldLabel label={label} isRequired={isRequired} />
      <Input className="field-box tabular-nums" />
      <FieldError className={errorClass}>Champ obligatoire</FieldError>
    </NumberField>
  );
}

export function Sheet({
  isOpen,
  onOpenChange,
  title,
  children,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <ModalOverlay
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      isDismissable
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-[2px] sm:items-center sm:p-6"
    >
      <Modal className="flex max-h-[92dvh] w-full flex-col rounded-t-3xl bg-paper shadow-2xl sm:max-w-2xl sm:rounded-3xl">
        <Dialog className="flex min-h-0 flex-col outline-none">
          <header className="flex items-center justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <Heading slot="title" className="font-display text-xl font-bold">
              {title}
            </Heading>
            <Button variant="ghost" slot="close" aria-label="Fermer" className="size-11 !px-0">
              <X size={20} />
            </Button>
          </header>
          <div className="min-h-0 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}

const STAMP: Record<Classe, string> = {
  A: 'border-brand text-brand bg-brand-soft',
  B: 'border-gold text-gold-text bg-gold-soft',
  C: 'border-muted/60 text-muted bg-canvas',
  D: 'border-dashed border-line-strong/60 text-line-strong bg-paper',
};
export function ClassStamp({ classe, size = 'md' }: { classe: Classe; size?: 'sm' | 'md' | 'lg' }) {
  const dims = {
    sm: 'size-9 text-lg rounded-md',
    md: 'size-12 text-2xl rounded-lg',
    lg: 'size-20 text-5xl rounded-xl',
  }[size];
  return (
    <span
      aria-label={`Classe ${classe}`}
      className={`inline-grid shrink-0 -rotate-6 place-items-center border-2 font-display font-extrabold leading-none outline outline-1 -outline-offset-[5px] outline-current/25 ${dims} ${STAMP[classe]}`}
    >
      {classe}
    </span>
  );
}

export function Bar({
  label,
  value,
  max,
  tone = 'bg-brand',
}: {
  label: string;
  value: number;
  max: number;
  tone?: string;
}) {
  return (
    <Meter
      value={value}
      maxValue={max}
      aria-label={label}
      className="grid grid-cols-[6.5rem_1fr_3.5rem] items-center gap-3 text-sm"
    >
      {({ percentage }) => (
        <>
          <span className="text-muted">{label}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-line">
            <span
              className={`block h-full rounded-full transition-[width] duration-500 ${tone}`}
              style={{ width: `${percentage}%` }}
            />
          </span>
          <span className="text-right font-semibold tabular-nums">
            {Math.round(value)}
            <span className="text-muted/70 font-normal">/{max}</span>
          </span>
        </>
      )}
    </Meter>
  );
}

export function Card({
  title,
  aside,
  children,
  className = '',
}: {
  title?: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-line bg-paper p-4 sm:p-5 ${className}`}>
      {title && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-display text-base font-semibold">{title}</h3>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
