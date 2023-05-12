# ipni

> Create signed advertisements for the [InterPlanetary Network Indexer](https://github.com/ipni/specs/blob/main/IPNI.md)

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

Construct A Provider with the peerID and signing keys, and pass it to and Advertisement along with the entries CID, a context ID, and a CID for the previous batch of entries or `null` if this is the first advertisement in your chain.

Call `advertisement.signAndEncode()` to export a valid Advertisement ready for encoding as IPLD.

```js
import fs from 'node:fs/promises'
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

An `dag-json` encoded Advertisement (re-formated for readability):

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

Encode a signed advertisement with an Extended Providers section where the entries are available from multiple providers or different protocols. 

The first provider passed to the Advertisement constructor is used as the top level provider for older indexers that don't yet support the `ExtendedProvider` property.

```js
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
const graf = new Provider({ protocol: 'graphsync', addresses: ['/ip4/120.0.0.1/tcp/1234'], peerId: await createEd25519PeerId(),
  metadata: {
    pieceCid: CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354'),
    fastRetrieval: true,
    verifiedDeal: true
  }
})

// an advertisement with a single http provider
const advert = new Advertisement({ providers: [http, bits, graf], entries, context, previous })

// sign and export to IPLD form per schema
const value = await advert.encodeAndSign()

// encode with you favorite IPLD codec and share with indexer node
const block = await Block.encode({ value, codec: dagJson, hasher: sha256 })

// share with indexer
fs.writeFileSync(block.cid.toString(), block.bytes)
```

```json
{
  "Addresses": [
    "/dns4/dag.house/tcp/443/https"
  ],
  "ContextID": {
    "/": {
      "bytes": "Yw"
    }
  },
  "Entries": {
    "/": "baguqeera4vd5tybgxaub4elwag6v7yhswhflfyopogr7r32b7dpt5mqfmmoq"
  },
  "ExtendedProvider": {
    "Override": false,
    "Providers": [
      {
        "Addresses": [
          "/dns4/dag.house/tcp/443/https"
        ],
        "ID": "12D3KooWPPwQ99nqqBJhAYZnvicHDfx7o855fUzBVBVgBQ4PotMU",
        "Metadata": {
          "/": {
            "bytes": "gID0AQ"
          }
        },
        "Signature": {
          "/": {
            "bytes": "CiQIARIgycGrz1Pkp8va7HhAM0+MHumsG5MxgcpUJOeSBeyH1f8SKS9pbmRleGVyL2luZ2VzdC9leHRlbmRlZFByb3ZpZGVyU2lnbmF0dXJlGiISIBNXY+VA96CrdsbGe54bA7TGHgfB9z05ZzVApWVzdMOWKkD1sZAZVMkYAkugiqlDpiU1o1KkYCcmyA+ozWNOMgfvk7g3eDyIGP1oIHBUQuOcIYd0RB0VdV5/Kl1uV8KQKysJ"
          }
        }
      },
      {
        "Addresses": [
          "/ip4/12.34.56.1/tcp/999/ws"
        ],
        "ID": "12D3KooWLcR73mkaEfNy9i9nDq3NBqFZwBvnvZqVo1MUV6BAvfMB",
        "Metadata": {
          "/": {
            "bytes": "gBI"
          }
        },
        "Signature": {
          "/": {
            "bytes": "CiQIARIgoGDoEx0useLQEWElUSa7imb/59IygDSjK5qRKlRcSEISKS9pbmRleGVyL2luZ2VzdC9leHRlbmRlZFByb3ZpZGVyU2lnbmF0dXJlGiISIPP+xTvUwEfL4LrCnL+Pj79ARZ0bl6hBYpzZ4aFN48wFKkDI0GIqaUqQxaEgcE7WBVH+wdc6Ppp4WgKekTAV9RpniR7zprFobQdkHuFmnaepeSbOIBwyrL1ENGRbCxC94ykF"
          }
        }
      },
      {
        "Addresses": [
          "/ip4/120.0.0.1/tcp/1234"
        ],
        "ID": "12D3KooWShFBk7jQLFYAPrzeHmdL5nYgrrEfiyJFUJfhguCPUJq3",
        "Metadata": {
          "/": {
            "bytes": "kBKjaFBpZWNlQ0lE2CpYJQABcBIgWZSEOQZfKWGe9BKAy7kyvlLFbZnFlmtl4BESOfCYu+9sVmVyaWZpZWREZWFs9W1GYXN0UmV0cmlldmFs9Q"
          }
        },
        "Signature": {
          "/": {
            "bytes": "CiQIARIg+sO3dlJXJxqd/6oCcmOR3ZvhHQIfoqtoxnDx6n/amD4SKS9pbmRleGVyL2luZ2VzdC9leHRlbmRlZFByb3ZpZGVyU2lnbmF0dXJlGiISIAuLbadWtTs8Bhx1s/w1/BHsrAfwNMy1Y88O1LrrxtehKkA6OjXq4rgD07uZoHzZw4Sd4cGbgdIXBO1vB1Pag5FqcuhP4R3Hi0O9QpoPdzxlXDKHYYVS+vrNUzLGiT8/STgL"
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
  "Provider": "12D3KooWPPwQ99nqqBJhAYZnvicHDfx7o855fUzBVBVgBQ4PotMU",
  "Signature": {
    "/": {
      "bytes": "CiQIARIgycGrz1Pkp8va7HhAM0+MHumsG5MxgcpUJOeSBeyH1f8SGy9pbmRleGVyL2luZ2VzdC9hZFNpZ25hdHVyZRoiEiDoF5DFOpj4mxco1sWVnC6KEsjfd3yz9i47SS4NJAhSNCpAsn5C2HUI1K5/FtXZ8+Xcr6V4AGxstCMIudf6B3H3bGw3OcCfDOS01MgNyArtp9dW2XobykWhan7r2g/3VRYQDw"
    }
  }
}
```
