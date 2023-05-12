# IPNI Background

IPNI is the InterPlanetary Network Indexer (https://ipni.io/)

> a content routing system optimized to take billions of CIDs from large-scale data providers, and allow fast lookup of provider information using these CIDs over a simple HTTP REST API.
> – https://github.com/ipni

You can look up any web3.storage hosted cid via [https://cid.contact](https://cid.contact/cid/bafybeidluj5ub7okodgg5v6l4x3nytpivvcouuxgzuioa6vodg3xt2uqle)

It gives you enough info to know who to connect to and what protocol to use to fetch the bytes for that CID.

```sh
curl https://cid.contact/cid/bafybeidluj5ub7okodgg5v6l4x3nytpivvcouuxgzuioa6vodg3xt2uqle | jq
```

```json
{
  "MultihashResults": [
    {
      "Multihash": "EiBrontA/cpwzG7Xy+X23E3orUTqUubNEOB6rhm3eeqQWQ==",
      "ProviderResults": [
        {
          "ContextID": "AXESIKh/3PQkIATBPajt5iCX/WI0cXmT3OP056vui7L+xe/R",
          "Metadata": "kBKjaFBpZWNlQ0lE2CpYKAABgeIDkiAgz64SZ/fTuarQ9EXvlGt9gtLxS+1fV7ehz13mGD0W2xJsVmVyaWZpZWREZWFs9W1GYXN0UmV0cmlldmFs9Q==",
          "Provider": {
            "ID": "12D3KooWAWcPeDRjFMasZ9D7yfr2Znh3kefPUuyVb66DsM3A72oz",
            "Addrs": [
              "/ip4/1.214.241.108/tcp/30000"
            ]
          }
        },
        {
          "ContextID": "YmFndXFlZXJhaGN2M2VhczJrcGE0eTdoc2F5N3BwM3J3dGoyc3R5dnltb3Z6bXBjdnFpeTNpcGZyMzN3cQ==",
          "Metadata": "gBI=",
          "Provider": {
            "ID": "QmQzqxhK82kAmKvARFZSkUVS6fo9sySaiogAnx5EnZ6ZmC",
            "Addrs": [
              "/dns4/elastic.dag.house/tcp/443/wss"
            ]
          }
        }
      ]
    }
  ]
}
```

### How do I get on the list?

To get your CIDs on that list, you need to publish Advertisements to an indexer node.

An IPNI Advertisement is a IPLD object that specifies

- A link to a batch of multihashes for the CIDs you are providing
- The details of how to get them including:
  - **PeerID** - _so you can verify them_
  - a set of **multiaddrs** - _so you can connect to them_
  - the **protocol** to use - _so you know how they like to be spoken to_

There is an IPLD Schema for a valid Advertisement that you can use to verify your docs are the right shape and values have the right type. This library uses it [here](https://github.com/web3-storage/ipni/blob/b00c02f3cc34e65400c664ee6fe68ff50f28a72e/test/advertisement.test.js#L11-L12)

### Where do i sign!?

Advertisements are **Signed** with the private key for the PeerID for the provider.

They have a custom encoded form to decide what bytes to sign:
```js
  return concat([
    ad.previous?.bytes ?? new Uint8Array(),
    ad.entries.bytes,
    text.encode(provider.peerId.toString()),
    text.encode(provider.addresses.map(a => a.toString()).join('')),
    provider.encodeMetadata(),
    new Uint8Array([IsRm])
  ])
```

You then sha-256 multihash encode those bytes sign the multihash bytes as a [libp2p Envelope](https://github.com/libp2p/specs/pull/217), as originally spec'd by @yusefnapora

https://github.com/web3-storage/ipni/blob/b00c02f3cc34e65400c664ee6fe68ff50f28a72e/advertisement.js#L31-L41


### But I'm a big deal, I provide many things from many nodes

Of course. You'll want the ExtendedProvider advertisement form.

Originally you could only specify a single provider as the source for CIDs. Now you can announce that you can provide them via Bitswap, HTTP and Graphsync all at once!

You just have to duplicate the root level provider info into an ExtendedProviders.Providers array, and add a Provider record for each one.

They must each be signed with the private key for that provider PeerID. And they have a custom encoded form!

https://github.com/web3-storage/ipni/blob/b00c02f3cc34e65400c664ee6fe68ff50f28a72e/provider.js#L75-L88