function normalizeUnit(unit) {
  return String(unit ?? '').trim().toLowerCase();
}

function normalizeQuantity(quantity) {
  return String(quantity ?? '').trim();
}

function cleanReceiptItem(item) {
  return {
    name: String(item.name ?? '').trim(),
    quantity: normalizeQuantity(item.quantity),
    unit: normalizeUnit(item.unit),
  };
}

describe('pantry item formatting helpers', () => {
  test('normalizeUnit trims whitespace and lowercases units', () => {
    expect(normalizeUnit('  CUPS  ')).toBe('cups');
    expect(normalizeUnit(' TbSp ')).toBe('tbsp');
  });

  test('normalizeQuantity trims whitespace but preserves the original value text', () => {
    expect(normalizeQuantity('  2.5  ')).toBe('2.5');
    expect(normalizeQuantity('  1/2  ')).toBe('1/2');
  });

  test('cleanReceiptItem normalizes receipt item fields before saving', () => {
    const item = {
      name: '  Strawberries  ',
      quantity: '  1  ',
      unit: ' LB ',
    };

    expect(cleanReceiptItem(item)).toEqual({
      name: 'Strawberries',
      quantity: '1',
      unit: 'lb',
    });
  });

  test('cleanReceiptItem safely handles missing values', () => {
    expect(cleanReceiptItem({})).toEqual({
      name: '',
      quantity: '',
      unit: '',
    });
  });
});
