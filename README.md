# ipni

> Create signed advertisements for the [InterPlanetary Network Indexer](https://github.com/ipni/specs/blob/main/IPNI.md)

Supports single and [extended providers](https://github.com/ipni/specs/blob/main/IPNI.md#extendedprovider).

Derived from reference implentation in https://github.com/ipni/go-libipni/blob/main/ingest/schema/envelope.go

See the [IPLD Schema](./schema.ipldsch) for the encoded Advertisement shape. The encoding logic in this lib is validated against that schema.

## Single provider

Encode an signed advertisement for a new batch of entries available from a single provider

```js
import test from 'ava'
import { CID } from 'multiformats/cid'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { Provider, Advertisement } from '@web3-storage/ipni'

// Link to the latest batch of multihashes
const entries = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354') 
// Custom identifier for a set of multihashes
const context = new Uint8Array([99])

// a peer, addr, and protocol that will provider your entries
const http = new Provider(await createEd25519PeerId(), '/dns4/example.org/tcp/443/https', 'http')

// an advertisement with a single http provider
const advert = new Advertisement([http], entries, context)

// encode to IPLD form per schema
const encoded = await advert.encodeAndSign()

t.like(encoded, {
  Provider: http.peerId.toCID().toString(),
  Addresses: '/dns4/example.org/tcp/443/https',
  Entries: entries,
  ContextID: context,
  Metadata: HTTP_PREFIX,
  IsRm: false
})
```

## Extended Providers

Encode a signed advertisement with an Extended Providers section where the entries are available from multiple providers or different protocols. 

The first provider passed to the Advertisement constructor is used as the top level provider for older indexers that don't yet support the `ExtendedProvider` property.

```js
import test from 'ava'
import { CID } from 'multiformats/cid'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { Provider, Advertisement } from '@web3-storage/ipni'

// Link to the latest batch of multihashes
const entries = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354') 
// Custom identifier for a set of multihashes
const context = new Uint8Array([99])

// create a provider for each peer + protocol that will provider your entries
const bitswap = new Provider(await createEd25519PeerId(), '/ip4/12.34.56.78/tcp/999/ws', 'bitswap')
const http = new Provider(await createEd25519PeerId(), '/dns4/example.org/tcp/443/https', 'http')
const graph = new Provider(await createEd25519PeerId(), '/ip4/120.0.0.1/tcp/999/ws', 'graphsync', {
  pieceCid: CID.parse('QmeUdoMyahuQUPHS2odrZEL6yk2HnNfBJ147BeLXsZuqLJ'),
  fastRetrieval: true,
  verifiedDeal: true
})

// an advertisement with multiple providers
const advert = new Advertisement([bitswap, http, graph], entries, context)

// encode to IPLD form per schema
const encoded = await advert.encodeAndSign()

t.like(encoded, {
  // bitswap peer is used for the top level provider details
  Provider: bitswap.peerId.toCID().toString(),
  Addresses: '/ip4/12.34.56.78/tcp/999/ws',
  Entries: entries,
  ContextID: context,
  Metadata: HTTP_PREFIX,
  IsRm: false
})
// per the spec the top level provider info is duplicated in the Providers section
t.like(encoded.ExtendedProvider.Providers[0], {
  ID: bitswap.peerId.toCID().toString(),
  Addresses: [bitswap.addresses[0].toString()],
  Metadata: BITSWAP_PREFIX
})
t.like(encoded.ExtendedProvider.Providers[1], {
  ID: http.peerId.toCID().toString(),
  Addresses: [http.addresses[0].toString()],
  Metadata: HTTP_PREFIX
})
t.like(encoded.ExtendedProvider.Providers[2], {
  ID: graph.peerId.toCID().toString(),
  Addresses: [graph.addresses[0].toString()]
})
```
