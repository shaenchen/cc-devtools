/**
 * Integration tests for Review storage layer
 * Tests against real file system to validate review storage and retrieval
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import {
  addReview,
  getReview,
  getRoundReviewers,
  getAllReviewsForStory,
} from '../../../src/kanban/services/review-storage.js';

describe('Review Storage (Integration)', () => {
  const originalCwd = process.cwd();
  let testDir: string;
  let reviewsDir: string;

  beforeEach(() => {
    testDir = join(originalCwd, 'test-tmp-' + Date.now() + '-' + Math.random().toString(36).substring(7));
    reviewsDir = join(testDir, 'cc-devtools');
    mkdirSync(reviewsDir, { recursive: true });

    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });

  describe('addReview', () => {
    it('should add a review successfully', async () => {
      const review = await addReview('MVP-001', 1, 'claude', 'This looks good!');

      expect(review.storyId).toBe('MVP-001');
      expect(review.round).toBe(1);
      expect(review.reviewer).toBe('claude');
      expect(review.review).toBe('This looks good!');
      expect(review.timestamp).toBeDefined();
    });

    it('should add multiple reviews', async () => {
      await addReview('MVP-001', 1, 'claude', 'Review 1');
      await addReview('MVP-001', 1, 'codex', 'Review 2');
      await addReview('MVP-002', 1, 'claude', 'Review 3');

      const allReviews = await getAllReviewsForStory('MVP-001');
      expect(allReviews.length).toBe(2);
    });

    it('should create reviews.yaml if it does not exist', async () => {
      const review = await addReview('MVP-001', 1, 'claude', 'Test review');

      expect(review).toBeDefined();
      const reviewsFile = join(reviewsDir, 'reviews.yaml');
      expect(existsSync(reviewsFile)).toBe(true);
    });

    it('should handle concurrent writes with file locking', async () => {
      await Promise.all([
        addReview('MVP-001', 1, 'claude', 'Review 1'),
        addReview('MVP-001', 1, 'codex', 'Review 2'),
        addReview('MVP-001', 2, 'claude', 'Review 3'),
      ]);

      const allReviews = await getAllReviewsForStory('MVP-001');
      expect(allReviews.length).toBe(3);
    });
  });

  describe('getReview', () => {
    beforeEach(async () => {
      await addReview('MVP-001', 1, 'claude', 'Review 1');
      await addReview('MVP-001', 1, 'codex', 'Review 2');
      await addReview('MVP-001', 2, 'claude', 'Review 3');
    });

    it('should retrieve a specific review', async () => {
      const review = await getReview('MVP-001', 1, 'claude');

      expect(review).not.toBeNull();
      expect(review?.storyId).toBe('MVP-001');
      expect(review?.round).toBe(1);
      expect(review?.reviewer).toBe('claude');
      expect(review?.review).toBe('Review 1');
    });

    it('should return null for non-existent review', async () => {
      const review = await getReview('MVP-999', 1, 'claude');
      expect(review).toBeNull();
    });

    it('should return null for non-existent reviewer in existing round', async () => {
      const review = await getReview('MVP-001', 1, 'nonexistent');
      expect(review).toBeNull();
    });

    it('should return null for non-existent round', async () => {
      const review = await getReview('MVP-001', 999, 'claude');
      expect(review).toBeNull();
    });
  });

  describe('getRoundReviewers', () => {
    beforeEach(async () => {
      await addReview('MVP-001', 1, 'claude', 'Review 1');
      await addReview('MVP-001', 1, 'codex', 'Review 2');
      await addReview('MVP-001', 2, 'claude', 'Review 3');
      await addReview('MVP-001', 2, 'codex', 'Review 4');
      await addReview('MVP-001', 2, 'qwen', 'Review 5');
    });

    it('should return reviewers grouped by round', async () => {
      const result = await getRoundReviewers('MVP-001');

      expect(result.storyId).toBe('MVP-001');
      expect(result.rounds.length).toBe(2);

      expect(result.rounds[0].round).toBe(1);
      expect(result.rounds[0].reviewers).toEqual(['claude', 'codex']);

      expect(result.rounds[1].round).toBe(2);
      expect(result.rounds[1].reviewers).toEqual(['claude', 'codex', 'qwen']);
    });

    it('should return empty rounds for story with no reviews', async () => {
      const result = await getRoundReviewers('MVP-999');

      expect(result.storyId).toBe('MVP-999');
      expect(result.rounds.length).toBe(0);
    });

    it('should handle single round with multiple reviewers', async () => {
      await addReview('MVP-002', 1, 'claude', 'Review 1');
      await addReview('MVP-002', 1, 'codex', 'Review 2');
      await addReview('MVP-002', 1, 'qwen', 'Review 3');

      const result = await getRoundReviewers('MVP-002');

      expect(result.rounds.length).toBe(1);
      expect(result.rounds[0].reviewers.length).toBe(3);
    });
  });

  describe('getAllReviewsForStory', () => {
    it('should return all reviews for a story', async () => {
      await addReview('MVP-001', 1, 'claude', 'Review 1');
      await addReview('MVP-001', 1, 'codex', 'Review 2');
      await addReview('MVP-001', 2, 'claude', 'Review 3');
      await addReview('MVP-002', 1, 'claude', 'Review 4');

      const reviews = await getAllReviewsForStory('MVP-001');

      expect(reviews.length).toBe(3);
      expect(reviews.every(r => r.storyId === 'MVP-001')).toBe(true);
    });

    it('should return empty array for story with no reviews', async () => {
      const reviews = await getAllReviewsForStory('MVP-999');
      expect(reviews.length).toBe(0);
    });

    it('should not include reviews from other stories', async () => {
      await addReview('MVP-001', 1, 'claude', 'Review 1');
      await addReview('MVP-001', 1, 'codex', 'Review 2');
      await addReview('MVP-001', 2, 'claude', 'Review 3');
      await addReview('MVP-002', 1, 'claude', 'Review 4');

      const reviews = await getAllReviewsForStory('MVP-001');

      expect(reviews.every(r => r.storyId === 'MVP-001')).toBe(true);
      expect(reviews.find(r => r.storyId === 'MVP-002')).toBeUndefined();
    });
  });
});
