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

// instead of making Entires optional there is a magic CID, a stubby 16 byte sha256 of empty bytes
// https://github.com/ipni/go-libipni/blob/81286e4b32baed09e6151ce4f8e763f449b81331/ingest/schema/schema.go#L64-L69
export const NO_ENTRIES = CID.parse('bafkreehdwdcefgh4dqkjv67uzcmw7oje')

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
   * @param {Provider[]|Provider} config.providers
   * @param {Link} [config.entries]
   * @param {Bytes} config.context
   * @param {Link | null} config.previous
   * @param {boolean} [config.remove]
   * @param {boolean} [config.override]
   */
  constructor ({ previous, providers, context, entries = NO_ENTRIES, remove = false, override = false }) {
    if (!providers || !entries || !context) {
      throw new Error('providers and context are required')
    }
    if (previous === undefined) {
      throw new Error('previous must be set. If this is your first advertisement pass null')
    }
    this.previous = previous
    this.providers = Array.isArray(providers) ? providers : [providers]
    this.entries = entries
    this.context = context
    this.remove = remove
    this.override = override
  }

  /**
   * Convert to IPLD shape and sign
   */
  async encodeAndSign () {
    const ad = this
    const provider = ad.providers[0]

    if (ad.remove && ad.providers.length > 1) {
      // see: https://github.com/ipni/go-libipni/blob/afe2d8ea45b86c2a22f756ee521741c8f99675e5/ingest/schema/envelope.go#L126-L127
      throw new Error('rm ads are not supported for extended provider signatures')
    }

    /** @type {import('./schema').AdvertisementOutput} AdvertisementOutput */
    const value = {
      Provider: provider.peerId.toString(),
      Addresses: provider.addresses.map(a => a.toString()),
      Signature: await sign(provider.peerId, ad.signableBytes(), AD_SIG_CODEC),
      Entries: this.entries,
      ContextID: this.context,
      Metadata: provider.encodeMetadata(),
      IsRm: this.remove
    }
    if (this.previous) {
      value.PreviousID = this.previous
    }
    // ExtendedProvider mode!
    if (this.providers.length > 1) {
      const Providers = []
      for (const p of this.providers) {
        Providers.push({
          ID: p.peerId.toString(),
          Addresses: p.addresses.map(a => a.toString()),
          Metadata: p.encodeMetadata(),
          Signature: await sign(p.peerId, p.signableBytes(ad), EP_SIG_CODEC)
        })
      }
      value.ExtendedProvider = {
        Providers,
        Override: this.override
      }
    }
    return value
  }

  /**
   * Serialize the fields use for signing the Advertisement
   * note: peerId and multiaddr string bytes are signed rather than using their byte encodings!
   * impl: https://github.com/ipni/go-libipni/blob/afe2d8ea45b86c2a22f756ee521741c8f99675e5/ingest/schema/envelope.go#L84
   * spec: https://github.com/ipni/specs/blob/main/IPNI.md#extendedprovider
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
