import test from 'ava'
import { CID } from 'multiformats/cid'
import { createEd25519PeerId, createFromJSON } from '@libp2p/peer-id-factory'
import { parse as parseSchema } from 'ipld-schema'
import { create as createValidator } from 'ipld-schema-validator'
import { readFile } from 'fs/promises'
import { Provider, HTTP_PREFIX, BITSWAP_PREFIX, GRAPHSYNC_PREFIX } from '../provider.js'
import { Advertisement } from '../advertisement.js'
import { encode, decode } from '@ipld/dag-json'

const schema = await readFile('schema.ipldsch', { encoding: 'utf8' })
const adValidator = createValidator(parseSchema(schema), 'Advertisement')

test('one provider', async t => {
  const peerId = await createEd25519PeerId()
  const addrs = ['/dns4/example.org/tcp/443/https']
  const protocol = 'http'
  const entries = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354')
  const context = new Uint8Array([99])
  const ad = new Advertisement(
    [new Provider(peerId, addrs, protocol)],
    // @ts-expect-error CID isn't currently compatible with Link!
    entries,
    context
  )
  const encoded = ad.encode()
  t.like(encoded, {
    Provider: peerId.toCID().toString(),
    Addresses: addrs,
    Signature: new Uint8Array(),
    Entries: entries,
    ContextID: context,
    Metadata: HTTP_PREFIX,
    IsRm: false
  })
  t.true(adValidator(encoded), 'encoded form matches IPLD schema')
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
    // @ts-expect-error CID isn't currently compatible with Link!
    entries,
    context
  )
  const encoded = ad.encode()
  t.like(encoded, {
    Provider: bitswap.peerId.toCID().toString(),
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
    ID: bitswap.peerId.toCID().toString(),
    Addresses: [bitswap.addresses[0].toString()],
    Metadata: BITSWAP_PREFIX,
    Signature: new Uint8Array()
  })
  t.like(encoded.ExtendedProvider?.Providers[1], {
    ID: http.peerId.toCID().toString(),
    Addresses: [http.addresses[0].toString()],
    Metadata: HTTP_PREFIX,
    Signature: new Uint8Array()
  })
  t.like(encoded.ExtendedProvider?.Providers[2], {
    ID: graph.peerId.toCID().toString(),
    Addresses: [graph.addresses[0].toString()],
    Signature: new Uint8Array()
  })
  t.deepEqual(encoded.ExtendedProvider?.Providers[2].Metadata.slice(0, GRAPHSYNC_PREFIX.byteLength), GRAPHSYNC_PREFIX)
  t.true(adValidator(encoded), 'encoded form matches IPLD schema')
})

test.skip('parity [requires local copy of peerId.json]', async t => {
  const expected = JSON.parse(await readFile('test/advertisement.json', { encoding: 'utf-8' }))
  const peerId = await createFromJSON(JSON.parse(await readFile('peerId.json', { encoding: 'utf-8' })))
  const provider = new Provider(peerId, '/dns4/elastic.dag.house/tcp/443/wss', 'bitswap')
  const entries = CID.parse('baguqeeraig6inklip3i5afj5neqy2r7mpixdg3ej6cwvg4wiyzc2s6dakeca')
  const context = Buffer.from('YmFndXFlZXJhaWc2aW5rbGlwM2k1YWZqNW5lcXkycjdtcGl4ZGczZWo2Y3d2ZzR3aXl6YzJzNmRha2VjYQ==', 'base64')
  const previous = CID.parse('baguqeerac3sm46p47bkdubg7tv7spipp2pmwj4og44evcp766wwffwnhhtsa')
  // @ts-expect-error CID isn't currently compatible with Link!
  const ad = new Advertisement([provider], entries, context, { previous })
  const value = await ad.encodeAndSign()
  t.deepEqual(decode(encode(value)), decode(encode(expected)))
})
