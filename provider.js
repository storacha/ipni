import { createFromJSON } from '@libp2p/peer-id-factory'
import { multiaddr } from '@multiformats/multiaddr'
import { concat } from 'uint8arrays/concat'
import { encode } from '@ipld/dag-cbor'
import varint from 'varint'

/**
 * @typedef {import('@libp2p/interface-peer-id').PeerId} PeerId
 * @typedef {import('@multiformats/multiaddr').Multiaddr} Multiaddr
 * @typedef {import('multiformats').Link } Link
 *
 * @typedef {object} GraphsyncMetadata
 * @prop {Link} pieceCid
 * @prop {boolean} verifiedDeal
 * @prop {boolean} fastRetrieval
 */

// see: https://github.com/ipni/specs/blob/main/IPNI.md#metadata
export const GRAPHSYNC_PREFIX = new Uint8Array(varint.encode(0x0910))
export const BITSWAP_PREFIX = new Uint8Array(varint.encode(0x900))
export const HTTP_PREFIX = new Uint8Array(varint.encode(0x3D0000))

/**
 * Define where and how your entries can be fetched.
 */
export class Provider {
  /**
   * @param {PeerId} peerId
   * @param {Multiaddr[]|string[]|Multiaddr|string} addresses
   * @param {'bitswap' | 'http' | 'graphsync'} protocol - transfer protocol available
   * @param {GraphsyncMetadata} [metadata]
   */
  constructor (peerId, addresses, protocol, metadata) {
    if (!protocol) {
      throw new Error('protocol is required')
    }
    if (!addresses) {
      throw new Error('addresses is required')
    }
    if (!peerId) {
      throw new Error('peerId is required')
    }
    if (protocol !== 'bitswap' && protocol !== 'http' && protocol !== 'graphsync') {
      throw new Error(`Unknown protocol ${protocol}. Must be one of http, bitswap, graphsync`)
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
   * Serialise the fields used to sign an ExtndedProvider record
   * note: peerId and multiaddr string bytes are signed rather than using their byte encodings!
   * impl: https://github.com/ipni/go-libipni/blob/afe2d8ea45b86c2a22f756ee521741c8f99675e5/ingest/schema/envelope.go#L125
   * spec: https://github.com/ipni/specs/blob/main/IPNI.md#extendedprovider
   * @param {import('./advertisement').Advertisement} ad
   **/
  signableBytes (ad) {
    const text = new TextEncoder()
    const providerOveride = ad.override ? 1 : 0
    return concat([
      ad.previous?.bytes ?? new Uint8Array(),
      ad.entries.bytes,
      text.encode(ad.providers[0].peerId.toCID().toString()),
      ad.context,
      text.encode(this.peerId.toCID().toString()),
      text.encode(this.addresses.map(a => a.toString()).join('')),
      this.encodeMetadata(),
      new Uint8Array([providerOveride])
    ])
  }
}

/**
 * @param {object} config
 * @param {string} config.id - peerID
 * @param {string} config.pubKey - public key string
 * @param {string} config.privKey - private key string
 * @param {string[] | string} config.addresses - multiaddrs provider announces
 * @param {'bitswap' | 'http' | 'graphsync'} config.protocol - protocol available
 */
export async function createProvider ({ id, pubKey, privKey, addresses, protocol }) {
  const peerId = await createFromJSON({ id, pubKey, privKey })
  return new Provider(peerId, addresses, protocol)
}
