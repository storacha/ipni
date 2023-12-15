import { isLink } from 'multiformats/link'
import { sha256 } from 'multiformats/hashes/sha2'
import * as Block from 'multiformats/block'
import * as DagCbor from '@ipld/dag-cbor'
import { tokensToLength } from 'cborg/length'
import { Token, Type } from 'cborg'

/**
 * It is recommended to not create blocks bigger than 1MiB,
 * but for data transfer protocols(like Bitswap) to handle up to 2MiB
 * see: https://github.com/web3-storage/web3.storage/pull/1269#issuecomment-1108834504
 */
export const RECOMMENDED_MAX_BLOCK_BYTES = 1_048_576 // 1MiB

/**
 * How many EntryChunk `Next` links will an IPNI follow
 * Spec recommends 400
 * @see https://github.com/ipni/specs/blob/main/IPNI.md#entrychunk-chain
 * The reference impl limits to 65536
 * @see https://github.com/ipni/storetheindex/blob/e7ffb913a1191909d572febf09fb9aac6ef8bfab/deploy/manifests/prod/us-east-2/tenant/storetheindex/instances/inga/config.json#L83
 */

export const MAX_ENTRYCHUNK_CHAIN_LENGTH = 400 // or 65536?

const CID_TAG = new Token(Type.tag, 42)

/**
 * EntryChunk encodes an array of multihashes to the dag-cbor IPLD form.
 *
 * Call export to encode it as a dag-cbor block, and use the CID as the `entries`
 * field in an Advertisement.
 *
 * dag-cbor ensures a small encoded size (you may end up with a lot of them)
 * and allows us to calculate the exact encoded size cheaply, to allow you
 * to keep within libp2p block size limits and let peers gossip your indexes.
 *
 * From the spec:
 * > If an advertisement has more CIDs than fit into a single block for purposes of data transfer,
 * > they may be split into multiple chunks, conceptually a linked list, by using Next as a reference to the next chunk.
 * >
 * > ...each EntryChunk should stay below 4MiB, and a linked list of entry chunks
 * > should be no more than 400 chunks long.
 * >
 * > Above these constraints, the list of entries should be split into multiple advertisements.
 * > This means each individual advertisement can hold up to ~40 million multihashes.
 *
 * @see https://github.com/ipni/specs/blob/main/IPNI.md#entrychunk-chain
 *
 * @typedef {import('./schema').Link } Link
 * @typedef {import('./schema').EntryChunkOutput} EntryChunkOutput
 * @typedef {import('multiformats').MultihashDigest} MultihashDigest
 */
export class EntryChunk {
  /**
   * @param {Object} config
   * @param {Uint8Array[]} [config.entries] array of multihash byte arrays
   * @param {Link} [config.next] cid for previous EntryChunk
   */
  constructor ({ entries, next } = {}) {
    if (entries && !Array.isArray(entries)) {
      throw new Error('entries must be an array')
    }
    if (next && !isLink(next)) {
      throw new Error('next must be a CID')
    }
    this.next = next
    this.entries = entries ?? []
    // the fixed cost of encoding, without the entries array.
    this._encodingOverhead = entryChunkPartialEncodingOverhead(next)
    // sum of the encoded entries bytelength, without the array wrapper.
    this._encodedEntriesLength = tokensToLength(this.entries.map(e => new Token(Type.bytes, { length: e.byteLength })))
  }

  /**
   * @param {Uint8Array} entry byte encoded multihash
   */
  add (entry) {
    this.entries.push(entry)
    this._encodedEntriesLength += tokensToLength(new Token(Type.bytes, { length: entry.byteLength }))
  }

  /**
   * dag-cbor encoded byteLength
   */
  calculateEncodedSize () {
    const arraySize = tokensToLength(new Token(Type.array, this.entries.length))
    return this._encodingOverhead + this._encodedEntriesLength + arraySize
  }

  /**
   * IPLD EntryChunk object shape
   */
  ipldView () {
    return encodeEntryChunk(this)
  }

  /**
   * dag-cbor encoded Block
   */
  async export () {
    return Block.encode({ codec: DagCbor, hasher: sha256, value: this.ipldView() })
  }

  /**
   * @param {MultihashDigest[]} multihashes
   */
  static fromMultihashes (multihashes) {
    const entries = multihashes.map(mh => mh.bytes)
    return new EntryChunk({ entries })
  }

  /**
   * @param {Link[]} cids
   */
  static fromCids (cids) {
    const entries = cids.map(c => c.multihash.bytes)
    return new EntryChunk({ entries })
  }
}

/**
 * Encode to the EntryChunk IPLD shape
 * @see https://github.com/ipni/specs/blob/main/IPNI.md#entrychunk-chain
 *
 * @param {Object} config
 * @param {Uint8Array[]} config.entries array of multihash byte arrays
 * @param {Link} [config.next] cid for previous EntryChunk
 */
export function encodeEntryChunk ({ entries, next }) {
  /** @type {EntryChunkOutput} */
  const entryChunk = {
    Entries: entries,
    ...(next ? { Next: next } : {})
  }
  return entryChunk
}

/**
 * Calculate the byteLength of the dag-cbor encoded bytes for an array of entries.
 *
 * We know the encoded shape, we're figuring out how many entries we can fit in a
 * 4MiB block. We have to derive this from the entries, as hash length can vary.
 *
 * Adapted from @ipld/car https://github.com/ipld/js-car/blob/562c39266edda8422e471b7f83eadc8b7362ea0c/src/buffer-writer.js#L215
 *
 * @param {Object} config
 * @param {Uint8Array[]} config.entries
 * @param {Link} [config.next]
 **/
export function calculateDagCborSize ({ entries, next }) {
  const tokens = [
    new Token(Type.map, next ? 2 : 1),
    new Token(Type.string, 'Entries'),
    new Token(Type.array, entries.length)
  ]
  for (const entry of entries) {
    tokens.push(new Token(Type.bytes, { length: entry.byteLength }))
  }
  if (next) {
    tokens.push(new Token(Type.string, 'Next'))
    tokens.push(CID_TAG)
    // CIDs are prefixed with 0x00 for _historical reasons
    // see: https://github.com/ipld/js-dag-cbor/blob/83cd99cf8a04a7192d3e3d1e8f3f1c74d2f39a3b/src/index.js#L30C1-L32C11
    tokens.push(new Token(Type.bytes, { length: next.byteLength + 1 }))
  }
  return tokensToLength(tokens)
}

/**
 * Returns byteLength of a partially encoded EntryChunk
 * with optional Next link, but without the Entries array.
 * Just the fixed cost.
 *
 * @param {Link} [next] CID for previous EntryChunk
 */
export function entryChunkPartialEncodingOverhead (next) {
  const tokens = next
    ? [
        new Token(Type.map, 2),
        new Token(Type.string, 'Next'),
        CID_TAG,
        // CIDs are prefixed with 0x00 for _historical reasons_ see: https://github.com/ipld/js-dag-cbor/blob/83cd99cf8a04a7192d3e3d1e8f3f1c74d2f39a3b/src/index.js#L30C1-L32C11
        new Token(Type.bytes, { length: next.byteLength + 1 }),
        new Token(Type.string, 'Entries')
      ]
    : [
        new Token(Type.map, 1),
        new Token(Type.string, 'Entries')
      ]
  return tokensToLength(tokens)
}
