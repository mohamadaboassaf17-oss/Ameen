import { estimateStrength } from './password-generator';

const DAY_MS = 1000 * 60 * 60 * 24;
const OLD_THRESHOLD_DAYS = 90;
const WEAK_SCORE_THRESHOLD = 40;

export interface WeakPassword {
  itemId: string;
  itemTitle: string;
  score: number;
  label: string;
  reason: string;
}

export interface DuplicatePassword {
  itemIds: string[];
  itemTitles: string[];
  passwordHash: string;
}

export interface OldPassword {
  itemId: string;
  itemTitle: string;
  ageDays: number;
}

export interface PasswordHealthResult {
  overallScore: number;
  weakPasswords: WeakPassword[];
  duplicatePasswords: DuplicatePassword[];
  oldPasswords: OldPassword[];
  totalPasswordItems: number;
  recommendationCount: number;
}

interface VaultItem {
  id: string;
  type: 'password' | 'note' | 'card';
  title: string;
  revision: number;
  createdAt: number;
  updatedAt: number;
  data: Record<string, string>;
}

function digestToHex(hashBuffer: ArrayBuffer): string {
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getPasswordReason(password: string): string {
  const reasons: string[] = [];

  if (password.length < 8) {
    reasons.push('كلمة المرور قصيرة جداً');
  }

  let charsetCount = 0;
  if (/[A-Z]/.test(password)) charsetCount++;
  if (/[a-z]/.test(password)) charsetCount++;
  if (/[0-9]/.test(password)) charsetCount++;

  let hasSymbol = false;
  for (const ch of '!@#$%^&*()_+-=[]{}|;:,.<>?/`~') {
    if (password.includes(ch)) {
      hasSymbol = true;
      break;
    }
  }
  if (hasSymbol) charsetCount++;

  if (charsetCount <= 1) {
    reasons.push('تستخدم أنواع أحرف محدودة جداً');
  } else if (charsetCount <= 2 && reasons.length === 0) {
    reasons.push('تستخدم أنواع أحرف محدودة');
  }

  if (reasons.length === 0) {
    reasons.push('كلمة المرور غير معقدة بما يكفي');
  }

  return reasons.join(' و');
}

/**
 * Hash a password string using SHA-256 for safe comparison or storage.
 *
 * Accepts a plaintext password and returns its SHA-256 hex digest.
 * The original password is never stored or included in the output —
 * only the one-way hash is returned. This is used internally by
 * {@link scanPasswordHealth} and is also exported so that other
 * modules (e.g. breach-reporting) can compute matching hashes without
 * ever touching plaintext credentials.
 *
 * @param password - The plaintext password to hash.
 * @returns The SHA-256 hex digest of the password.
 */
export async function hashPasswordForComparison(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(password));
  return digestToHex(hashBuffer);
}

/**
 * Scan the vault for weak, duplicate, and stale passwords.
 *
 * Runs entirely locally — no outbound network requests are ever made.
 * Only items whose `type` is `'password'` are examined. The function:
 *
 * 1. Evaluates each password with {@link estimateStrength} and flags
 *    any scoring below {@link WEAK_SCORE_THRESHOLD} (40) as weak,
 *    attaching a human-readable Arabic reason.
 * 2. Groups passwords by plaintext to detect reuse; each reuse group
 *    is hashed with SHA-256 so the report contains only the hash,
 *    **never** the underlying password.
 * 3. Flags passwords whose `updatedAt` timestamp is older than
 *    {@link OLD_THRESHOLD_DAYS} days. Items missing `updatedAt`
 *    default to `Date.now()` and are therefore not flagged.
 * 4. Computes a composite `overallScore` on a 0–100 scale by
 *    deducting points for each issue category (capped per category).
 *
 * An empty vault or one with no password items returns a perfect
 * score with empty result arrays.
 *
 * @param items - The raw vault items to analyse.
 * @returns A health report with scores, issues, and recommendations count.
 */
export async function scanPasswordHealth(
  items: VaultItem[]
): Promise<PasswordHealthResult> {
  const passwordItems = items.filter(
    (item) => item.type === 'password' && item.data?.password
  );

  if (passwordItems.length === 0) {
    return {
      overallScore: 100,
      weakPasswords: [],
      duplicatePasswords: [],
      oldPasswords: [],
      totalPasswordItems: 0,
      recommendationCount: 0,
    };
  }

  const now = Date.now();

  // ---- Weak passwords --------------------------------------------------
  const weakPasswords: WeakPassword[] = [];
  for (const item of passwordItems) {
    const result = estimateStrength(item.data.password);
    if (result.score < WEAK_SCORE_THRESHOLD) {
      weakPasswords.push({
        itemId: item.id,
        itemTitle: item.title,
        score: result.score,
        label: result.label,
        reason: getPasswordReason(item.data.password),
      });
    }
  }

  // ---- Duplicate passwords ----------------------------------------------
  const byPassword = new Map<string, VaultItem[]>();
  for (const item of passwordItems) {
    const existing = byPassword.get(item.data.password);
    if (existing) {
      existing.push(item);
    } else {
      byPassword.set(item.data.password, [item]);
    }
  }

  const duplicatePasswords: DuplicatePassword[] = [];
  for (const [, group] of byPassword) {
    if (group.length >= 2) {
      const passwordHash = await hashPasswordForComparison(group[0].data.password);
      duplicatePasswords.push({
        itemIds: group.map((i) => i.id),
        itemTitles: group.map((i) => i.title),
        passwordHash,
      });
    }
  }

  // ---- Old passwords ----------------------------------------------------
  const oldPasswords: OldPassword[] = [];
  for (const item of passwordItems) {
    const updatedAt = typeof item.updatedAt === 'number' ? item.updatedAt : now;
    const ageMs = now - updatedAt;
    const ageDays = Math.floor(ageMs / DAY_MS);
    if (ageDays > OLD_THRESHOLD_DAYS) {
      oldPasswords.push({
        itemId: item.id,
        itemTitle: item.title,
        ageDays,
      });
    }
  }

  // ---- Overall score ----------------------------------------------------
  const weakDeduction = Math.min(weakPasswords.length * 15, 40);
  const dupDeduction = Math.min(duplicatePasswords.length * 10, 30);
  const oldDeduction = Math.min(oldPasswords.length * 5, 30);
  const overallScore = Math.max(
    0,
    Math.min(100, 100 - weakDeduction - dupDeduction - oldDeduction)
  );

  const recommendationCount =
    weakPasswords.length + duplicatePasswords.length + oldPasswords.length;

  return {
    overallScore,
    weakPasswords,
    duplicatePasswords,
    oldPasswords,
    totalPasswordItems: passwordItems.length,
    recommendationCount,
  };
}

/**
 * Generate human-readable Arabic recommendations from a health report.
 *
 * Each issue category produces a distinct recommendation. When no issues
 * are present a congratulatory message is returned instead.
 *
 * @param result - The health report returned by {@link scanPasswordHealth}.
 * @returns An array of Arabic recommendation strings.
 */
export function generateHealthRecommendations(
  result: PasswordHealthResult
): string[] {
  const recommendations: string[] = [];

  if (result.weakPasswords.length > 0) {
    recommendations.push('تغيير كلمات المرور الضعيفة');
  }
  if (result.duplicatePasswords.length > 0) {
    recommendations.push('استخدام كلمات مرور فريدة لكل حساب');
  }
  if (result.oldPasswords.length > 0) {
    recommendations.push('تحديث كلمات المرور القديمة');
  }

  if (recommendations.length === 0) {
    recommendations.push('خزنتك في حالة ممتازة!');
  }

  return recommendations;
}
