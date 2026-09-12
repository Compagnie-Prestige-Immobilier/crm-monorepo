import { formatPhone } from '@/lib/format';

export function LienTelephone({ phoneE164 }: { phoneE164: string | null }) {
  if (phoneE164 === null || phoneE164 === '') return formatPhone(phoneE164);
  return (
    <a
      href={`tel:${phoneE164}`}
      className="inline-flex min-h-6 items-center rounded-sm tabular-nums underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      onClick={(event) => {
        event.stopPropagation();
      }}
    >
      {formatPhone(phoneE164)}
    </a>
  );
}
