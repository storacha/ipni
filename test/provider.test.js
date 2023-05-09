import test from 'ava'
import { CID } from 'multiformats/cid'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { Provider, HTTP_PREFIX, BITSWAP_PREFIX, GRAPHSYNC_PREFIX } from '../provider.js'
import { Advertisement } from '../advertisement.js'

test('http', async t => {
  const hp = new Provider(
    await createEd25519PeerId(),
    '/dns4/example.org/tcp/443/https',
    'http'
  )
  const meta = hp.encodeMetadata()
  t.deepEqual(meta, HTTP_PREFIX)

  const entries = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354')
  const context = new Uint8Array([99])

  // @ts-expect-error
  const ad = new Advertisement([hp], entries, context)
  const sigBuf = hp.signableBytes(ad)

  // https://github.com/ipni/go-libipni/blob/afe2d8ea45b86c2a22f756ee521741c8f99675e5/ingest/schema/envelope.go#L99-L110
  t.deepEqual(sigBuf.slice(0, entries.byteLength), entries.bytes)

  let rest = sigBuf.slice(entries.byteLength)
  t.deepEqual(rest.slice(0, hp.peerId.toBytes().byteLength), hp.peerId.toBytes())

  rest = rest.slice(hp.peerId.toBytes().byteLength)
  const addrs = new TextEncoder().encode('/dns4/example.org/tcp/443/https')
  t.deepEqual(rest.slice(0, addrs.byteLength), addrs)

  rest = rest.slice(addrs.byteLength)
  t.deepEqual(rest.slice(0, meta.byteLength), meta)

  const isRm = new Uint8Array([0])
  rest = rest.slice(meta.byteLength)
  t.deepEqual(rest.slice(0, isRm.byteLength), isRm)
})

test('bitswap', async t => {
  const bp = new Provider(
    await createEd25519PeerId(),
    '/ip4/12.34.56.78/tcp/999/ws',
    'bitswap'
  )
  const meta = bp.encodeMetadata()
  t.deepEqual(meta, BITSWAP_PREFIX)
})

test('graphsync', async t => {
  const gp = new Provider(
    await createEd25519PeerId(),
    '/ip4/12.34.56.78/tcp/999/ws',
    'graphsync',
    {
      pieceCid: CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354'),
      fastRetrieval: true,
      verifiedDeal: true
    }
  )
  const meta = gp.encodeMetadata()
  t.deepEqual(meta.slice(0, 2), GRAPHSYNC_PREFIX)
})
