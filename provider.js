import { multiaddr } from '@multiformats/multiaddr'
import { concat } from 'uint8arrays/concat'
import { encode } from '@ipld/dag-cbor'
import varint from 'varint'

/**
 * @typedef {import('./schema').Link } Link
 * @typedef {import('@libp2p/interface-peer-id').PeerId} PeerId
 * @typedef {import('@multiformats/multiaddr').Multiaddr} Multiaddr
 *
 * @typedef {object} GraphsyncMetadata
 * @prop {Link} pieceCid
 * @prop {boolean} verifiedDeal
 * @prop {boolean} fastRetrieval
 */


/**
 * transport-bitswap
 * @see https://github.com/multiformats/multicodec/blob/df81972d764f30da4ad32e1e5b778d8b619de477/table.csv?plain=1#L145
 */
export const BITSWAP_PREFIX = new Uint8Array(varint.encode(0x900))

/**
 * transport-graphsync-filecoinv1
 * @see https://github.com/multiformats/multicodec/blob/df81972d764f30da4ad32e1e5b778d8b619de477/table.csv?plain=1#L146
 */
export const GRAPHSYNC_PREFIX = new Uint8Array(varint.encode(0x0910))

/**
 * transport-ipfs-gateway-http
 * @see https://github.com/multiformats/multicodec/blob/df81972d764f30da4ad32e1e5b778d8b619de477/table.csv?plain=1#L147 */
export const HTTP_PREFIX = new Uint8Array(varint.encode(0x0920))

/**
 * Define where and how your entries can be fetched.
 */
export class Provider {
  /**
   * @param {object} config
   * @param {PeerId} config.peerId
   * @param {Multiaddr[]|string[]|Multiaddr|string} config.addresses
   * @param {'bitswap' | 'http' | 'graphsync'} config.protocol - transfer protocol available
   * @param {GraphsyncMetadata} [config.metadata]
   */
  constructor ({ peerId, addresses, protocol, metadata }) {
    if (!protocol || !addresses || !peerId) {
      throw new Error('protocol, addresses, and peerId are required')
    }
    if (protocol !== 'bitswap' && protocol !== 'http' && protocol !== 'graphsync') {
      throw new Error(`unknown protocol ${protocol}. Must be one of http, bitswap, graphsync`)
    }
    if (protocol === 'graphsync' && !metadata) {
      throw new Error('graphsync metadata is required')
    }
    this.addresses = Array.isArray(addresses) ? addresses.map(m => multiaddr(m)) : [multiaddr(addresses)]
    this.protocol = protocol
    this.peerId = peerId
    this.metadata = metadata
  }

  /**
  * @param {'bitswap' | 'http' | 'graphsync'} protocol
  * @param {GraphsyncMetadata} [metadata] - required if protocol is `graphsync`
  */
  encodeMetadata (protocol = this.protocol, metadata = this.metadata) {
    if (protocol === 'http') return HTTP_PREFIX
    if (protocol === 'bitswap') return BITSWAP_PREFIX
    if (protocol === 'graphsync') {
      if (!metadata) throw new Error('metadata is required')
      const bytes = encode({
        PieceCID: metadata.pieceCid,
        VerifiedDeal: metadata.verifiedDeal,
        FastRetrieval: metadata.fastRetrieval
      })
      return concat([GRAPHSYNC_PREFIX, bytes])
    }
    throw new Error(`Unknown protocol ${protocol}. Must be one of http, bitswap, graphsync`)
  }

  /**
   * Serialize the fields used to sign an ExtendedProvider record
   * note: peerId and multiaddr string bytes are signed rather than using their byte encodings!
   * impl: https://github.com/ipni/go-libipni/blob/afe2d8ea45b86c2a22f756ee521741c8f99675e5/ingest/schema/envelope.go#L125
   * spec: https://github.com/ipni/specs/blob/main/IPNI.md#extendedprovider
   * @param {import('./advertisement').Advertisement} ad
   **/
  signableBytes (ad) {
    const text = new TextEncoder()
    const providerOverride = ad.override ? 1 : 0
    return concat([
      ad.previous?.bytes ?? new Uint8Array(),
      ad.entries.bytes,
      text.encode(ad.providers[0].peerId.toString()),
      ad.context,
      text.encode(this.peerId.toString()),
      text.encode(this.addresses.map(a => a.toString()).join('')),
      this.encodeMetadata(),
      new Uint8Array([providerOverride])
    ])
  }
}
