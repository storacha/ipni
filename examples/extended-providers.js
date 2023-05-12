import fs from 'node:fs'
import { CID } from 'multiformats/cid'
import * as Block from 'multiformats/block'
import { sha256 } from 'multiformats/hashes/sha2'
import * as dagJson from '@ipld/dag-json'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'

import { Provider, Advertisement } from '../index.js'

const previous = null // CID for previous batch. Pass `null` for the first advertisement in your chain
const entries = CID.parse('baguqeera4vd5tybgxaub4elwag6v7yhswhflfyopogr7r32b7dpt5mqfmmoq') // entry batch to provide
const context = new Uint8Array([99]) // custom id for a set of multihashes

// create a provider for each peer + protocol that will provider your entries
const bits = new Provider({ protocol: 'bitswap', addresses: ['/ip4/12.34.56.1/tcp/999/ws'], peerId: await createEd25519PeerId() })
const http = new Provider({ protocol: 'http', addresses: ['/dns4/dag.house/tcp/443/https'], peerId: await createEd25519PeerId() })
const graf = new Provider({
  protocol: 'graphsync',
  addresses: ['/ip4/120.0.0.1/tcp/1234'],
  peerId: await createEd25519PeerId(),
  metadata: {
    pieceCid: CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354'),
    fastRetrieval: true,
    verifiedDeal: true
  }
})

// an advertisement with a single multiple providers
const advert = new Advertisement({ providers: [http, bits, graf], entries, context, previous })

// sign and export to IPLD form per schema
const value = await advert.encodeAndSign()

// encode with you favorite IPLD codec and share with indexer node
const block = await Block.encode({ value, codec: dagJson, hasher: sha256 })

// share with indexer
fs.writeFileSync(block.cid.toString(), block.bytes)
