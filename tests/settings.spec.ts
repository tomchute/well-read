import { describe, expect, it } from 'vitest';
import {
  generateExportFilename,
  mapImportResultMessage,
  validateKindleEmail,
} from '../src/views/settings';

describe('generateExportFilename', () => {
  it('generates a dated filename', () => {
    const date = new Date('2026-09-13');
    const filename = generateExportFilename(date);
    expect(filename).toBe('well-read-export-2026-09-13.json');
  });

  it('pads month and day with zeros', () => {
    const date = new Date('2026-01-05');
    const filename = generateExportFilename(date);
    expect(filename).toBe('well-read-export-2026-01-05.json');
  });

  it('uses current date when none provided', () => {
    const filename = generateExportFilename();
    expect(filename).toMatch(/^well-read-export-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

describe('validateKindleEmail', () => {
  it('returns null for empty string', () => {
    expect(validateKindleEmail('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(validateKindleEmail('   ')).toBeNull();
  });

  it('returns null for a valid email', () => {
    expect(validateKindleEmail('user@kindle.com')).toBeNull();
    expect(validateKindleEmail('user+kindle@free.kindle.com')).toBeNull();
    expect(validateKindleEmail('user@send.kindle.com')).toBeNull();
  });

  it('returns an error for missing @ symbol', () => {
    const error = validateKindleEmail('userkindlecom');
    expect(error).toBe('Must include an @ symbol');
  });

  it('returns an error for missing local part', () => {
    const error = validateKindleEmail('@kindle.com');
    expect(error).toBe('Invalid email format');
  });

  it('returns an error for missing domain part', () => {
    const error = validateKindleEmail('user@');
    expect(error).toBe('Invalid email format');
  });

  it('returns an error for domain without dot', () => {
    const error = validateKindleEmail('user@kinky');
    expect(error).toBe('Domain must include a dot (e.g., @kindle.com)');
  });
});

describe('mapImportResultMessage', () => {
  it('returns success message for ok: true', () => {
    const message = mapImportResultMessage({ ok: true });
    expect(message).toBe('Settings imported successfully.');
  });

  it('maps Invalid JSON error', () => {
    const message = mapImportResultMessage({ ok: false, error: 'Invalid JSON' });
    expect(message).toContain('not valid JSON');
  });

  it('maps version mismatch error', () => {
    const message = mapImportResultMessage({ ok: false, error: 'version mismatch' });
    expect(message).toContain('newer version');
  });

  it('returns the error message for unknown errors', () => {
    const message = mapImportResultMessage({ ok: false, error: 'Something went wrong' });
    expect(message).toBe('Something went wrong');
  });

  it('handles missing error message gracefully', () => {
    const message = mapImportResultMessage({ ok: false });
    expect(message).toContain('Import failed');
  });
});
