/**
 * CAR File Export
 *
 * Exports repository data in CAR (Content Addressable aRchive) format.
 * CAR files are used for repository backup and sync.
 */

import { CID } from 'multiformats/cid';
import * as Block from 'multiformats/block';
import { sha256 } from 'multiformats/hashes/sha2';
import * as dagCbor from '@ipld/dag-cbor';
import { CarWriter } from '@ipld/car';
import {
  getLatestPdsCommit,
  getPdsCommitsSince,
  listPdsRecords,
  getPdsBlobByCid,
} from '../database/queries.ts';

/**
 * Export a repository to CAR format
 */
export async function exportRepoCar(
  did: string,
  since?: string
): Promise<Uint8Array> {
  // Get commits
  const commits = since
    ? getPdsCommitsSince(did, since)
    : getPdsCommitsSince(did);

  if (commits.length === 0 && !since) {
    // No commits yet, return empty CAR
    return createEmptyCar(did);
  }

  // Get the latest commit for the root
  const latestCommit = getLatestPdsCommit(did);
  if (!latestCommit) {
    return createEmptyCar(did);
  }

  const rootCid = CID.parse(latestCommit.cid);

  // Collect all blocks
  const blocks: Array<{ cid: CID; bytes: Uint8Array }> = [];

  // Add commit blocks
  for (const commit of commits) {
    blocks.push({
      cid: CID.parse(commit.cid),
      bytes: new Uint8Array(commit.data),
    });
  }

  // Add record blocks
  // Get all collections
  const collections = ['pub.leaflet.document', 'pub.leaflet.publication', 'pub.leaflet.canvas'];

  for (const collection of collections) {
    const { records } = listPdsRecords(did, collection, { limit: 10000 });

    for (const record of records) {
      blocks.push({
        cid: CID.parse(record.cid),
        bytes: new Uint8Array(record.value),
      });
    }
  }

  // Create CAR
  return createCar(rootCid, blocks);
}

/**
 * Export a single record to CAR format
 */
export async function exportRecordCar(
  did: string,
  collection: string,
  rkey: string
): Promise<Uint8Array | null> {
  const { records } = listPdsRecords(did, collection, { limit: 1, cursor: rkey });

  const record = records.find(r => r.rkey === rkey);
  if (!record) {
    return null;
  }

  const rootCid = CID.parse(record.cid);
  const blocks = [
    {
      cid: rootCid,
      bytes: new Uint8Array(record.value),
    },
  ];

  return createCar(rootCid, blocks);
}

/**
 * Create a CAR file from blocks
 */
async function createCar(
  root: CID,
  blocks: Array<{ cid: CID; bytes: Uint8Array }>
): Promise<Uint8Array> {
  // Create a writable stream to collect the CAR data
  const chunks: Uint8Array[] = [];

  const { writer, out } = CarWriter.create([root]);

  // Collect output chunks
  const collectPromise = (async () => {
    for await (const chunk of out) {
      chunks.push(chunk);
    }
  })();

  // Write blocks
  for (const block of blocks) {
    await writer.put({ cid: block.cid, bytes: block.bytes });
  }

  await writer.close();
  await collectPromise;

  // Concatenate chunks
  const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Create an empty CAR file
 */
async function createEmptyCar(did: string): Promise<Uint8Array> {
  // Create a minimal root block
  const rootData = { did, empty: true };
  const rootBlock = await Block.encode({
    value: rootData,
    codec: dagCbor,
    hasher: sha256,
  });

  return createCar(rootBlock.cid, [
    { cid: rootBlock.cid, bytes: rootBlock.bytes },
  ]);
}

/**
 * Get the latest commit info for a repository
 */
export function getRepoHead(did: string): { root: string; rev: string } | null {
  const commit = getLatestPdsCommit(did);
  if (!commit) {
    return null;
  }

  return {
    root: commit.cid,
    rev: commit.rev,
  };
}

/**
 * Check if a repository exists
 */
export function repoExists(did: string): boolean {
  const commit = getLatestPdsCommit(did);
  return commit !== null;
}
