import type { VaultItem } from './vault-format';

/**
 * Supported CSV source formats for import.
 */
export type CsvFormat = 'chrome' | 'firefox' | 'edge' | 'safari' | 'ameen' | 'unknown';

/**
 * Detected format metadata.
 */
export interface DetectedCsv {
    format: CsvFormat;
    headerColumns: string[];
}

/**
 * Column name sets for each known browser CSV export.
 * Headers are case-folded to lowercase for matching.
 */
const FORMAT_SIGNATURES: Record<string, CsvFormat> = {
    // Chrome CSV: name, url, username, password
    'name_url_username_password': 'chrome',
    // Firefox CSV: url, username, password, httpRealm, formActionOrigin, guid, timeCreated, timePasswordChanged
    'url_username_password_httprealm_formactionorigin_guid_timecreated_timepasswordchanged': 'firefox',
    // Edge CSV: name, url, username, password (same columns as Chrome)
    'name_url_username_password_note': 'edge',
    // Safari CSV: Title, URL, Username, Password, OTPAuth
    'title_url_username_password_otpauth': 'safari',
    // Ameen CSV: id, type, title, username, password, url, content, cardholder, number, expiry, cvv, notes, otpSecret
    'id_type_title_username_password_url_content_cardholder_number_expiry_cvv_notes_otpsecret': 'ameen',
};

/**
 * Split a single CSV line into fields, respecting quoted strings and
 * handling commas inside quoted values.
 */
function splitCsvLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (inQuotes) {
            if (ch === '"') {
                if (i + 1 < line.length && line[i + 1] === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                current += ch;
            }
        } else {
            if (ch === '"') {
                inQuotes = true;
            } else if (ch === ',') {
                fields.push(current.trim());
                current = '';
            } else {
                current += ch;
            }
        }
    }
    fields.push(current.trim());
    return fields;
}

/**
 * Detect the CSV format from the header row.
 *
 * @param headerLine — The first line of the CSV file.
 * @returns A DetectedCsv with the format and parsed column names.
 */
export function detectCsvFormat(headerLine: string): DetectedCsv {
    const columns = splitCsvLine(headerLine);
    const normalized = columns.map((c) =>
        c.toLowerCase().replace(/[^a-z0-9]/g, '_')
    );

    // Build signature key from normalized column names
    const signatureKey = normalized.join('_');
    let format: CsvFormat = FORMAT_SIGNATURES[signatureKey] ?? 'unknown';

    // Chrome and Edge share the same 4-column header — use column ordering to distinguish
    if (format === 'chrome' && columns.length >= 5) {
        format = 'edge';
    }

    return { format, headerColumns: columns };
}

/**
 * Parse a full CSV text into VaultItem array.
 *
 * Auto-detects the format from the first line, then maps each row
 * to a VaultItem using the appropriate column mapping.
 *
 * The generated items receive auto-generated IDs and revision 1.
 *
 * @param csvText — The complete CSV file content.
 * @returns Array of VaultItem objects. Unknown format returns empty array.
 */
export function parseCsvToVaultItems(csvText: string): VaultItem[] {
    try {
        const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
        if (lines.length < 2) return [];

        const { format, headerColumns } = detectCsvFormat(lines[0]);
        if (format === 'unknown') return [];

        const items: VaultItem[] = [];
        const now = Date.now();

        for (let i = 1; i < lines.length; i++) {
            const fields = splitCsvLine(lines[i]);
            if (fields.length === 0) continue;

            const item = mapRowToVaultItem(fields, headerColumns, format, now);
            if (item) {
                items.push(item);
            }
        }

        return items;
    } catch (error) {
        throw new Error(
            `CSV parsing failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
    }
}

/**
 * Map a single CSV row to a VaultItem based on the detected format.
 */
function mapRowToVaultItem(
    fields: string[],
    headers: string[],
    format: CsvFormat,
    now: number
): VaultItem | null {
    const get = (name: string): string => {
        const idx = headers.findIndex(
            (h) => h.toLowerCase().replace(/[^a-z0-9]/g, '_') === name.toLowerCase().replace(/[^a-z0-9]/g, '_')
        );
        return idx >= 0 && idx < fields.length ? fields[idx] : '';
    };

    let title = '';
    let username = '';
    let password = '';
    let url = '';
    let notes = '';
    let otpSecret = '';

    switch (format) {
        case 'chrome':
            title = get('name');
            url = get('url');
            username = get('username');
            password = get('password');
            break;
        case 'edge':
            title = get('name');
            url = get('url');
            username = get('username');
            password = get('password');
            notes = get('note');
            break;
        case 'firefox':
            title = get('url') || get('username');
            url = get('url');
            username = get('username');
            password = get('password');
            break;
        case 'safari':
            title = get('title');
            url = get('url');
            username = get('username');
            password = get('password');
            otpSecret = get('otpauth');
            break;
        case 'ameen':
            title = get('title');
            username = get('username');
            password = get('password');
            url = get('url');
            notes = get('notes');
            otpSecret = get('otpSecret');
            // For Ameen format we also preserve type, content, card fields
            break;
        default:
            return null;
    }

    if (!title && !username && !password && !url) return null;

    return {
        id: crypto.randomUUID(),
        type: 'password',
        title: title || url || 'مستورد',
        revision: 1,
        createdAt: now,
        updatedAt: now,
        data: {
            username,
            password,
            url,
            notes,
            ...(otpSecret ? { otpSecret } : {}),
        },
    };
}

/**
 * Export vault items to Ameen CSV format.
 *
 * Produces a CSV with all Ameen vault fields that can be re-imported
 * or opened in spreadsheet applications.
 *
 * @param items — The vault items to export.
 * @returns CSV text with header row.
 */
export function vaultItemsToAmeenCsv(items: VaultItem[]): string {
    const headers = [
        'id', 'type', 'title', 'username', 'password', 'url',
        'content', 'cardholder', 'number', 'expiry', 'cvv',
        'notes', 'otpSecret',
    ];

    const escapeField = (value: string): string => {
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
            return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
    };

    const rows = items.map((item) => {
        return [
            item.id,
            item.type,
            item.title,
            item.data?.username ?? '',
            item.data?.password ?? '',
            item.data?.url ?? '',
            item.data?.content ?? '',
            item.data?.cardholder ?? '',
            item.data?.number ?? '',
            item.data?.expiry ?? '',
            item.data?.cvv ?? '',
            item.data?.notes ?? '',
            item.data?.otpSecret ?? '',
        ].map(escapeField).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
}
