import fs from 'node:fs'
import { CID } from 'multiformats/cid'
import * as Block from 'multiformats/block'
import { sha256 } from 'multiformats/hashes/sha2'
import * as dagJson from '@ipld/dag-json'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'

import { Provider, createExtendedProviderAd } from '../index.js'

const previous = null // CID for previous advertisement. Pass `null` for the first advertisement in your chain

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

// create an ad with the extra provider info and no context or entries
// to denote that they apply to all previous and future advertisements
const advert = createExtendedProviderAd({ providers: [http, bits, graf], previous })

// sign and export to IPLD form per schema
const value = await advert.encodeAndSign()

// encode with you favorite IPLD codec and share with indexer node
const block = await Block.encode({ value, codec: dagJson, hasher: sha256 })

// share with indexer
fs.writeFileSync(block.cid.toString(), block.bytes)

console.log(`wrote ${block.cid.toString()}`)
