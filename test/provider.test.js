import test from 'ava'
import { CID } from 'multiformats/cid'
import { createEd25519PeerId } from '@libp2p/peer-id-factory'
import { Provider, HTTP_PREFIX, BITSWAP_PREFIX, GRAPHSYNC_PREFIX } from '../provider.js'

test('http', async t => {
  const hp = new Provider(
    await createEd25519PeerId(),
    '/dns4/example.org/tcp/443/https',
    'http'
  )
  const meta = hp.encodeMetadata()
  t.deepEqual(meta, HTTP_PREFIX)
})

test('bitswap', async t => {
  const hp = new Provider(
    await createEd25519PeerId(),
    '/ip4/12.34.56.78/tcp/999/ws',
    'bitswap'
  )
  const meta = hp.encodeMetadata()
  t.deepEqual(meta, BITSWAP_PREFIX)
})

test('graphsync', async t => {
  const hp = new Provider(
    await createEd25519PeerId(),
    '/ip4/12.34.56.78/tcp/999/ws',
    'graphsync',
    {
      pieceCid: CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354'),
      fastRetrieval: true,
      verifiedDeal: true
    }
  )
  const meta = hp.encodeMetadata()
  t.deepEqual(meta.slice(0, 2), GRAPHSYNC_PREFIX)
})
