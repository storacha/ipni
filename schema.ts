import type { Link } from 'multiformats'
export type Bytes = Uint8Array

/** Captures a chunk in a chain of entries advertised by an Advertisement */
export interface EntryChunkOutput {
  /** List of multihashes in this chunk */
  Entries: Bytes[]
  /** CID for the next entry chunk. */
  Next?: Link
}

/** Details for a peer that can provide the entries */
interface ProviderOutput {
  /** Peer ID uniquely identfies the Provider */
  ID: string
  
  /** Multiaddrs to connect to the Provider */
  Addresses: string[]
  
  /** Hints for how to retrieve the advertised content. For graphysnc it provides PieceID etc */
  Metadata: Bytes

  /** Custom serialised form of this Provider and the parent Advertisement signed with the private key of this Provider */
  Signature: Bytes
}

/** An additional set of providers where the ad entries are available from */
export interface ExtendedProviderOutput {
  /** list of providers where the ad entries are available from */
  Providers: ProviderOutput []

  /** 
   * Override defines mechanics for extending chain-level extended providers:
   *   If Override && ContextID: it indicates that any specified chain-level set of providers should not be returned for that context ID. Providers will be returned Instead.
   *   If !Override && ContextID: it will be combined as a union with any chain-level ExtendedProviders (Addresses, Metadata).
   *   If Override && !ContextID: entry is invalid and should be ignored.
   */
  Override: boolean
}

/** Advertisement ready for IPLD encoding */
export interface AdvertisementOutput {
    /** Link to the previous advertisement */
    PreviousID?: Link
    
    /** PeerID string for host that provides the entries */
    Provider: string

    /** Multiaddrs for the Provider */
    Addresses: string[]

    /** Signed bytes of custom serialised form of Advertisement properties */
    Signature: Bytes

    /** CID for chain of EntryChunk nodes, or an IPLD HAMT ADL, where the keys in the map represent the multihashes and the values are `true` */
    Entries: Link

    /** Unique id for collection of advertised multihashes. */
    ContextID: Bytes

    /** Captures contextual information about how to retrieve the advertised content */
    Metadata: Bytes

    /** Indicates the content has been removed when true */
    IsRm: boolean

    /** Announce additional hosts that provide the entries. N.B. Top level Provider fields must be present in Providers array */
    ExtendedProvider?: ExtendedProviderOutput
}
