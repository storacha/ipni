import test from 'ava'
import { CID } from 'multiformats/cid'
import { createEd25519PeerId, createFromJSON } from '@libp2p/peer-id-factory'
import { parse as parseSchema } from 'ipld-schema'
import { create as createValidator } from 'ipld-schema-validator'
import { readFile } from 'fs/promises'
import { Provider, HTTP_PREFIX, BITSWAP_PREFIX, GRAPHSYNC_PREFIX } from '../provider.js'
import { Advertisement, hashSignableBytes, createExtendedProviderAd } from '../advertisement.js'
import { encode, decode } from '@ipld/dag-json'

const schema = await readFile('schema.ipldsch', { encoding: 'utf8' })
const adValidator = createValidator(parseSchema(schema), 'Advertisement')

test('one provider', async t => {
  const peerId = await createEd25519PeerId()
  const addresses = ['/dns4/example.org/tcp/443/https']
  const protocol = 'http'
  const entries = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354')
  const context = new Uint8Array([99])
  const provider = new Provider({ peerId, addresses, protocol })
  const ad = new Advertisement({ providers: [provider], entries, context, previous: null })
  const encoded = await ad.encodeAndSign()
  t.like(encoded, {
    Provider: peerId.toString(),
    Addresses: addresses,
    Entries: entries,
    ContextID: context,
    Metadata: HTTP_PREFIX,
    IsRm: false
  })
  t.falsy(encoded.PreviousID, 'previous is not set')
  t.true(adValidator(encoded), 'encoded form matches IPLD schema')
})

test('hashed sigBuf length', async t => {
  const peerId = await createEd25519PeerId()
  const addresses = ['/dns4/example.org/tcp/443/https']
  const protocol = 'http'
  const entries = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354')
  const context = new Uint8Array([99])
  const provider = new Provider({ peerId, addresses, protocol })
  const ad = new Advertisement({ providers: [provider], entries, context, previous: null })
  const hashed = await hashSignableBytes(ad.signableBytes())
  // the hashed signable bytes should be 34 bytes long
  // see: https://github.com/ipni/go-libipni/blob/81286e4b32baed09e6151ce4f8e763f449b81331/ingest/schema/envelope.go#L260-L262
  t.is(hashed.length, 34)
})

test('previous', async t => {
  const previous = CID.parse('baguqeerac3sm46p47bkdubg7tv7spipp2pmwj4og44evcp766wwffwnhhtsa')
  const peerId = await createEd25519PeerId()
  const addresses = ['/dns4/example.org/tcp/443/https']
  const protocol = 'http'
  const entries = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354')
  const context = new Uint8Array([99])
  const provider = new Provider({ peerId, addresses, protocol })

  t.throws(
    // @ts-expect-error testing that forgetting to set previous is an error
    () => new Advertisement({ providers: [provider], entries, context }),
    { message: 'previous must be set. If this is your first advertisement pass null' }
  )

  const ad = new Advertisement({ providers: [provider], entries, context, previous })
  const encoded = await ad.encodeAndSign()
  t.is(encoded.PreviousID?.toString(), previous.toString(), 'previous is set')
  t.true(adValidator(encoded), 'encoded form matches IPLD schema')
})

