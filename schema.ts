import type { Link } from 'multiformats'
import type { PeerId } from '@libp2p/interface-peer-id'
import type { Multiaddr } from '@multiformats/multiaddr'

export type Bytes = Uint8Array

export interface Advertisement {
  /** Link to the previous advertisement */
  PreviousID?: Link
  
  /** Host that provide this advertisement */
  Provider: PeerId

  /** Multiaddrs for the Provider */
  Addresses: Multiaddr[]

  /** Link to an interlinked chain of EntryChunk nodes, or an IPLD HAMT ADL, where the keys in the map represent the multihashes and the values are `true` */
  Entries: Link

  /** unique id for the collection of advertised multihashes. */
  ContextID: Bytes

  /** Metadata captures contextual information about how to retrieve the advertised content */
  Metadata: Bytes

  /** does this advertisement represents content that has been removed */
  IsRm: boolean

  /** Host(s) that provide this advertisement. Takes precedent over the top level Provider and Addresses fields */
  ExtendedProvider?: ExtendedProvider
}

/** An additional set of providers where the ad entries are available from */
export interface ExtendedProvider {
  /** list of providers where the ad entries are available from */
  Providers: Provider []

  /** Override defines mechanics for extending chain-level extended providers */
  Override: boolean
}

// Provider contains details of a peer where ad entries are available from
interface Provider {
  /** peer ID of the Provider */
  ID: PeerId

  /** Addresses is a list of multiaddresses of the Provider */
  Addresses: Multiaddr[]

  /* Details how to retrieve the advertised content */
  Metadata: Bytes
}


// EntryChunk captures a chunk in a chain of entries that collectively contain the multihashes
// advertised by an Advertisement.
export interface EntryChunkOutput {
  // Entries represent the list of multihashes in this chunk.
  Entries: Bytes[]
  // Next is an optional link to the next entry chunk. 
  Next?: Link
}

// Provider contains details of a peer where ad entries are available from
interface ProviderOutput {
  // ID is a peer ID of the Provider 
  ID: string
  // Addresses is a list of multiaddresses of the Provider
  Addresses: string[]
  // Metadata captures contextual information about how to retrieve the advertised content.
  Metadata: Bytes
  // Signature is created by each provider with their corresponding private key
  // * The full advertisement object is serialized, with all instances of Signature replaced with an empty array of bytes.
  // * This serialization is then hashed, and the hash is then signed.
  // * The Provider from the encapsulating advertisement must be present in the Providers of the ExtendedProvider object, 
  //   and must sign in this way as well. It may omit Metadata and Addresses if they match the values already set at the encapsulating advertisement. However, Signature must be present.
  Signature: Bytes
}

// ExtendedProvider specifies an additional set of providers where the ad entries are available from
export interface ExtendedProviderOutput {
  // Providers is an additional list of providers where the ad entries are available from
  Providers: ProviderOutput []
  // Override defines mechanics for extending chain-level extended providers in the following way:
  // * If Override is set on an ExtendedProvider entry on an advertisement with a ContextID, it indicates that any specified chain-level 
  //   set of providers should not be returned for that context ID. Providers will be returned Instead.
  // * If Override is not set on an entry for an advertisement with a ContextID, it will be combined as a union with any chain-level ExtendedProviders (Addresses, Metadata).
  // * If Override is set on ExtendedProvider for an advertisement without a ContextID, the entry is invalid and should be ignored.
  Override: boolean
}

// Advertisement signals availability of content to the indexer nodes in form of a chunked list of 
// multihashes, where to retrieve them from, and over protocol they are retrievable.
export interface AdvertisementOutput {
    // PreviousID is an optional link to the previous advertisement.
    PreviousID?: Link
    // Provider is the peer ID of the host that provides this advertisement.
    Provider: string
    // Addresses is the list of multiaddrs as strings from which the advertised content is retrievable.
    Addresses: string[]
    // Signature is the signature of this advertisement.
    Signature: Bytes
    // Entries is a link to a data structure that contains the advertised multihashes.
    // The data structure can either be:
    //  * an interlinked chain of EntryChunk nodes, or 
    //  * an IPLD HAMT ADL, where the keys in the map represent the multihashes and the values are 
    //    simply set to true.
    //
    // See: 
    //  * https://ipld.io/specs/advanced-data-layouts/hamt/spec
    //  * https://ipld.io/specs/advanced-data-layouts/hamt/spec///use-as-a-set
    Entries: Link
    // ContextID is the unique identifier for the collection of advertised multihashes.
    // If a Provider listing is written with no ContextID and IsRm=false, peers from ExtendedProvider 
    // will be returned for all advertisements published by the publisher.
    ContextID: Bytes
    // Metadata captures contextual information about how to retrieve the advertised content.
    Metadata: Bytes
    // IsRm specifies whether this advertisement represents the content are no longer retrievalbe fom the provider.
    IsRm: boolean
    // ExtendedProvider might optionally specify a set of providers where the ad entries are available from. 
    // See: https://github.com/ipni/storetheindex/blob/main/doc/ingest.md//extendedprovider
    ExtendedProvider?: ExtendedProvider
}

