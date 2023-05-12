# ipni

> Create signed advertisements for the [InterPlanetary Network Indexer](https://github.com/ipni/specs/blob/main/IPNI.md)

This library handles encoding and signing of IPNI advertisements. To share them with an indexer follow the guidance in the spec [here](https://github.com/ipni/specs/blob/main/IPNI.md#advertisement-transfer)

Supports single and [extended providers](https://github.com/ipni/specs/blob/main/IPNI.md#extendedprovider) by separating Provider and Advertisement creation. 

Pass and array of Providers to your Advertisement and it figures out how to encode it. Only 1? You get a simple Advertisement. More than 1? It's an `ExtendedProvider` encoding for you with a signature from each provider.

Derived from reference implementation in https://github.com/ipni/go-libipni/blob/main/ingest/schema/envelope.go

See the [IPLD Schema](./schema.ipldsch) for the encoded Advertisement shape. The encoding logic in this lib is validated against that schema.

## Getting started

Use `node` > 18. Install as dependency from `npm`. 

```sh
npm i @web3-storage/ipni
```

## Single provider

Encode an signed advertisement for a new batch of entries available from a single provider. You will need a mechanism for fetching the peerId and signing keys for your providers, e.g `createFromJSON` from [`@libp2p/peer-id-factory`](https://github.com/libp2p/js-libp2p-peer-id/tree/master/packages/libp2p-peer-id-factory#readme)

```js
import test from 'ava'
import * as dagJson from '@ipld/dag-json'
import { sha256, CID } from 'multiformats'
import { createFromJSON } from '@libp2p/peer-id-factory'
import { Provider, Advertisement } from '@web3-storage/ipni'

const previous = null // CID for previous batch. Pass `null` for the first advertisement in your chain
const entries = CID.parse(/* Link to the latest batch of multihashes */)
const context = new Uint8Array([99]) // your custom id for a group of multihashes

// a peer, addr, and protocol that will provider your entries
const http = new Provider({ 
  protocol: 'http',
  addresses: '/dns4/example.org/tcp/443/https',
  peerId: await createFromJSON(/* your id, and signing keys */)
})

// an advertisement with a single http provider
const advert = new Advertisement({ providers: [http], entries, context, previous })

// sign and export to IPLD form per schema
const value = await advert.encodeAndSign()

// encode with you favorite IPLD codec and share with indexer node
const block = await Block.encode({ value, codec: dagJson, hasher: sha256})
```

## Extended Providers

Encode a signed advertisement with an Extended Providers section where the entries are available from multiple providers or different protocols. 

The first provider passed to the Advertisement constructor is used as the top level provider for older indexers that don't yet support the `ExtendedProvider` property.

```js
import test from 'ava'
import { CID } from 'multiformats/cid'
import { Provider, Advertisement } from '@web3-storage/ipni'

const previous = null // CID for previous batch. Pass `null` for the first advertisement in your chain
const entries = CID.parse(/* Link to the latest batch of multihashes */)
const context = new Uint8Array([99]) // your custom id for a group of multihashes

// create a provider for each peer + protocol that will provider your entries
const bits = new Provider({ protocol: 'bitswap', addresses: ['/ip4/12.34.56.1/tcp/999/ws'], peerId: /* bs peerId */ })

const http = new Provider({ protocol: 'http', addresses: ['/dns4/dag.house/tcp/443/https'], peerId: /* http peerId */})

const graf = new Provider({ protocol: 'graphsync', addresses: ['/ip4/120.0.0.1/tcp/1234'], peerId: /* gs peerId */,
  metadata: {
    pieceCid: CID.parse( /* CID for aggregated deal that contains the entries */),
    fastRetrieval: true,
    verifiedDeal: true
  }
})

// an advertisement with multiple providers. It's the first in the chain, so `previous: null`
const advert = new Advertisement([bits, http, graf], entries, context, previous: null)

// encode to IPLD form per schema and sign Advertisement and ExtendedProvider
const value = await advert.encodeAndSign()

t.like(value, {
  // bitswap peer is used for the top level provider details
  Provider: bitswap.peerId.toString(),
  Addresses: '/ip4/12.34.56.78/tcp/999/ws',
  Entries: entries,
  ContextID: context,
  IsRm: false
})
// per the spec the top level provider info is duplicated in the Providers section
t.like(value.ExtendedProvider.Providers[0], {
  ID: bits.peerId.toString(),
  Addresses: [bitswap.addresses[0].toString()],
})
t.like(value.ExtendedProvider.Providers[1], {
  ID: http.peerId.toString(),
  Addresses: [http.addresses[0].toString()],
})
t.like(value.ExtendedProvider.Providers[2], {
  ID: graf.peerId.toString(),
  Addresses: [graph.addresses[0].toString()]
})
```
