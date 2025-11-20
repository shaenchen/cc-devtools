/**
 * Index storage using MessagePack for efficient serialization
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';

import { pack, unpack } from 'msgpackr';

import type { DocIndex, DocChunk } from '../types.js';

import { withLock } from '../../shared/file-lock.js';

const INDEX_VERSION = '1.0.0';

interface SerializedIndex {
  version: string;
  indexedAt: number;
  fileCount: number;
  chunkCount: number;
  chunks: Array<[string, DocChunk[]]>;
  embeddings: Array<[string, number[]]>;
}

export async function saveIndex(index: DocIndex, indexPath: string): Promise<void> {
  await withLock(indexPath, () => {
    const serialized: SerializedIndex = {
      version: INDEX_VERSION,
      indexedAt: index.metadata.indexedAt,
      fileCount: index.metadata.fileCount,
      chunkCount: index.metadata.chunkCount,
      chunks: Array.from(index.chunks.entries()),
      embeddings: Array.from(index.embeddings.entries()).map(([key, embedding]) => [key, Array.from(embedding)])
    };

    const packed = pack(serialized);
    writeFileSync(indexPath, packed);
  });
}

export async function loadIndex(indexPath: string): Promise<DocIndex | null> {
  if (!existsSync(indexPath)) {
    return null;
  }

  try {
    return await withLock(indexPath, () => {
      const buffer = readFileSync(indexPath);
      const serialized = unpack(buffer) as SerializedIndex;

      if (serialized.version !== INDEX_VERSION) {
        return null;
      }

      const index: DocIndex = {
        chunks: new Map(serialized.chunks),
        embeddings: new Map(serialized.embeddings.map(([key, embedding]) => [key, new Float32Array(embedding)])),
        metadata: {
          version: serialized.version,
          indexedAt: serialized.indexedAt,
          fileCount: serialized.fileCount,
          chunkCount: serialized.chunkCount
        }
      };

      return index;
    });
  } catch {
    return null;
  }
}

export function createEmptyIndex(): DocIndex {
  return {
    chunks: new Map(),
    embeddings: new Map(),
    metadata: {
      version: INDEX_VERSION,
      indexedAt: Date.now(),
      fileCount: 0,
      chunkCount: 0
    }
  };
}
