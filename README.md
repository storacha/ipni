# ipni

> Create signed advertisements for the [InterPlanetary Network Indexer](https://github.com/ipni/specs/blob/main/IPNI.md)

This library handles encoding and signing of IPNI advertisments. To share them with an indexer follow the guidance in the spec [here](https://github.com/ipni/specs/blob/main/IPNI.md#advertisement-transfer)

Supports single and [extended providers](https://github.com/ipni/specs/blob/main/IPNI.md#extendedprovider).

Derived from reference implentation in https://github.com/ipni/go-libipni/blob/main/ingest/schema/envelope.go

See the [IPLD Schema](./schema.ipldsch) for the encoded Advertisement shape. The encoding logic in this lib is validated against that schema.

## Getting started

Use `node` > 18. Install as dependency from `npm`. 

```sh
npm i @web3-storage/ipni
```

## Single provider

Encode an signed advertisement for a new batch of entries available from a single provider. You will need a mechanism for fetching the peerId and signing keys for your providers, e.g `createfromJSON` from [`@libp2p/peer-id-factory`](https://github.com/libp2p/js-libp2p-peer-id/tree/master/packages/libp2p-peer-id-factory#readme)

```js
import test from 'ava'
import { CID } from 'multiformats/cid'
import { createfromJSON } from '@libp2p/peer-id-factory'
import { Provider, Advertisement } from '@web3-storage/ipni'

// Link to the latest batch of multihashes
const entries = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354') 
// Link to previous batch. Pass `null` if this is the first advertisement in your chain
const previous = CID.parse('baguqeerac3sm46p47bkdubg7tv7spipp2pmwj4og44evcp766wwffwnhhtsa')
// Custom identifier for a set of multihashes
const context = new Uint8Array([99])

// a peer, addr, and protocol that will provider your entries
const http = new Provider({ 
  protocol: 'http', 
  addresses: '/dns4/example.org/tcp/443/https',
  peerId: await createfromJSON(/* load you id, and signing keys */)
})

// an advertisement with a single http provider
const advert = new Advertisement({ providers: [http], entries, context, previous })

// encode to IPLD form per schema
const encoded = await advert.encodeAndSign()

t.like(encoded, {
  Provider: http.peerId.toCID().toString(),
  Addresses: '/dns4/example.org/tcp/443/https',
  Entries: entries,
  ContextID: context,
  IsRm: false
})

// next step: encode with you favourite IPLD codec and share with an indexer node
```

## Extended Providers

Encode a signed advertisement with an Extended Providers section where the entries are available from multiple providers or different protocols. 

The first provider passed to the Advertisement constructor is used as the top level provider for older indexers that don't yet support the `ExtendedProvider` property.

```js
import test from 'ava'
import { CID } from 'multiformats/cid'
import { Provider, Advertisement } from '@web3-storage/ipni'

// Link to the latest batch of multihashes
const entries = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354') 
// Custom identifier for a set of multihashes
const context = new Uint8Array([99])

// create a provider for each peer + protocol that will provider your entries
const bits = new Provider({ protocol: 'bitswap', addresses: ['/ip4/12.34.56.1/tcp/999/ws'], peerId: /* bs peerId */ })
const http = new Provider({ protocol: 'http', addresses: ['/dns4/dag.house/tcp/443/https'], peerId: /* http peerId */})
const graf = new Provider({ protocol: 'graphsync', addresses: ['/ip4/120.0.0.1/tcp/1234'], peerId: /* gs peerId */, metadata: {
  pieceCid: CID.parse('QmeUdoMyahuQUPHS2odrZEL6yk2HnNfBJ147BeLXsZuqLJ'),
  fastRetrieval: true,
  verifiedDeal: true
})

// an advertisement with multiple providers. It's the first in the chain, so `previous: null`
const advert = new Advertisement([bits, http, graf], entries, context, previous: null)

// encode to IPLD form per schema and sign Advertisement and ExtendedProvder
const encoded = await advert.encodeAndSign()

t.like(encoded, {
  // bitswap peer is used for the top level provider details
  Provider: bitswap.peerId.toCID().toString(),
  Addresses: '/ip4/12.34.56.78/tcp/999/ws',
  Entries: entries,
  ContextID: context,
  IsRm: false
})
// per the spec the top level provider info is duplicated in the Providers section
t.like(encoded.ExtendedProvider.Providers[0], {
  ID: bits.peerId.toCID().toString(),
  Addresses: [bitswap.addresses[0].toString()],
})
t.like(encoded.ExtendedProvider.Providers[1], {
  ID: http.peerId.toCID().toString(),
  Addresses: [http.addresses[0].toString()],
})
t.like(encoded.ExtendedProvider.Providers[2], {
  ID: graf.peerId.toCID().toString(),
  Addresses: [graph.addresses[0].toString()]
})
```
