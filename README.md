# ipni

Create signed Advertisement records for the [InterPlanetary Network Indexer](https://github.com/ipni/specs/blob/main/IPNI.md)

> IPNI is a content routing system optimized to take billions of CIDs from large-scale data providers, and allow fast lookup of provider information using these CIDs over a simple HTTP REST API.
> – https://github.com/ipni

This library handles encoding and signing of IPNI advertisements. To share them with an indexer follow the guidance in the spec [here](https://github.com/ipni/specs/blob/main/IPNI.md#advertisement-transfer)

Supports single and [extended providers](https://github.com/ipni/specs/blob/main/IPNI.md#extendedprovider) by separating Provider and Advertisement creation. 

Pass and array of Providers to your Advertisement and it figures out how to encode it. Only 1? You get a simple Advertisement. More than 1? It's an `ExtendedProvider` encoding for you with a signature from each provider.

Derived from reference implementation in https://github.com/ipni/go-libipni/blob/main/ingest/schema/envelope.go

See the [IPLD Schema](./schema.ipldsch) for the encoded Advertisement shape. The encoding logic in this lib is validated against that schema.

## Getting started

Use `node` > 18. Install as dependency from `npm`. 

```sh
npm i @web3-storage/ipni
```

## Single provider

Encode an signed advertisement for a new batch of entries available from a single provider. You will need a mechanism for fetching the peerId and signing keys for your providers, e.g `createFromJSON` from [`@libp2p/peer-id-factory`](https://github.com/libp2p/js-libp2p-peer-id/tree/master/packages/libp2p-peer-id-factory#readme)

Construct A Provider with the peerID and signing keys, and pass it to an Advertisement along with the entries CID, a context ID, and a CID for the previous batch of entries or `null` if this is the first advertisement in your chain.

Call `advertisement.signAndEncode()` to export a valid Advertisement ready for encoding as IPLD.

```js
import fs from 'node:fs'
import { CID } from 'multiformats/cid'
import * as Block from 'multiformats/block'
import { sha256 } from 'multiformats/hashes/sha2'
import * as dagJson from '@ipld/dag-json'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'

import { Provider, Advertisement } from '@web3-storage/ipni'

const previous = null // CID for previous batch. Pass `null` for the first advertisement in your chain
const entries = CID.parse('baguqeera4vd5tybgxaub4elwag6v7yhswhflfyopogr7r32b7dpt5mqfmmoq') // entry batch to provide
const context = new Uint8Array([99]) // custom id for a set of multihashes

// a peer, addr, and protocol that will provider your entries
const http = new Provider({
  protocol: 'http',
  addresses: '/dns4/example.org/tcp/443/https',
  peerId: await createEd25519PeerId() // load your peerID and private key here
})

// an advertisement with a single http provider
const advert = new Advertisement({ providers: [http], entries, context, previous })

// sign and export to IPLD form per schema
const value = await advert.encodeAndSign()

// encode with you favorite IPLD codec and share with indexer node
const block = await Block.encode({ value, codec: dagJson, hasher: sha256 })

fs.writeFileSync(block.cid.toString(), block.bytes)
```

A `dag-json` encoded Advertisement (formatted for readability):

```json
{
  "Addresses": [
    "/dns4/example.org/tcp/443/https"
  ],
  "ContextID": {
    "/": {
      "bytes": "Yw"
    }
  },
  "Entries": {
    "/": "baguqeera4vd5tybgxaub4elwag6v7yhswhflfyopogr7r32b7dpt5mqfmmoq"
  },
  "IsRm": false,
  "Metadata": {
    "/": {
      "bytes": "gID0AQ"
    }
  },
  "Provider": "12D3KooWRWhMPufv96SaKNkBF5YbySbTT4epRRCpQbxZ5d487Dit",
  "Signature": {
    "/": {
      "bytes": "CiQIARIg6TQ6LpZznok4/IZxoyfpfb9v/5iIBrfZ5j8MOB2wcW0SGy9pbmRleGVyL2luZ2VzdC9hZFNpZ25hdHVyZRoiEiC9Br3J4IwxG525lPNBGPaH4pfu//jFgdX8y9mCZJuRBCpAf+hMGDqxLppZZhoaLGxlwQk4XJH6MkRbRWQ+Bx6R+fkU7+wpH4mmD3159pdxHFr3jTJenRbNt27i711mIHp7AA"
    }
  }
}
```

## Extended Providers

Encode a signed advertisement with an Extended Providers section and no context id or entries cid to announce that **all** previous and future entries are available from multiple providers or different protocols.

You only need to announce the additional providers once. Subsequent ExtendedProvider advertisements are additive. The indexer will record that your entries are available from the union of all the ExtendedProvider records.

Note: it is not currently possible to remove a Provider once announced ([issue](https://github.com/ipni/storetheindex/issues/1745))

You may announce a set of ExtendedProviders with a context to inform the indexer that only the subset of entries with the same context id are available from these extended providers.

The first provider passed to the Advertisement constructor is used as the top level provider for older indexers that don't yet support the `ExtendedProvider` property.

```js
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
```

A `dag-json` encoded Advertisement (formatted for readability):

```json
{
  "Addresses": [
    "/dns4/dag.house/tcp/443/https"
  ],
  "ContextID": {
    "/": {
      "bytes": ""
    }
  },
  "Entries": {
    "/": "bafkreehdwdcefgh4dqkjv67uzcmw7oje"
  },
  "ExtendedProvider": {
    "Override": false,
    "Providers": [
      {
        "Addresses": [
          "/dns4/dag.house/tcp/443/https"
        ],
        "ID": "12D3KooWQWY5d9xp8on1cizKBdbscfKo1qcyovk7KwV9kKKXWpwK",
        "Metadata": {
          "/": {
            "bytes": "gID0AQ"
          }
        },
        "Signature": {
          "/": {
            "bytes": "CiQIARIg2k4OefnZgOzUQo0VQE5Yg9KubOpw3gTWHeQprfuidZISKS9pbmRleGVyL2luZ2VzdC9leHRlbmRlZFByb3ZpZGVyU2lnbmF0dXJlGiISIOrC3ZauKlzBVU7HWLR3VjlW79cf9D7xMKMcbqBXA1bQKkB1rdZLHfzTDpfZZ2IH6HJHsGSkaKbmRD+QSIIb0z73sKoSMutXeuJiK2cJ54PL6m2hPCWJyV9fBcuYMKDAXVwA"
          }
        }
      },
      {
        "Addresses": [
          "/ip4/12.34.56.1/tcp/999/ws"
        ],
        "ID": "12D3KooWJn37snQzNk3BTBgzGFJpxg7er8CLofq2789PqaPzPF1g",
        "Metadata": {
          "/": {
            "bytes": "gBI"
          }
        },
        "Signature": {
          "/": {
            "bytes": "CiQIARIghSB7P4RGuK3xYFMW/Z5fKNvzMqDb424fhxkTRfde5B8SKS9pbmRleGVyL2luZ2VzdC9leHRlbmRlZFByb3ZpZGVyU2lnbmF0dXJlGiISIBV1UXktJsOIfiXLGueJmvbpMYOXwdk8tMzRWOBSb4VIKkCzt7tvBMp/mjM4P2A3qU5XfvWF0/7M2cBoNLCM24jVu1roj5yyj1NA/xLA+ap97YY79EPx7eQWEnMxF15wr2EL"
          }
        }
      },
      {
        "Addresses": [
          "/ip4/120.0.0.1/tcp/1234"
        ],
        "ID": "12D3KooWG8RfSPYd5RgUFsAdJL1HnAvGMsce7CLJ1hcQTQa7cVAQ",
        "Metadata": {
          "/": {
            "bytes": "kBKjaFBpZWNlQ0lE2CpYJQABcBIgWZSEOQZfKWGe9BKAy7kyvlLFbZnFlmtl4BESOfCYu+9sVmVyaWZpZWREZWFs9W1GYXN0UmV0cmlldmFs9Q"
          }
        },
        "Signature": {
          "/": {
            "bytes": "CiQIARIgXcaHEiXQHTgt2OE9I4oWwNv7gtbqWMCI03gSEh1O00kSKS9pbmRleGVyL2luZ2VzdC9leHRlbmRlZFByb3ZpZGVyU2lnbmF0dXJlGiISIGyVi9n2pbJhuoXyE4k+SzPKpL0eb2nENXNUWaN0i/eLKkBluzmx84WCkzLkFo+XtYzpuqR5t8aJXf8Y55XoNhSPT79UAvwSMWLbKy2C9GXORQb5hCHye1cOaT11zisssKMA"
          }
        }
      }
    ]
  },
  "IsRm": false,
  "Metadata": {
    "/": {
      "bytes": "gID0AQ"
    }
  },
  "Provider": "12D3KooWQWY5d9xp8on1cizKBdbscfKo1qcyovk7KwV9kKKXWpwK",
  "Signature": {
    "/": {
      "bytes": "CiQIARIg2k4OefnZgOzUQo0VQE5Yg9KubOpw3gTWHeQprfuidZISGy9pbmRleGVyL2luZ2VzdC9hZFNpZ25hdHVyZRoiEiARPrSzHMsp4L/L9zSmNQz2ooRAEznsM76n+BfkIewNlipA5Q3UW14STPAyTotfP7pHGseL1Yi8Bh5hf+X0yuYAAsIsRpnYQJKrAcWxQS+oGwQLa4pJ+NXCiro6M98Ey2SlBQ"
    }
  }
}
```

</details>
