import { describe, expect, it } from 'vitest';

import {
  orderSuggestions,
  suggestionCountsByPhone,
  type Suggestion,
  type SuggestionStatus,
} from '@/lib/data/suggestions';

const suggestion = (
  id: string,
  status: SuggestionStatus,
  clientCreatedAt: string,
  suggestedPhoneE164 = `+22177000${id.padStart(4, '0')}`,
): Suggestion => ({
  id,
  sourceRepresentantId: 'rep-1',
  sourceRepresentantShortCode: 'A1B2C3',
  suggestedName: null,
  suggestedPhoneE164,
  note: null,
  status,
  suggestedById: 'u-1',
  suggestedByName: 'Aminata Diallo',
  resolvedRepresentantId: null,
  clientCreatedAt,
  createdAt: clientCreatedAt,
});

describe('orderSuggestions', () => {
  it('remonte les « à appeler » avant tout ce qui est déjà tranché', () => {
    const ordered = orderSuggestions([
      suggestion('1', 'APPELE', '2026-05-04T09:00:00.000Z'),
      suggestion('2', 'ABANDONNE', '2026-05-05T09:00:00.000Z'),
      suggestion('3', 'A_APPELER', '2026-05-01T09:00:00.000Z'),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(['3', '1', '2']);
  });

  it('classe les ex æquo du plus récemment recueilli au plus ancien', () => {
    const ordered = orderSuggestions([
      suggestion('1', 'A_APPELER', '2026-05-01T09:00:00.000Z'),
      suggestion('2', 'A_APPELER', '2026-05-03T09:00:00.000Z'),
      suggestion('3', 'A_APPELER', '2026-05-02T09:00:00.000Z'),
    ]);

    expect(ordered.map((item) => item.id)).toEqual(['2', '3', '1']);
  });

  it('ne remanie pas le tableau reçu', () => {
    const items = [
      suggestion('1', 'APPELE', '2026-05-04T09:00:00.000Z'),
      suggestion('2', 'A_APPELER', '2026-05-01T09:00:00.000Z'),
    ];
    orderSuggestions(items);

    expect(items.map((item) => item.id)).toEqual(['1', '2']);
  });
});

describe('suggestionCountsByPhone', () => {
  it('compte les rappels du même numéro par deux représentants différents', () => {
    const counts = suggestionCountsByPhone([
      suggestion('1', 'A_APPELER', '2026-05-01T09:00:00.000Z', '+221771111111'),
      suggestion('2', 'A_APPELER', '2026-05-02T09:00:00.000Z', '+221771111111'),
      suggestion('3', 'A_APPELER', '2026-05-03T09:00:00.000Z', '+221772222222'),
    ]);

    expect(counts.get('+221771111111')).toBe(2);
    expect(counts.get('+221772222222')).toBe(1);
  });
});