test('extended providers', async t => {
  const bitswap = new Provider({ protocol: 'bitswap', addresses: '/ip4/12.34.56.78/tcp/999/ws', peerId: await createEd25519PeerId() })
  const http = new Provider({ protocol: 'http', addresses: '/dns4/example.org/tcp/443/https', peerId: await createEd25519PeerId() })
  const graph = new Provider({
    protocol: 'graphsync',
    addresses: '/ip4/120.0.0.1/tcp/999/ws',
    peerId: await createEd25519PeerId(),
    metadata: {
      pieceCid: CID.parse('QmeUdoMyahuQUPHS2odrZEL6yk2HnNfBJ147BeLXsZuqLJ'),
      fastRetrieval: true,
      verifiedDeal: true
    }
  })
  const entries = CID.parse('bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354')
  const context = new Uint8Array([99])
  const ad = new Advertisement({ providers: [bitswap, http, graph], entries, context, previous: null })
  const encoded = await ad.encodeAndSign()
  t.like(encoded, {
    Provider: bitswap.peerId.toString(),
    Addresses: [bitswap.addresses[0].toString()],
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
    Metadata: BITSWAP_PREFIX
  })
  t.like(encoded.ExtendedProvider?.Providers[1], {
    ID: http.peerId.toString(),
    Addresses: [http.addresses[0].toString()],
    Metadata: HTTP_PREFIX
  })
  t.like(encoded.ExtendedProvider?.Providers[2], {
    ID: graph.peerId.toString(),
    Addresses: [graph.addresses[0].toString()]
  })
  t.deepEqual(encoded.ExtendedProvider?.Providers[2].Metadata.slice(0, GRAPHSYNC_PREFIX.byteLength), GRAPHSYNC_PREFIX)
  t.true(adValidator(encoded), 'encoded form matches IPLD schema')
})

test('extended provider interop', async t => {
  const expected = JSON.parse(await readFile('test/fixtures/ad-3/ad.json', { encoding: 'utf-8' }))
  const p1 = new Provider({
    protocol: 'bitswap',
    addresses: expected.ExtendedProvider.Providers[0].Addresses,
    peerId: await loadPeerId('test/fixtures/ad-1/peerId.json')
  })
  const p2 = new Provider({
    protocol: 'bitswap',
    addresses: expected.ExtendedProvider.Providers[1].Addresses,
    peerId: await loadPeerId('test/fixtures/ad-2/peerId.json')
  })
  const context = Buffer.from(expected.ContextID['/'].bytes, 'base64')
  const ad = new Advertisement({ providers: [p1, p2], context, entries: null, previous: null })
  const value = await ad.encodeAndSign()
  t.deepEqual(decode(encode(value)), decode(encode(expected)))
})

test('parity with publisher-lambda no previous', async t => {
  const expected = JSON.parse(await readFile('test/fixtures/ad-1/ad.json', { encoding: 'utf-8' }))
  const entries = CID.parse(expected.Entries['/'])
  const context = Buffer.from(expected.ContextID['/'].bytes, 'base64')
  const peerId = await createFromJSON(JSON.parse(await readFile('test/fixtures/ad-1/peerId.json', { encoding: 'utf-8' })))
  const providers = new Provider({ protocol: 'bitswap', addresses: expected.Addresses, peerId })
  const previous = null
  const ad = new Advertisement({ previous, providers, entries, context })
  const value = await ad.encodeAndSign()

  t.deepEqual(decode(encode(value)), decode(encode(expected)))

  // note: there is no (reasonable) way to get encoded byte parity with the old publisher-lambda!
  // it used base64pad strings for ContextID bytes, which we can't recreate with typedarrays.
  // see: https://github.com/ipld/js-dag-json/issues/106
  // see: https://github.com/elastic-ipfs/publisher-lambda/blob/8a71991792a7baf27bd02599316b5c01c23a6280/src/handlers/advertisement.js#L190
  // const adCid = CID.createV1(dagJsonCode, await sha256.digest(encode(value)))
  // t.is(adCid.toString(), 'baguqeera2s55wh2lzxeu2sszjq4tcs5lm6yhpy65bcwxvqk6w3dpmir73yia')
})

test('parity with publisher-lambda with previous', async t => {
  const expected = JSON.parse(await readFile('test/fixtures/ad-2/ad.json', { encoding: 'utf-8' }))
  const entries = CID.parse(expected.Entries['/'])
  const context = Buffer.from(expected.ContextID['/'].bytes, 'base64')
  const peerId = await loadPeerId('test/fixtures/ad-2/peerId.json')
  const providers = new Provider({ protocol: 'bitswap', addresses: expected.Addresses, peerId })
  const previous = CID.parse(expected.PreviousID['/'])
  const ad = new Advertisement({ previous, providers, entries, context })
  const value = await ad.encodeAndSign()

  t.deepEqual(decode(encode(value)), decode(encode(expected)))

  // const adCid = CID.createV1(dagJsonCode, await sha256.digest(encode(value)))
  // t.is(adCid.toString(), 'baguqeeracy3dyhdtqxo2wqcvekr6zbdsztjw54uqezjvrnadyrfnpvwzcxta')
})

