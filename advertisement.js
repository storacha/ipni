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

export const SIG_DOMAIN = 'indexer'
export const AD_SIG_CODEC = new TextEncoder().encode('/indexer/ingest/adSignature')
export const EP_SIG_CODEC = new TextEncoder().encode('/indexer/ingest/extendedProviderSignature')

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
 * Encode and Sign IPNI Advertisment data.
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
   * Convert to IPLD shape
   */
  encode (provider = this.providers[0]) {
    /** @type {import('./schema').AdvertisementOutput} AdvertisementOutput */
    const value = {
      Provider: provider.peerId.toString(),
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
          ID: p.peerId.toString(),
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
  async encodeAndSign (provider = this.providers[0]) {
    // Advertisement signing
    const value = this.encode(provider)
    value.Signature = await sign(provider.peerId, this.signableBytes(provider), AD_SIG_CODEC)

    // Extended provider signing
    if (value.ExtendedProvider) {
      const { Providers } = value.ExtendedProvider
      for (let i = 0; i < Providers.length; i++) {
        const p = this.providers[i]
        Providers[i].Signature = await sign(p.peerId, p.signableBytes(this), EP_SIG_CODEC)
      }
    }
  }

  /**
   * Serialise the fields use for signing the Advertisement
   */
  signableBytes (provider = this.providers[0]) {
    const isRm = this.remove ? 1 : 0
    return concat([
      this.previous?.bytes ?? new Uint8Array(),
      this.entries.bytes,
      provider.peerId.toBytes(),
      ...provider.addresses.map(a => a.bytes),
      provider.encodeMetadata(),
      new Uint8Array(isRm)
    ])
  }
}
