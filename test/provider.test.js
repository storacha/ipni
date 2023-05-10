import test from 'ava'
import { CID } from 'multiformats/cid'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { Provider, HTTP_PREFIX, BITSWAP_PREFIX, GRAPHSYNC_PREFIX } from '../provider.js'
import { Advertisement } from '../advertisement.js'

test('http', async t => {
  const peerId = await createEd25519PeerId()
  const addresses = '/dns4/example.org/tcp/443/https'
  const hp = new Provider({ protocol: 'http', peerId, addresses })

  const meta = hp.encodeMetadata()
  t.deepEqual(meta, HTTP_PREFIX)

  const entries = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354')
  const context = new Uint8Array([99])

  const ad = new Advertisement({ providers: hp, entries, context, previous: null })
  const sigBuf = hp.signableBytes(ad)

  // https://github.com/ipni/go-libipni/blob/afe2d8ea45b86c2a22f756ee521741c8f99675e5/ingest/schema/envelope.go#L99-L110
  t.deepEqual(sigBuf.slice(0, entries.byteLength), entries.bytes)
  let rest = sigBuf.slice(entries.byteLength)

  const rootId = new TextEncoder().encode(ad.providers[0].peerId.toCID().toString())
  t.deepEqual(rest.slice(0, rootId.byteLength), rootId)
  rest = rest.slice(rootId.byteLength)

  t.deepEqual(rest.slice(0, context.byteLength), context)
  rest = rest.slice(context.byteLength)

  const provId = new TextEncoder().encode(hp.peerId.toCID().toString())
  t.deepEqual(rest.slice(0, provId.byteLength), provId)
  rest = rest.slice(provId.byteLength)

  const addrs = new TextEncoder().encode('/dns4/example.org/tcp/443/https')
  t.deepEqual(rest.slice(0, addrs.byteLength), addrs)
  rest = rest.slice(addrs.byteLength)

  t.deepEqual(rest.slice(0, meta.byteLength), meta)
  rest = rest.slice(meta.byteLength)

  const isRm = new Uint8Array([0])
  t.deepEqual(rest.slice(0, isRm.byteLength), isRm)
})

test('bitswap', async t => {
  const bp = new Provider({
    protocol: 'bitswap',
    addresses: '/ip4/12.34.56.78/tcp/999/ws',
    peerId: await createEd25519PeerId()
  })
  const meta = bp.encodeMetadata()
  t.deepEqual(meta, BITSWAP_PREFIX)
})

test('graphsync', async t => {
  const metadata = {
    pieceCid: CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354'),
    fastRetrieval: true,
    verifiedDeal: true
  }
  const gp = new Provider({
    protocol: 'graphsync',
    addresses: '/ip4/12.34.56.78/tcp/999/ws',
    peerId: await createEd25519PeerId(),
    metadata
  })

  const metadataBytes = gp.encodeMetadata()
  t.deepEqual(metadataBytes.slice(0, 2), GRAPHSYNC_PREFIX)
})
