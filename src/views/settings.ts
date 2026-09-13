/** Helper functions for Settings.svelte. */

/** Generate a dated filename for JSON export (e.g., "well-read-export-2026-09-13.json"). */
export function generateExportFilename(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `well-read-export-${year}-${month}-${day}.json`;
}

/** Validate a Kindle email address. Returns null if valid, or an error message. */
export function validateKindleEmail(email: string): string | null {
  if (!email) return null; // Empty is valid (optional field)
  const trimmed = email.trim();
  if (!trimmed) return null;

  // Basic email validation: must contain @ and a domain
  // Kindle allows: username+kindle@free.kindle.com or username@kindle.com or @send.kindle.com addresses
  if (!trimmed.includes('@')) return 'Must include an @ symbol';
  const [local, domain] = trimmed.split('@');
  if (!local || !domain) return 'Invalid email format';
  if (!domain.includes('.')) return 'Domain must include a dot (e.g., @kindle.com)';
  return null;
}

/** Map an import result (ok/error) to a user-facing message. */
export function mapImportResultMessage(result: { ok: boolean; error?: string }): string {
  if (result.ok) return 'Settings imported successfully.';
  if (result.error?.includes('Invalid JSON'))
    return 'The file is not valid JSON. Check the file and try again.';
  if (result.error?.includes('version'))
    return 'This export was created by a newer version of well-read. Please update the app.';
  return result.error || 'Import failed. Check the file format and try again.';
}
