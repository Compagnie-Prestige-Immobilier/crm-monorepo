import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import {
  InternationalPhoneField,
  fromE164,
  toInternationalE164,
} from '@/components/forms/international-phone-field';

function Champ({ indicatif = '221' }: { indicatif?: string }) {
  const [value, setValue] = useState('');
  const [callingCode, setCallingCode] = useState(indicatif);
  return (
    <InternationalPhoneField
      value={value}
      callingCode={callingCode}
      onChange={setValue}
      onCallingCodeChange={setCallingCode}
    />
  );
}

const saisie = (): HTMLInputElement => screen.getByLabelText<HTMLInputElement>(/Téléphone/u);

describe('le masque au fil de la frappe', () => {
  it('groupe le numéro selon le pays de l’indicatif', async () => {
    const user = userEvent.setup();
    render(<Champ />);

    await user.type(saisie(), '771234567');

    expect(saisie().value).toBe('77 123 45 67');
  });

  it('suit l’indicatif choisi', async () => {
    const user = userEvent.setup();
    render(<Champ indicatif="39" />);

    await user.type(saisie(), '3331234567');

    expect(saisie().value).toBe('333 123 4567');
  });

  it('laisse le retour arrière effacer', async () => {
    const user = userEvent.setup();
    render(<Champ />);

    await user.type(saisie(), '771234567');
    await user.type(saisie(), '{Backspace}{Backspace}');

    expect(saisie().value).toBe('77 123 45 ');
  });
});

describe('toInternationalE164', () => {
  it('accepte un numéro étranger valide', () => {
    expect(toInternationalE164('333 123 4567', '39')).toBe('+393331234567');
  });

  it('garde le numéro sénégalais tel qu’il était', () => {
    expect(toInternationalE164('77 123 45 67', '221')).toBe('+221771234567');
    expect(toInternationalE164('+221 77 123 45 67', '221')).toBe('+221771234567');
  });

  it('refuse un numéro tronqué', () => {
    expect(toInternationalE164('77 123', '221')).toBeNull();
    expect(toInternationalE164('333 12', '39')).toBeNull();
    expect(toInternationalE164('', '221')).toBeNull();
    expect(toInternationalE164('appelle-moi', '221')).toBeNull();
  });
});

describe('fromE164', () => {
  it('sépare l’indicatif du national, prêt à réécrire', () => {
    expect(fromE164('+393331234567')).toEqual({ phone: '333 123 4567', callingCode: '39' });
    expect(fromE164('+221771234567')).toEqual({ phone: '77 123 45 67', callingCode: '221' });
  });

  it('rend la saisie intacte quand le numéro est illisible', () => {
    expect(fromE164('12')).toEqual({ phone: '12', callingCode: '221' });
  });
});
