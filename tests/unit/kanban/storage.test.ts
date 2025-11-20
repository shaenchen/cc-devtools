/**
 * Integration tests for Kanban storage layer
 * Tests against real file system to validate path migration and YAML serialization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import {
  readKanban,
  writeKanban,
  readConfig,
  updateConfig,
  readAllStories,
  readStory,
  saveStory,
  deleteStory,
  parseId,
  getDefaultConfig,
  generateNextStoryId,
} from '../../../src/kanban/services/storage.js';
import type { Story, KanbanData, StoryStatus } from '../../../src/kanban/core/types.js';

describe('Kanban Storage (Integration)', () => {
  const originalCwd = process.cwd();
  let testDir: string;
  let kanbanDir: string;

  beforeEach(() => {
    testDir = join(originalCwd, 'test-tmp-' + Date.now() + '-' + Math.random().toString(36).substring(7));
    kanbanDir = join(testDir, 'cc-devtools');
    mkdirSync(kanbanDir, { recursive: true });

    // Change process.cwd() to test directory
    process.chdir(testDir);
  });

  afterEach(() => {
    process.chdir(originalCwd);
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  });

  describe('readKanban', () => {
    it('should return default structure when file does not exist', () => {
      const data = readKanban();

      expect(data).toHaveProperty('config');
      expect(data).toHaveProperty('stories');
      expect(Array.isArray(data.stories)).toBe(true);
      expect(data.stories.length).toBe(0);
      expect(data.config).toHaveProperty('statuses');
      expect(data.config).toHaveProperty('workflow_rules');
    });

    it('should read existing kanban.yaml file', () => {
      const mockData: KanbanData = {
        config: getDefaultConfig(),
        stories: [
          {
            id: 'MVP-001',
            title: 'Test Story',
            status: 'todo',
            phase: 'MVP',
          },
        ],
      };

      writeKanban(mockData);
      const data = readKanban();

      expect(data.stories.length).toBe(1);
      expect(data.stories[0].id).toBe('MVP-001');
      expect(data.stories[0].title).toBe('Test Story');
    });

    it('should handle missing config by adding default', () => {
      const kanbanFile = join(kanbanDir, 'kanban.yaml');
      writeFileSync(kanbanFile, 'stories: []', 'utf-8');

      const data = readKanban();

      expect(data.config).toBeDefined();
      expect(data.config).toHaveProperty('workflow_rules');
    });

    it('should handle missing stories array', () => {
      const kanbanFile = join(kanbanDir, 'kanban.yaml');
      const config = getDefaultConfig();
      writeFileSync(kanbanFile, `config: ${JSON.stringify(config)}`, 'utf-8');

      const data = readKanban();

      expect(data.stories).toBeDefined();
      expect(Array.isArray(data.stories)).toBe(true);
      expect(data.stories.length).toBe(0);
    });

    it('should throw error on invalid YAML', () => {
      const kanbanFile = join(kanbanDir, 'kanban.yaml');
      writeFileSync(kanbanFile, 'invalid: yaml: content: [[[', 'utf-8');

      expect(() => readKanban()).toThrow();
    });
  });

  describe('writeKanban', () => {
    it('should create kanban.yaml with valid YAML format', () => {
      const data: KanbanData = {
        config: getDefaultConfig(),
        stories: [
          {
            id: 'MVP-001',
            title: 'Test Story',
            status: 'todo',
            phase: 'MVP',
          },
        ],
      };

      writeKanban(data);

      const kanbanFile = join(kanbanDir, 'kanban.yaml');
      expect(existsSync(kanbanFile)).toBe(true);

      const readData = readKanban();
      expect(readData.stories.length).toBe(1);
      expect(readData.stories[0].id).toBe('MVP-001');
    });

    it('should preserve all story fields', () => {
      const story: Story = {
        id: 'MVP-001',
        title: 'Complex Story',
        status: 'in_progress',
        phase: 'MVP',
        business_value: 'L',
        effort_estimation_hours: 8,
        labels: ['backend', 'api'],
        description: 'Detailed description',
        implementation_notes: 'Implementation details',
        dependent_upon: ['MVP-000'],
        subtasks: [
          {
            id: 'MVP-001-1',
            title: 'Subtask 1',
            status: 'done',
            completion_timestamp: '2025-01-01T00:00:00Z',
          },
        ],
      };

      const data: KanbanData = {
        config: getDefaultConfig(),
        stories: [story],
      };

      writeKanban(data);
      const readData = readKanban();

      expect(readData.stories[0]).toEqual(story);
    });
  });

  describe('readConfig', () => {
    it('should read configuration from file', async () => {
      const config = await readConfig();

      expect(config).toHaveProperty('statuses');
      expect(config.statuses.story).toContain('todo');
      expect(config.statuses.story).toContain('in_progress');
      expect(config.statuses.story).toContain('in_review');
      expect(config.statuses.story).toContain('done');
    });

    it('should return default config when file does not exist', async () => {
      const config = await readConfig();
      const defaultConfig = getDefaultConfig();

      expect(config.workflow_rules.max_stories_in_progress).toBe(
        defaultConfig.workflow_rules.max_stories_in_progress
      );
    });
  });

  describe('updateConfig', () => {
    it('should update config and persist changes', async () => {
      await updateConfig({
        workflow_rules: {
          max_stories_in_progress: 3,
          subtasks_require_story_in_progress: false,
          all_subtasks_completed_before_review: false,
        },
      });

      const config = await readConfig();
      expect(config.workflow_rules.max_stories_in_progress).toBe(3);
    });

    it('should merge partial updates with existing config', async () => {
      const originalConfig = await readConfig();
      const originalPhases = originalConfig.phases;

      await updateConfig({
        workflow_rules: {
          max_stories_in_progress: 2,
          subtasks_require_story_in_progress: true,
          all_subtasks_completed_before_review: true,
        },
      });

      const updatedConfig = await readConfig();
      expect(updatedConfig.phases).toEqual(originalPhases);
      expect(updatedConfig.workflow_rules.max_stories_in_progress).toBe(2);
    });
  });

  describe('readAllStories', () => {
    it('should return empty array when no stories exist', async () => {
      const stories = await readAllStories();
      expect(stories).toEqual([]);
    });

    it('should return all stories', async () => {
      const data: KanbanData = {
        config: getDefaultConfig(),
        stories: [
          { id: 'MVP-001', title: 'Story 1', status: 'todo', phase: 'MVP' },
          { id: 'MVP-002', title: 'Story 2', status: 'in_progress', phase: 'MVP' },
          { id: 'BETA-001', title: 'Story 3', status: 'done', phase: 'BETA' },
        ],
      };
      writeKanban(data);

      const stories = await readAllStories();
      expect(stories.length).toBe(3);
      expect(stories.map(s => s.id)).toEqual(['MVP-001', 'MVP-002', 'BETA-001']);
    });
  });

  describe('readStory', () => {
    beforeEach(() => {
      const data: KanbanData = {
        config: getDefaultConfig(),
        stories: [
          { id: 'MVP-001', title: 'Story 1', status: 'todo', phase: 'MVP' },
          { id: 'MVP-002', title: 'Story 2', status: 'in_progress', phase: 'MVP' },
        ],
      };
      writeKanban(data);
    });

    it('should return story by ID', async () => {
      const story = await readStory('MVP-001');

      expect(story).not.toBeNull();
      expect(story?.id).toBe('MVP-001');
      expect(story?.title).toBe('Story 1');
    });

    it('should return null for non-existent story', async () => {
      const story = await readStory('MVP-999');
      expect(story).toBeNull();
    });
  });

  describe('saveStory', () => {
    it('should add new story', async () => {
      const newStory: Story = {
        id: 'MVP-001',
        title: 'New Story',
        status: 'todo',
        phase: 'MVP',
      };

      await saveStory(newStory);
      const stories = await readAllStories();

      expect(stories.length).toBe(1);
      expect(stories[0].id).toBe('MVP-001');
    });

    it('should update existing story', async () => {
      const story: Story = {
        id: 'MVP-001',
        title: 'Original',
        status: 'todo',
        phase: 'MVP',
      };
      await saveStory(story);

      const updatedStory: Story = {
        ...story,
        title: 'Updated',
        status: 'in_progress',
      };
      await saveStory(updatedStory);

      const stories = await readAllStories();
      expect(stories.length).toBe(1);
      expect(stories[0].title).toBe('Updated');
      expect(stories[0].status).toBe('in_progress');
    });

    it('should handle concurrent saves with file locking', async () => {
      const story1: Story = {
        id: 'MVP-001',
        title: 'Story 1',
        status: 'todo',
        phase: 'MVP',
      };
      const story2: Story = {
        id: 'MVP-002',
        title: 'Story 2',
        status: 'todo',
        phase: 'MVP',
      };

      await Promise.all([saveStory(story1), saveStory(story2)]);

      const stories = await readAllStories();
      expect(stories.length).toBe(2);
      expect(stories.map(s => s.id).sort()).toEqual(['MVP-001', 'MVP-002']);
    });
  });

  describe('deleteStory', () => {
    beforeEach(async () => {
      await saveStory({
        id: 'MVP-001',
        title: 'Story to delete',
        status: 'todo',
        phase: 'MVP',
      });
      await saveStory({
        id: 'MVP-002',
        title: 'Story to keep',
        status: 'todo',
        phase: 'MVP',
      });
    });

    it('should delete story and return deleted story', async () => {
      const deleted = await deleteStory('MVP-001');

      expect(deleted).not.toBeNull();
      expect(deleted?.id).toBe('MVP-001');

      const stories = await readAllStories();
      expect(stories.length).toBe(1);
      expect(stories[0].id).toBe('MVP-002');
    });

    it('should return null when deleting non-existent story', async () => {
      const deleted = await deleteStory('MVP-999');
      expect(deleted).toBeNull();

      const stories = await readAllStories();
      expect(stories.length).toBe(2);
    });
  });

  describe('parseId', () => {
    it('should parse story ID', () => {
      const result = parseId('MVP-001');

      expect(result.type).toBe('story');
      expect(result.storyId).toBe('MVP-001');
      expect(result.subtaskNum).toBeUndefined();
    });

    it('should parse subtask ID', () => {
      const result = parseId('MVP-001-3');

      expect(result.type).toBe('subtask');
      expect(result.storyId).toBe('MVP-001');
      expect(result.subtaskNum).toBe(3);
    });

    it('should handle different phases', () => {
      expect(parseId('BETA-042').storyId).toBe('BETA-042');
      expect(parseId('V1-100').storyId).toBe('V1-100');
    });

    it('should throw on invalid ID format', () => {
      expect(() => parseId('invalid')).toThrow();
      expect(() => parseId('MVP')).toThrow();
      expect(() => parseId('001')).toThrow();
      expect(() => parseId('MVP-001-')).toThrow();
    });
  });

  describe('generateNextStoryId', () => {
    it('should generate first ID for phase', async () => {
      const id = await generateNextStoryId('MVP');
      expect(id).toBe('MVP-001');
    });

    it('should increment ID for existing stories', async () => {
      await saveStory({
        id: 'MVP-001',
        title: 'First',
        status: 'todo',
        phase: 'MVP',
      });
      await saveStory({
        id: 'MVP-002',
        title: 'Second',
        status: 'todo',
        phase: 'MVP',
      });

      const id = await generateNextStoryId('MVP');
      expect(id).toBe('MVP-003');
    });

    it('should handle gaps in story numbers', async () => {
      await saveStory({
        id: 'MVP-001',
        title: 'First',
        status: 'todo',
        phase: 'MVP',
      });
      await saveStory({
        id: 'MVP-005',
        title: 'Fifth',
        status: 'todo',
        phase: 'MVP',
      });

      const id = await generateNextStoryId('MVP');
      expect(id).toBe('MVP-006');
    });

    it('should generate independent IDs for different phases', async () => {
      await saveStory({
        id: 'MVP-003',
        title: 'MVP Story',
        status: 'todo',
        phase: 'MVP',
      });

      const betaId = await generateNextStoryId('BETA');
      expect(betaId).toBe('BETA-001');
    });
  });
});
