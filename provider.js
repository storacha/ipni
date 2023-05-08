import { createFromJSON } from '@libp2p/peer-id-factory'
import { multiaddr } from '@multiformats/multiaddr'
import { concat } from 'uint8arrays/concat'
import { encode } from '@ipld/dag-cbor'
import varint from 'varint'

// see: https://github.com/ipni/specs/blob/main/IPNI.md#metadata
export const GRAPHSYNC_METADATA = varint.encode(0x0910)
export const BITSWAP_METADATA = varint.encode(0x900)
export const HTTP_METADATA = varint.encode(0x3D0000)

/**
 * @typedef {import('@libp2p/interface-peer-id').PeerId} PeerId
 * @typedef {import('@multiformats/multiaddr').Multiaddr} Multiaddr
 * @typedef {import('multiformats').Link } Link
 * @typedef {Uint8Array} Bytes
 * @typedef {Uint8Array} Metadata
 */

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
  const addrs = Array.isArray(addresses) ? addresses.map(m => multiaddr(m)) : [multiaddr(addresses)]
  return new Provider(peerId, addrs, protocol)
}

export class Provider {
  /**
   * @param {PeerId} peerId
   * @param {Multiaddr[]} addresses
   * @param {'bitswap' | 'http' | 'graphsync'} protocol - transfer protocol available
   */
  constructor (peerId, addresses, protocol) {
    if (protocol !== 'bitswap' && protocol !== 'http' && protocol !== 'graphsync') {
      throw new Error(`Unknown protocol ${protocol}. Must be one of http, bitswap, graphsync`)
    }
    this.peerId = peerId
    this.addresses = addresses
    this.protocol = protocol
  }

  /**
   * @param {object} [options]
   * @param {Link} [options.pieceCid]
   * @param {boolean} [options.verifiedDeal]
   * @param {boolean} [options.fastRetrieval]
   */
  metadata ({ pieceCid, verifiedDeal, fastRetrieval } = {}) {
    if (this.protocol === 'http') return HTTP_METADATA
    if (this.protocol === 'bitswap') return BITSWAP_METADATA
    if (this.protocol === 'graphsync') {
      const data = encode({
        PieceCID: pieceCid,
        VerifiedDeal: verifiedDeal,
        FastRetrieval: fastRetrieval
      })
      return concat([GRAPHSYNC_METADATA, data])
    }
  }

  /**
   * @param {import('./advertisement').Advertisement} ad
   **/
  signableBytes (ad) {
    const providerOverride = ad.override ? 1 : 0
    return concat([
      ad.previous?.bytes ?? new Uint8Array(),
      ad.entries.bytes,
      ad.providers[0].peerId.toBytes(),
      ad.context,
      this.peerId.toBytes(),
      ...this.addresses.map(a => a.bytes),
      this.metadata(),
      new Uint8Array(providerOverride)
    ])
  }
}
