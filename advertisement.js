import { sha256 } from 'multiformats/hashes/sha2'
import { concat } from 'uint8arrays/concat'
import { RecordEnvelope } from '@libp2p/peer-record'
/**
 * @typedef {import('./provider').Provider } Provider
 * @typedef {import('@libp2p/interface-peer-id').PeerId} PeerId
 * @typedef {import('@multiformats/multiaddr').Multiaddr} Multiaddr
 * @typedef {import('multiformats').Link } Link
 * @typedef {Uint8Array} Bytes
 * @typedef {Uint8Array} Metadata
 */

// libp2p signed Envelope details
// see: https://github.com/ipni/go-libipni/blob/afe2d8ea45b86c2a22f756ee521741c8f99675e5/ingest/schema/envelope.go#L20-L22
// see: https://github.com/libp2p/js-libp2p-peer-record/blob/master/README.md#envelope
export const AD_SIG_CODEC = new TextEncoder().encode('/indexer/ingest/adSignature')
export const EP_SIG_CODEC = new TextEncoder().encode('/indexer/ingest/extendedProviderSignature')
export const SIG_DOMAIN = 'indexer'

/**
 * Sign the serialised form of an Advertisement or a Provider
 * @param {PeerId} peerId
 * @param {Uint8Array} bytes - bytes to sign
 * @param {AD_SIG_CODEC|EP_SIG_CODEC} codec - envelope record codec
 */
export async function sign (peerId, bytes, codec) {
  const digest = await sha256.digest(bytes)
  const payload = digest.bytes // TODO: is bytes? or digest?
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
 * Encode and Sign IPNI Advertisement data.
 */
export class Advertisement {
  /**
   * @param {Provider[]} providers
   * @param {Link} entries
   * @param {Bytes} context
   * @param {object} [options]
   * @param {Link} [options.previous]
   * @param {boolean} [options.remove]
   * @param {boolean} [options.override]
   */
  constructor (providers, entries, context, options) {
    this.providers = providers
    this.entries = entries
    this.context = context
    this.previous = options?.previous
    this.remove = options?.remove || false
    this.override = options?.override || false
  }

  /**
   * Convert to IPLD shape, defined by scheama.ipldsch
   * see: https://github.com/ipni/go-libipni/blob/main/ingest/schema/schema.ipldsch
   */
  encode () {
    const provider = this.providers[0]
    /** @type {import('./schema').AdvertisementOutput} AdvertisementOutput */
    const value = {
      Provider: provider.peerId.toCID().toString(),
      Addresses: provider.addresses.map(a => a.toString()),
      Signature: new Uint8Array(),
      Entries: this.entries,
      ContextID: this.context,
      Metadata: provider.encodeMetadata(),
      IsRm: this.remove
    }
    if (this.previous) {
      value.PreviousID = this.previous
    }
    if (this.providers.length > 1) {
      value.ExtendedProvider = {
        Override: this.override,
        Providers: this.providers.map(p => ({
          ID: p.peerId.toCID().toString(),
          Addresses: p.addresses.map(a => a.toString()),
          Metadata: p.encodeMetadata(),
          Signature: new Uint8Array()
        }))
      }
    }
    return value
  }

  /**
   * Convert to IPLD shape and sign
   */
  async encodeAndSign () {
    const ad = this
    const rootProvider = ad.providers[0]
    if (ad.remove && ad.providers.length > 1) {
      // see: https://github.com/ipni/go-libipni/blob/afe2d8ea45b86c2a22f756ee521741c8f99675e5/ingest/schema/envelope.go#L126-L127
      throw new Error('rm ads are not supported for extended provider signatures')
    }

    // IPLD shape with empty byte values for Signature properties
    const value = ad.encode()

    // Advertisement signing
    const sigBuf = ad.signableBytes()
    const adSig = await sign(rootProvider.peerId, sigBuf, AD_SIG_CODEC)
    // root Signature with the signed bytes for ad
    value.Signature = adSig

    if (value.ExtendedProvider) {
      const { Providers } = value.ExtendedProvider
      for (let i = 0; i < Providers.length; i++) {
        const prov = ad.providers[i]
        if (prov.peerId.toCID().toString() !== Providers[i].ID) {
          throw new Error('providers order should match encoded ExtendedProvider.Providers order')
        }

        // Extended provider signing
        const sigBuf = prov.signableBytes(ad)
        const providerSig = await sign(prov.peerId, sigBuf, EP_SIG_CODEC)
        // update ExtendedProvider.Provider[].Signature with the signed bytes for Provider
        Providers[i].Signature = providerSig
      }
    }
    return value
  }

  /**
   * Serialise the fields use for signing the Advertisement
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
      text.encode(provider.peerId.toCID().toString()),
      text.encode(provider.addresses.map(a => a.toString()).join('')),
      provider.encodeMetadata(),
      new Uint8Array([IsRm])
    ])
  }
}
