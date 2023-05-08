import test from 'ava'
import { CID } from 'multiformats/cid'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { Provider, HTTP_PREFIX, BITSWAP_PREFIX } from '../provider.js'
import { Advertisement } from '../advertisement.js'

test('one provider', async t => {
  const peerId = await createEd25519PeerId()
  const addrs = ['/dns4/example.org/tcp/443/https']
  const protocol = 'http'
  const entries = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354')
  const context = new Uint8Array([99])
  const ad = new Advertisement(
    [new Provider(peerId, addrs, protocol)],
    // @ts-expect-error
    entries,
    context
  )
  const encoded = ad.encode()
  t.like(encoded, {
    Provider: peerId.toString(),
    Addresses: addrs,
    Signature: new Uint8Array(),
    Entries: entries,
    ContextID: context,
    Metadata: HTTP_PREFIX,
    IsRm: false
  })
})

test('extended providers', async t => {
  const bitswap = new Provider(await createEd25519PeerId(), '/ip4/12.34.56.78/tcp/999/ws', 'bitswap')
  const http = new Provider(await createEd25519PeerId(), '/dns4/example.org/tcp/443/https', 'http')
  const graph = new Provider(await createEd25519PeerId(), '/ip4/120.0.0.1/tcp/999/ws', 'graphsync', {
    pieceCid: CID.parse('QmeUdoMyahuQUPHS2odrZEL6yk2HnNfBJ147BeLXsZuqLJ'),
    fastRetrieval: true,
    verifiedDeal: true
  })
  const entries = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354')
  const context = new Uint8Array([99])
  const ad = new Advertisement(
    [bitswap, http, graph],
    // @ts-expect-error
    entries,
    context
  )
  const encoded = ad.encode()
  t.like(encoded, {
    Provider: bitswap.peerId.toString(),
    Addresses: [bitswap.addresses[0].toString()],
    Signature: new Uint8Array(),
    Entries: entries,
    ContextID: context,
    Metadata: BITSWAP_PREFIX,
    IsRm: false,
    ExtendedProvider: {
      Override: false
    }
  })
  t.like(encoded.ExtendedProvider?.Providers[0], {
    ID: bitswap.peerId.toString(),
    Addresses: [bitswap.addresses[0].toString()],
    Metadata: BITSWAP_PREFIX,
    Signature: new Uint8Array()
  })
  t.like(encoded.ExtendedProvider?.Providers[1], {
    ID: http.peerId.toString(),
    Addresses: [http.addresses[0].toString()],
    Metadata: HTTP_PREFIX,
    Signature: new Uint8Array()
  })
  t.like(encoded.ExtendedProvider?.Providers[2], {
    ID: graph.peerId.toString(),
    Addresses: [graph.addresses[0].toString()],
    // Metadata: GRAPHSYNC_PREFIX +...,
    Signature: new Uint8Array()
  })
})
