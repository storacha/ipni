import { CID } from 'multiformats/cid'
import { sha256 } from 'multiformats/hashes/sha2'
import { concat } from 'uint8arrays/concat'
import { RecordEnvelope } from '@libp2p/peer-record'
/**
 * @typedef {import('./schema').Link } Link
 * @typedef {import('./provider').Provider } Provider
 * @typedef {import('@libp2p/interface-peer-id').PeerId} PeerId
 * @typedef {import('@multiformats/multiaddr').Multiaddr} Multiaddr
 * @typedef {Uint8Array} Bytes
 * @typedef {Uint8Array} Metadata
 */

// libp2p signed Envelope details
// see: https://github.com/ipni/go-libipni/blob/afe2d8ea45b86c2a22f756ee521741c8f99675e5/ingest/schema/envelope.go#L20-L22
// see: https://github.com/libp2p/js-libp2p-peer-record/blob/master/README.md#envelope
export const AD_SIG_CODEC = new TextEncoder().encode('/indexer/ingest/adSignature')
export const EP_SIG_CODEC = new TextEncoder().encode('/indexer/ingest/extendedProviderSignature')
export const SIG_DOMAIN = 'indexer'

// instead of making Entries optional there is a magic CID, a stubby 16 byte sha256 of empty bytes
// https://github.com/ipni/go-libipni/blob/81286e4b32baed09e6151ce4f8e763f449b81331/ingest/schema/schema.go#L64-L69
export const NO_ENTRIES = CID.parse('bafkreehdwdcefgh4dqkjv67uzcmw7oje')

// an empty byte array signifies no context should be applied
export const NO_CONTEXT = new Uint8Array()

// maximum number of bytes accepted as Advertisement.ContextID.
export const MAX_CONTEXT_ID_LENGTH = 64

/**
 * Sign the serialized form of an Advertisement or a Provider
 * @param {PeerId} peerId
 * @param {Uint8Array} bytes - bytes to sign
 * @param {AD_SIG_CODEC|EP_SIG_CODEC} codec - envelope record codec
 */
export async function sign (peerId, bytes, codec) {
  const payload = await hashSignableBytes(bytes)
  const record = {
    codec,
    domain: SIG_DOMAIN,
    marshal: () => payload,
    equals: () => { throw new Error('Not implemented') }
  }
  const sealed = await RecordEnvelope.seal(record, peerId)
  return sealed.marshal()
}

/**
 * `sign` must take the sha-256 multihash of the signable bytes and sign that.
 * see: https://github.com/ipni/go-libipni/blob/81286e4b32baed09e6151ce4f8e763f449b81331/ingest/schema/envelope.go#L119
 * @param {Uint8Array} bytes
 */
export async function hashSignableBytes (bytes) {
  const digest = await sha256.digest(bytes)
  return digest.bytes
}

/**
 * Encode and Sign IPNI Advertisement data.
 */
export class Advertisement {
  /**
   * @param {object} config
   * @param {Link | null} config.previous - CID of previous Advertisement
   * @param {Provider[]|Provider} config.providers - Array of Provider info where entries are available
   * @param {Link | null} config.entries - CID for an EntryBatch, an array of content multihashes you're providing
   * @param {Bytes | null} config.context - A custom id used to group subsets of advertisements
   * @param {boolean} [config.remove] - true if this represents entries that are no longer retrievable.
   * @param {boolean} [config.override] - true if the extended providers specified should be used instead of any previously announced without a context.
   */
  constructor ({ previous, providers, context, entries, remove = false, override = false }) {
    if (!providers) {
      throw new Error('providers are required')
    }
    if (entries === undefined) {
      throw new Error('entries must be set. To specify no entries pass null')
    }
    if (entries !== null && CID.asCID(entries) === null) {
      throw new Error('entries must be an instance of CID')
    }
    if (context === undefined) {
      throw new Error('context must be set. To specify no context pass null')
    }
    if (previous === undefined) {
      throw new Error('previous must be set. If this is your first advertisement pass null')
    }
    if (previous !== null && CID.asCID(previous) === null) {
      throw new Error('previous must be an instance of CID')
    }
    if (context !== null && context.byteLength > MAX_CONTEXT_ID_LENGTH) {
      throw new Error(`context must be less than ${MAX_CONTEXT_ID_LENGTH} bytes`)
    }
    this.providers = Array.isArray(providers) ? providers : [providers]
    this.previous = CID.asCID(previous)
    this.entries = CID.asCID(entries) ?? NO_ENTRIES
    this.context = context ?? NO_CONTEXT
    this.remove = remove
    this.override = override
    if (this.remove && this.providers.length > 1) {
      // see: https://github.com/ipni/go-libipni/blob/afe2d8ea45b86c2a22f756ee521741c8f99675e5/ingest/schema/envelope.go#L126-L127
      throw new Error('remove may only be true when there is a single provider. IsRm is not supported for ExtendedProvider advertisements')
    }
    if (this.override && (this.context.byteLength === 0 || this.providers.length < 2)) {
      throw new Error('override may only be true when a context is set and more than 1 provider')
    }
  }

