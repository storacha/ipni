import fs from 'node:fs'
import { Readable } from 'node:stream'
import { CID } from 'multiformats/cid'
import { base58btc } from 'multiformats/bases/base58'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { Provider, Advertisement } from '../index.js'
import { MultihashIndexSortedReader } from 'cardex'
import { EntryChunk, RECOMMENDED_MAX_BLOCK_BYTES } from '../entry-chunk.js'

/**
 * @typedef {import('../schema').Link } Link
 * @typedef {import('../schema').EntryChunkOutput} EntryChunkOutput
 * @typedef {import('multiformats').MultihashDigest} MultihashDigest
 */

// a peer, addr, and protocol that will provider your entries
const provider = new Provider({
  protocol: 'http',
  addresses: '/dns4/example.org/tcp/443/https',
  peerId: await createEd25519PeerId() // load your peerID and private key here
})

const carCid = CID.parse('bagbaierarw3cf23e5fhc55yosqielfejjdl6rfrppotlnxl2lf6qultqi2ka')
const carIndexStream = fs.createReadStream(`./${carCid.toString()}.car.idx`)
const carIndexReader = MultihashIndexSortedReader.createReader({ reader: Readable.toWeb(carIndexStream).getReader() })

let previous = null
let entryChunk = new EntryChunk()

while (true) {
  const { done, value } = await carIndexReader.read()
  if (done) break
  console.log(`📌 ${base58btc.encode(value.multihash.bytes)} @ ${value.offset}`)
  entryChunk.add(value.multihash.bytes)
  if (entryChunk.calculateEncodedSize() >= RECOMMENDED_MAX_BLOCK_BYTES) {
    const entries = await writeEntryChunk(entryChunk)
    const context = carCid.bytes
    previous = await writeAdvert({ entries, context, provider, previous })
    entryChunk = new EntryChunk()
  }
}
const entries = await writeEntryChunk(entryChunk)
const context = carCid.bytes
previous = await writeAdvert({ entries, context, provider, previous })

/**
 * @param {EntryChunk} entryChunk
 */
async function writeEntryChunk (entryChunk) {
  const entryBlock = await entryChunk.export()
  console.log(`🧩 ${entryBlock.cid} # EntryChunk`)
  return entryBlock.cid
}

/**
 * @param {Object} config
 * @param {Link} config.entries
 * @param {Uint8Array} config.context
 * @param {Provider} config.provider
 * @param {Link|null} [config.previous=null]
 */
async function writeAdvert ({ entries, context, provider, previous = null }) {
  // an advertisement with a single http provider
  const advert = new Advertisement({ providers: [provider], entries, context, previous })
  const block = await advert.export()
  console.log(`🎟️  ${block.cid} # Advertisement`)
  return block.cid
}
