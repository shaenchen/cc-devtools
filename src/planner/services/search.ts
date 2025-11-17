/**
 * Hybrid keyword + semantic search for plans
 */


import { generateEmbedding, generatePlanEmbedding } from '../core/embeddings.js';
import { readEmbeddings, saveEmbeddings } from '../core/storage.js';
import type { Plan, PlanWithScore } from '../types.js';

import { hybridSearch as performHybridSearch, lazyRegenerateEmbeddings } from '../../shared/hybrid-search.js';

import type { EmbeddingCache, KeywordScore } from '../../shared/types/search.js';

/**
 * Plan-specific keyword scoring function
 */
function scorePlanKeywords(query: string, plan: Plan): KeywordScore {
  const reasons: string[] = [];
  let score = 0;

  // Check ID for exact match
  if (plan.id.toLowerCase() === query) {
    score += 1.0;
    reasons.push('ID match');
  }

  // Check summary
  if (plan.summary.toLowerCase().includes(query)) {
    score += 0.7;
    reasons.push('summary match');
  }

  // Check goal
  if (plan.goal.toLowerCase().includes(query)) {
    score += 0.7;
    reasons.push('goal match');
  }

  // Check decisions
  if (plan.decisions.toLowerCase().includes(query)) {
    score += 0.5;
    reasons.push('decisions match');
  }

  return { score, reasons };
}

/**
 * Safe wrapper for saving embeddings (non-critical operation)
 */
function safeSaveEmbeddings(embeddings: EmbeddingCache): void {
  try {
    saveEmbeddings(embeddings);
  } catch (_error) {
    // Embedding save failure is non-critical - continue operation
  }
}

/**
 * Filter plans by status
 */
export function filterByStatus(plans: Plan[], includeAll: boolean): Plan[] {
  if (includeAll) {
    return plans;
  }

  return plans.filter(p => p.status === 'planning' || p.status === 'in_progress' || p.status === 'on_hold');
}

/**
 * Hybrid search with keyword and semantic matching
 */
export async function hybridSearch(
  query: string,
  plans: Plan[],
  limit: number = 1,
  includeAllStatuses: boolean = false
): Promise<PlanWithScore[]> {
  const filteredPlans = filterByStatus(plans, includeAllStatuses);

  if (filteredPlans.length === 0) {
    return [];
  }

  // Return most recent plans for empty query
  if (!query || query.trim() === '') {
    const sorted = [...filteredPlans].sort((a, b) => b.updated_at - a.updated_at);
    return sorted.slice(0, limit).map(plan => ({
      ...plan,
      score: 1.0,
      match_reason: 'most recent'
    }));
  }

  // Ensure all plans have embeddings
  let embeddings = readEmbeddings();
  embeddings = await lazyRegenerateEmbeddings(
    filteredPlans,
    embeddings,
    generatePlanEmbedding,
    safeSaveEmbeddings
  );

  // Perform hybrid search
  const results = await performHybridSearch({
    query,
    items: filteredPlans,
    embeddings,
    keywordScoreFn: scorePlanKeywords,
    generateEmbedding
  });

  // Convert to PlanWithScore format
  return results.slice(0, limit).map(({ item, score, reasons }) => {
    let matchReason = '';

    // Determine match reason based on which types of matches were found
    const hasKeyword = reasons.some(r => !r.startsWith('semantic'));
    const hasSemantic = reasons.some(r => r.startsWith('semantic'));

    if (hasKeyword && hasSemantic) {
      matchReason = 'keyword match + semantic similarity';
    } else if (hasKeyword) {
      matchReason = 'keyword match';
    } else {
      matchReason = 'semantic similarity';
    }

    return {
      ...item,
      score,
      match_reason: matchReason
    };
  });
}
