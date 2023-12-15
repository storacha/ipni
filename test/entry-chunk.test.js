import test from 'ava'
import { CID } from 'multiformats/cid'
import { sha512 } from 'multiformats/hashes/sha2'
import * as DagCbor from '@ipld/dag-cbor'
import { parse as parseSchema } from 'ipld-schema'
import { create as createValidator } from 'ipld-schema-validator'
import { readFile } from 'fs/promises'
import { calculateDagCborSize, encodeEntryChunk, EntryChunk } from '../entry-chunk.js'

const schema = await readFile('schema.ipldsch', { encoding: 'utf8' })
const validator = createValidator(parseSchema(schema), 'EntryChunk')
const emptyDirCid = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354')

test('encodeEntryChunk', t => {
  let encoded = encodeEntryChunk({ entries: [] })
  t.true(validator(encoded), 'encoded form matches IPLD schema')

  encoded = encodeEntryChunk({ entries: [], next: emptyDirCid })
  t.true(validator(encoded), 'encoded form matches IPLD schema with next link')

  encoded = encodeEntryChunk({ entries: [emptyDirCid.multihash.bytes], next: emptyDirCid })
  t.true(validator(encoded), 'encoded form matches IPLD schema with next link')
})

test('fromMultihashes', t => {
  const entries = EntryChunk.fromMultihashes([emptyDirCid.multihash])
  const encoded = entries.ipldView()
  t.like(encoded, {
    Entries: [emptyDirCid.multihash.bytes]
  })
})

test('fromCids', t => {
  const entries = EntryChunk.fromCids([emptyDirCid])
  const encoded = entries.ipldView()
  t.like(encoded, {
    Entries: [emptyDirCid.multihash.bytes]
  })
})

test('add', async t => {
  const chunk = EntryChunk.fromCids([emptyDirCid])
  chunk.add(emptyDirCid.multihash.bytes)
  t.like({
    Entries: [
      emptyDirCid.multihash.bytes,
      emptyDirCid.multihash.bytes
    ]
  }, chunk.ipldView())
})

test('calculateDagCborSize', t => {
  const entries = new Array(1).fill(emptyDirCid.multihash.bytes)
  const chunk = encodeEntryChunk({ entries })
  const estimate = calculateDagCborSize({ entries })
  const encoded = DagCbor.encode(chunk)
  t.is(estimate, encoded.byteLength)
})

test('calculateDagCborSize with next', t => {
  const entries = new Array(1).fill(emptyDirCid.multihash.bytes)
  const next = emptyDirCid
  const chunk = encodeEntryChunk({ entries, next })
  const estimate = calculateDagCborSize({ entries, next })
  const encoded = DagCbor.encode(chunk)
  t.is(estimate, encoded.byteLength)
})

test('calculateDagCborSize lg', t => {
  const entries = new Array(10000).fill(emptyDirCid.multihash.bytes)
  const chunk = encodeEntryChunk({ entries })
  const encoded = DagCbor.encode(chunk)
  const estimate = calculateDagCborSize({ entries })
  t.is(estimate, encoded.byteLength)
})

test('calculateDagCborSize lg sha-512', async t => {
  const next = emptyDirCid
  const eg = await sha512.digest(new Uint8Array())
  const entries = new Array(10000).fill(eg.bytes)
  const chunk = encodeEntryChunk({ entries, next })
  const encoded = DagCbor.encode(chunk)
  const estimate = calculateDagCborSize({ entries, next })
  t.is(estimate, encoded.byteLength)
})

test('export', async t => {
  const next = emptyDirCid
  const entries = new Array(1).fill(emptyDirCid.multihash.bytes)
  const chunk = new EntryChunk({ entries, next })
  const block = await chunk.export()
  t.like(block.value, {
    Entries: [entries[0]],
    Next: emptyDirCid
  })
})

test('calculateEncodedSize', async t => {
  const entries = new Array(1).fill(emptyDirCid.multihash.bytes)
  const chunk = new EntryChunk({ entries })
  const block = await chunk.export()
  t.is(chunk.calculateEncodedSize(), block.bytes.byteLength)
  t.like(block.value, {
    Entries: [entries[0]]
  })
})

test('calculateEncodedSize with next', async t => {
  const entries = new Array(1).fill(emptyDirCid.multihash.bytes)
  const next = emptyDirCid
  const chunk = new EntryChunk({ entries, next })
  const block = await chunk.export()
  t.is(chunk.calculateEncodedSize(), block.bytes.byteLength)
})

test('calculateEncodedSize lg', async t => {
  const entries = new Array(10000).fill(emptyDirCid.multihash.bytes)
  const chunk = new EntryChunk({ entries })
  const block = await chunk.export()
  t.is(chunk.calculateEncodedSize(), block.bytes.byteLength)
})

test('calculateEncodedSize lg sha-512', async t => {
  const next = emptyDirCid
  const eg = await sha512.digest(new Uint8Array())
  // array encoding varint expands at this size
  // see: https://github.com/rvagg/cborg/blob/c16d9184d7696dc5245d83a6b8680617e05ac3bc/lib/0uint.js#L6C41-L6C46
  const uIntEncodingBoundary = 65536
  const entries = new Array(uIntEncodingBoundary).fill(eg.bytes)
  const chunk = new EntryChunk({ entries, next })
  const block = await chunk.export()
  t.is(chunk.calculateEncodedSize(), block.bytes.byteLength)
})