  /**
   * Convert to IPLD shape and sign
   */
  async encodeAndSign () {
    const ad = this
    const provider = ad.providers[0]

    /** @type {import('./schema').AdvertisementOutput} AdvertisementOutput */
    const value = {
      Provider: provider.peerId.toString(),
      Addresses: provider.addresses.map(a => a.toString()),
      Signature: await sign(provider.peerId, ad.signableBytes(), AD_SIG_CODEC),
      Entries: ad.entries,
      ContextID: ad.context,
      Metadata: provider.encodeMetadata(),
      IsRm: ad.remove
    }
    if (ad.previous) {
      value.PreviousID = ad.previous
    }
    // ExtendedProvider mode!
    if (ad.providers.length > 1) {
      const Providers = []
      for (const p of ad.providers) {
        Providers.push({
          ID: p.peerId.toString(),
          Addresses: p.addresses.map(a => a.toString()),
          Metadata: p.encodeMetadata(),
          Signature: await sign(p.peerId, p.signableBytes(ad), EP_SIG_CODEC)
        })
      }
      value.ExtendedProvider = {
        Providers,
        Override: ad.override
      }
    }
    return value
  }

  /**
   * Serialize the fields use for signing the Advertisement
   * note: peerId and multiaddr string bytes are signed rather than using their byte encodings!
   * impl: https://github.com/ipni/go-libipni/blob/afe2d8ea45b86c2a22f756ee521741c8f99675e5/ingest/schema/envelope.go#L84
   */
  signableBytes () {
    const text = new TextEncoder()
    const ad = this
    const provider = this.providers[0]
    const IsRm = ad.remove ? 1 : 0
    return concat([
      ad.previous?.bytes ?? new Uint8Array(),
      ad.entries.bytes,
      text.encode(provider.peerId.toString()),
      text.encode(provider.addresses.map(a => a.toString()).join('')),
      provider.encodeMetadata(),
      new Uint8Array([IsRm])
    ])
  }
}

/**
 * Advertise that **all** past and future entries in this chain are now
 * available from a new, additional provider by specifying the root provider
 * and the additional providers along with no context id and no entries cid.
 *
 * To advertise that subset of entries are available from additional providers
 * specify the relevant context id to identify that group.
 *
 * Note: it is not yet possible to unannounce an extended provider once announced.
 * see: https://github.com/ipni/storetheindex/issues/1745
 *
 * @param {object} config
 * @param {Link | null} config.previous - CID of previous Advertisement
 * @param {Provider[]} config.providers - Two or more Provider objects where entries are available
 * @param {Bytes | null} [config.context] - A custom id used to group subsets of advertisements
 * @param {boolean} [config.override] - true if the providers should be used instead of any previously announced without a context.
 */
export function createExtendedProviderAd ({ previous, providers, context = null, override = false }) {
  if (!providers || !Array.isArray(providers) || providers.length < 2) {
    throw new Error('at least 2 providers are required, the root provider and the new extended provider')
  }
  return new Advertisement({ previous, providers, entries: null, context, override })
}
