// ============================================================
// MindVault — History Rules Engine
// Evaluates configurable rules to flag history entries as important.
// ============================================================

import type { HistoryEntry, HistoryRule, HistoryRuleOperator } from '@mindvault/shared';
import {
  getHistoryByLibrary,
  markHistoryImportant,
} from '../db/repositories/history';

// ---- Rule evaluation helpers -------------------------------

function compareVisitCount(
  count: number,
  operator: HistoryRuleOperator,
  value: number
): boolean {
  switch (operator) {
    case 'gt':  return count > value;
    case 'gte': return count >= value;
    case 'lt':  return count < value;
    case 'lte': return count <= value;
    case 'eq':  return count === value;
  }
}

function matchesDomainPattern(url: string, pattern: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    // Support glob-style wildcards: *.example.com
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*').replace(/\*/g, '.*');
    const regex = new RegExp('^' + escaped + '$');
    return regex.test(hostname);
  } catch {
    return false;
  }
}

/**
 * Evaluate a single rule against a history entry.
 * Returns true if the entry matches the rule condition.
 */
export function evaluateRule(entry: HistoryEntry, rule: HistoryRule): boolean {
  if (!rule.enabled) return false;

  const { condition } = rule;

  switch (condition.type) {
    case 'visit_count':
      return compareVisitCount(entry.visitCount, condition.operator, condition.value);

    case 'starred':
      return entry.isStarred;

    case 'tagged':
      return entry.tags.includes(condition.tagName);

    case 'domain':
      return matchesDomainPattern(entry.url, condition.pattern);

    case 'date_range':
      return entry.visitTime >= condition.from && entry.visitTime <= condition.to;
  }
}

/**
 * Return true if the entry matches ANY enabled rule.
 */
export function applyRules(entry: HistoryEntry, rules: HistoryRule[]): boolean {
  return rules.some((rule) => evaluateRule(entry, rule));
}

/**
 * Run the rules engine over all history entries in a library.
 * Updates the isImportant flag in IndexedDB for each entry.
 *
 * @returns The number of entries marked as important.
 */
export async function runRulesEngine(
  libraryId: string,
  rules: HistoryRule[]
): Promise<number> {
  if (rules.length === 0) return 0;

  // Fetch with a high limit — rules engine needs full view
  const entries = await getHistoryByLibrary(libraryId, 50000);
  let markedCount = 0;

  for (const entry of entries) {
    const shouldBeImportant = applyRules(entry, rules);
    if (shouldBeImportant !== entry.isImportant) {
      await markHistoryImportant(entry.id, shouldBeImportant);
      if (shouldBeImportant) markedCount++;
    }
  }

  return markedCount;
}