test('createExtendedProviderAd helper', async t => {
  const message = 'at least 2 providers are required, the root provider and the new extended provider'
  const provider = new Provider({
    protocol: 'http',
    addresses: '/dns4/example.org/tcp/443/https',
    peerId: await createEd25519PeerId()
  })
  // @ts-expect-error
  t.throws(() => createExtendedProviderAd({ previous: null }), { message })
  // @ts-expect-error
  t.throws(() => createExtendedProviderAd({ providers: provider, previous: null }), { message })

  t.throws(() => createExtendedProviderAd({ providers: [provider], previous: null }), { message })

  const ad = createExtendedProviderAd({ providers: [provider, provider], previous: null })
  const value = await ad.encodeAndSign()
  t.is(value.ExtendedProvider?.Providers.length, 2)
})

test('max context id length', async t => {
  // see: https://github.com/ipni/go-libipni/blob/b6e9a9def00b2db19aa4a3bc5fc33b3b1575530e/ingest/schema/schema.go#L18-L19
  const providers = new Provider({
    protocol: 'http',
    addresses: '/dns4/example.org/tcp/443/https',
    peerId: await createEd25519PeerId()
  })
  t.throws(
    () => new Advertisement({ previous: null, context: new Uint8Array(65).fill(1), providers, entries: null }),
    { message: 'context must be less than 64 bytes' }
  )
  const ad = new Advertisement({ previous: null, context: new Uint8Array(64).fill(1), providers, entries: null })
  const value = await ad.encodeAndSign()
  t.deepEqual(value.ContextID, new Uint8Array(64).fill(1))
})

test('override', async t => {
  // see: https://github.com/ipni/go-libipni/blob/b6e9a9def00b2db19aa4a3bc5fc33b3b1575530e/ingest/schema/schema.go#L18-L19
  const provider = new Provider({
    protocol: 'http',
    addresses: '/dns4/example.org/tcp/443/https',
    peerId: await createEd25519PeerId()
  })
  const providers = [provider, provider]
  const entries = null
  const previous = null
  const override = true
  t.throws(
    () => new Advertisement({ previous, context: null, override, providers, entries }),
    { message: 'override may only be true when a context is set and more than 1 provider' }
  )

  t.throws(
    () => new Advertisement({ previous, context: new Uint8Array(), override, providers, entries }),
    { message: 'override may only be true when a context is set and more than 1 provider' }
  )

  t.throws(
    () => new Advertisement({ previous, context: new Uint8Array(1).fill(1), override, providers: provider, entries }),
    { message: 'override may only be true when a context is set and more than 1 provider' }
  )

  const ad = new Advertisement({ previous, context: new Uint8Array(1).fill(1), override, providers, entries })
  const value = await ad.encodeAndSign()
  t.true(value.ExtendedProvider?.Override)
})

test('remove', async t => {
  // see: https://github.com/ipni/go-libipni/blob/b6e9a9def00b2db19aa4a3bc5fc33b3b1575530e/ingest/schema/schema.go#L18-L19
  const provider = new Provider({
    protocol: 'http',
    addresses: '/dns4/example.org/tcp/443/https',
    peerId: await createEd25519PeerId()
  })
  const previous = null
  const context = null
  const entries = null
  const remove = true
  t.throws(
    () => new Advertisement({ remove, previous, context, providers: [provider, provider], entries }),
    { message: 'remove may only be true when there is a single provider. IsRm is not supported for ExtendedProvider advertisements' }
  )

  const ad = new Advertisement({ remove, previous, context, providers: provider, entries })
  const value = await ad.encodeAndSign()
  t.true(value.IsRm)
})

/**
 * @param {string} path
 */
async function loadPeerId (path) {
  return await createFromJSON(JSON.parse(await readFile(path, { encoding: 'utf-8' })))
}
