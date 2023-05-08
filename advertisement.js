import { CID } from 'multiformats/cid'
import { multiaddr } from '@multiformats/multiaddr'
import { sha256 } from 'multiformats/hashes/sha2'
import { concat } from 'uint8arrays/concat'
import varint from 'varint'

// see: https://github.com/ipni/specs/blob/main/IPNI.md#metadata
export const GRAPHSYNC_METADATA = varint.encode(0x0910)
export const BITSWAP_METADATA = varint.encode(0x900)
export const HTTP_METADATA = varint.encode(0x3D0000)

/**
 * @typedef {import('@libp2p/interface-peer-id').PeerId} PeerId
 * @typedef {import('@multiformats/multiaddr').Multiaddr} Multiaddr
 * @typedef {import('multiformats').Link } Link
 * @typedef {import('./provider').Provider } Provider
 * @typedef {Uint8Array} Bytes
 * @typedef {Uint8Array} Metadata
 */

/**
 * Signals availability of content to indexer nodes
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

  signableBytes () {
    const isRm = this.remove ? 1 : 0
    return concat([
      this.previous?.bytes ?? new Uint8Array(),
      this.entries.bytes,
      this.providers[0].peerId.toBytes(),
      ...this.providers[0].addresses.map(a => a.bytes),
      this.providers[0].metadata(),
      new Uint8Array(isRm)
    ])
  }

  /**
   * @param {PeerId} peerId
   * @param {Uint8Array} bytes - bytes to sign
   */
  async sign (peerId, bytes) {
    const digest = await sha256.digest(bytes)
    const payload = digest.bytes
    const sealed = await Envelope.seal(
      {
        domain: Buffer.from('indexer', 'utf-8'),
        codec: Buffer.from('/indexer/ingest/adSignature', 'utf-8'),
        marshal: () => payload
      },
      peerId
    )
    return sealed.marshal()
  }

  async signAndExport () {
    await this.sign(this.providers[0].peerId, this.signableBytes())
    if (this.providers.length > 1) {
      for (const p of this.providers) {
        await this.sign(p.peerId, p.signableBytes(this))
      }
    }
  }

  export () {
    const topProvider = this.providers[0]
    const value = {
      ...(this.previous ? { PreviousID: this.previous } : {}),
      Provider: topProvider.peerId.toString(),
      Addresses: topProvider.addresses.map(a => a.toString()),
      Signature: this.sign(),
      Entries: this.entries,
      ContextID: this.context,
      Metadata: topProvider.metadata(),
      IsRm: this.remove,
      ExtendedProvider: {
        Providers: this.providers.map(p => ({
          ID: p.peerId.toString(),
          Addresses: p.addresses.map(a => a.toString()),
          Metadata: p.metadata(),
          Signature: p.sign()
        })),
        Override: this.override
      }
    }
  }
}

// export class Provider {
//   /**
//    * @param {PeerId} peerId
//    * @param {Multiaddr[]} addresses
//    * @param {Metadata} metadata
//    */
//   constructor (peerId, addresses, metadata) {
//     this.peerId = peerId
//     this.addresses = addresses
//     this.metadata = metadata
//   }

//   /** @param {Advertisement} ad */
//   async sign (ad) {
//     const providerOverride = ad.override ? 1 : 0
//     const sigBuf = concat([
//       ad.previous?.bytes ?? new Uint8Array(),
//       ad.entries.bytes,
//       ad.providers[0].peerId.toBytes(),
//       ad.context,
//       this.peerId.toBytes(),
//       ...this.addresses.map(a => a.bytes),
//       this.metadata,
//       new Uint8Array(providerOverride)
//     ])

//     this.signature = sigBuf
//   }
// }

// /**
//  * @param {PeerId} peerId
//  * @param {Multiaddr[]} addresses
//  */
// export function HttpProvider (peerId, addresses) {
//   return new Provider(peerId, addresses, HTTP_METADATA)
// }

// /**
//  * @param {PeerId} peerId
//  * @param {Multiaddr[]} addresses
//  */
// export function BitswapProvider (peerId, addresses) {
//   return new Provider(peerId, addresses, BITSWAP_METADATA)
// }
