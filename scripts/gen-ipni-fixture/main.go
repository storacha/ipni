package main

import (
	"encoding/base64"
	"os"

	"github.com/ipld/go-ipld-prime/codec/dagjson"
	"github.com/ipni/index-provider/engine/xproviders"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/multiformats/go-multiaddr"
)

func main() {
	provider := mustNewProviderInfo(
		"QmVRvNE5oikD3aPkNfCLufvwQPsjvwYiwxS4PyAktTU2fM",
		"CAASqAkwggSkAgEAAoIBAQDAVBkdP8VR72bWmtugfzEcWOkC8FCvS9WlgT05bedleDxLYhUZuNmlyd2e4SPrXx6SRJeoRZ/Cs8YZ/tz5Api/4inytCZl1fG3VVpeKXRv4bpkxcl0ZXWMLwT2vxxXtTXq/3yaUMVIelqxRWLK58PzBsbeDydWMcMfxta2z7Mp1sUQmcQ1nNk5HjWetVXrPW6/RtfvcLLU6FHw3nROOFye8qbg+KH697DJZOLgroJwzmCxvstaIsLs1G7z2hZt7/oWoiMbC/lGMwzYBRKxiEK7LA/28qnY1VIxMO9x1MWke5Su1NBlHl5EfiFPGXmKyIzkW80CCxHKek9M+YEM0G5LAgMBAAECggEACnjpzypoQ6BeAKR4/gG++lSrB2JvekQOU484draRyXglDFPAY2Cp1TmrLBoFOy04PG2otlxoKRFh4Yt7m8F08MnPT+xYROZD3aAzpfnq4aawYAlXAVP+9Q2gXxEj6XCwCWY08jAgteQXqRxmlzbMeCCv1mqL0UkvXz0T9utTTZ1QTb7+q48zNkUrI5uNkbnrTGzwvH9TK+zvBLOB9iIM3rvFaOWV1lENdRJ8SafC4WTCeucImC/0OMPFaBfwKxx1W/UqfdWf7LHyuuMoFgEDYvvnXslUjzyuzlGVEjPVGeKHKQ1sNQclolNvvD0Ee+HpwEBDKF7tcMMz0kkTWYCSDQKBgQD7kj8rBUIE7DckWUDjKEKmMkf+lhlNNzgyW6lvOrTxPN5vD2kcE95sMX9VrvoYFxjmjCNfGXaGcIJrgQDHGrA2rbwzNYTYHDORhkIMkmHpVpJ7BPy3rueHLDjQflS8M6hi1F+gEzLtrvg5t/TwRQg2pgfj6lNyO4UAjjBQrGdUPwKBgQDDttzYo1NZV5mq87HYEpxNNP2eKz6ruQNO/hZgLKgvdfnzjAvLNZ/wHKdK011bmNQ57dRGrncxIpyJroLGKDJZrDkoZBEZwIPhjxtM6pgQJdfu7YjObto9usyehKurDX5J4U2I0DnyQQJ5h87vlEbfnI5Gz1OiBRDimY+SsGey9QKBgQCzvzjXGjijn8t+cy9Dnv6QFRkPtFt7qlrC0G9tg/rI6v7bR52IbEHd+DfNFuqmz8oA4FxdlKn1QOpOuau+lzkUuGniBPlYGD5YWh9TMDw5Jpwevd97tsLC+DvX7IvKtPY5NxjkHROkdAHz65ZdHlXSBitZE5Jv6ksLrIyk96oUrQKBgC6lctWfd8ofetyn4IdjSCWOr7P3EqTTH9q/7I1Xl25YbA6EHnt8eHY+HhFTdzjRoCN+b82432eynCSklz6rbfS5e5YI45qDq+sitJsMftm6a1DjBGxPN2znDMXrUQ8f1C2/qT8mgekfXXuhxsyLRqkdIzv1RjWjh3a6quGHce/RAoGBAJfIMpLI9LJnvu6HQ7F8zAUOMKDHvOuBsmWPKUkI1PPzrAD5XbeASvAq+iKPMWQ5ipsrL4M+cakBs9iKpaUtwWTKCIxr37l09V8wUVwto3lbMwYy55ZwoNX8czRq8K1uwW7qToCuG4Dij1RhxV0aGDsx829oJmRl4dLZ8Zd1NjDR",
		"/ip4/12.34.56.78/tcp/999/ws",
		"gBI",
	)

	extendedProviders := []xproviders.Info{
		provider,
		mustNewProviderInfo(
			"QmTkkmVimdmeZVxULqfJj99UB2uHSp33eMQ5LoEF8FMPLC",
			"CAASpwkwggSjAgEAAoIBAQCTK1c21lGcPN16/9KJyzmATCgKOAotEpssVLVyd968m5bnkMAq++daG63ku+CN7lkb9P29+b+dw7GIe8ImW1/NwFY8S2D/SKySWEXdESuavJIvHmUZKwfxRam4Rn4ddfvAX9KDmgp8oRxnY9Pp6fX4lWTKWGXTaxLvjQXQW8KgPJr68hV559or6s6viaKORExkWgbJIzFn07IqrKLoCz8O2PiR36elGK11DFA5lHT226u57NMM61x7WwQ1dfbBaW3Gjc6Ow1oQHfhgnYEPa/oTnQUkS8B95fjiEme6zaveMNATqsc+uG0+tqZtwmsgBQjMFhDKnWAY0fmJ1K7nPDsNAgMBAAECggEAfHdkTIGYBf5IBtXDtzxERmiiWHoqyRH6YNTHnKcanwMr7m6yx+fCM6hDOrdW5FLX1FgwHfLSh1hRlq+sdQpEjVwE0vuhbmaFZUP42k3CRh0DuYwITu/gyMJ1Ft+vm7UEFSA1h43JHryXrC12tVdk6zdWRffbLqJZInZvm1dv1FoFGjIXk8y4j8U7UFiprBhReCThxsAZwTdenEXDgt8iu1dzPsUwUtpjt9tkQNNDD8Vrp00ylB57hXiK8ynPUvyPxB0aq47W+tn/rqZlihOaqWfq0swBDjV5N8+EWV6QLU4Z4jhdVRY28DEbCCt6eIqWZo0MAhZyYsxm4UA+lsxsIQKBgQDCsI8gA6HZOZIjTaJhkKCqe5giD3RYgH22qvK94KZVoBWuhQvQjD4LEbpAUbTPAYRur0wUq2N/V5XnVcgwz9yVkJ7dogdThPD4lA3k4ZKK/Br7RM5Fuyq8XR3IMW73br+Kfh77b3BEyV2+trCcDmPQtD/5GiVDl0LfJYY3rj+aOQKBgQDBg8vDNOF1M43PyyK4Kcxq4Brfcqcb0Cih3/yzSYydrLxNl3SVf2dyPKzs0QuyfRwHjvMKPdBqdAwNy4rc6Jqzp79m5sT3ANGHPAX9o/UwWM8U8y9edNSFkTSedgJBMMBxycOJWWyeKxs2WNUGIyvYPHlqfhdPipzTopfzJEy3dQKBgBt2xqnweTtoeKoMQJTczx1dlAdyAKqfbZyAHwAUGcLIc2aMFC+WKQZsuMZsAEKXZzQp/GSKDN4g39+jZTslh2t93DtNqRTqEwgt8ovQGlkK2U+K1EJX9d5ekF32Qz4aXGDQC9TSUpcRhOzrXpyVFxWQ59lfC9SuGNvbskRWi1hZAoGAD0iRd0Fd7Ru9P4QToefrNSWt+afcet3d16sREjfk2y8hUB9+HbCKQwN3xNxdyCMJa69mkpB/PWkc6poAxaG5VicRftcLB1cRNVUQRBAG9WKOOGFchGFFx6bIORuo4e0vxczhnJ9rbLKK26f4axusAtAD5t0+ihGwgSZ+Sb28MWECgYEArvX1Y1ZdoAzhEVtQMI5F7BW6km5KzQnWuXusyhFwut+KYpUYYqIhVRfvuUOEYowQjy0S+3HjmEhZwgc1zbKamy8Axxx6//LPFOAx5nhWFesrADQCDH4VPa8rFXnGxgfkEqe4xNSIW9WOoY/6cheY7rwqtT8pfnTZ0AGVomoihuQ=",
			"/ip4/12.34.56.78/tcp/999/ws",
			"gBI",
		),
	}

	contextID, err := base64.StdEncoding.DecodeString("YmFndXFlZXJhNHZkNXR5Ymd4YXViNGVsd2FnNnY3eWhzd2hmbGZ5b3BvZ3I3cjMyYjdkcHQ1bXFmbW1vcQ==")
	if err != nil {
		panic(err)
	}

	addrs := []multiaddr.Multiaddr{mustParseMultiaddr(provider.Addrs[0])}

	advert, err := xproviders.NewAdBuilder(mustDecodePeerID(provider.ID), provider.Priv, addrs).
		WithContextID(contextID).
		WithMetadata(provider.Metadata).
		WithOverride(false).
		WithExtendedProviders(extendedProviders...).
		BuildAndSign()

	if err != nil {
		panic(err)
	}

	n, err := advert.ToNode()
	if err != nil {
		panic(err)
	}

	dagjson.Encode(n, os.Stdout)
}

func mustDecodePeerID(str string) peer.ID {
	id, err := peer.Decode(str)
	if err != nil {
		panic(err)
	}
	return id
}

func mustParseMultiaddr(str string) multiaddr.Multiaddr {
	addr, err := multiaddr.NewMultiaddr(str)
	if err != nil {
		panic(err)
	}
	return addr
}

func mustNewProviderInfo(peerID string, b64priv string, addr string, meta string) xproviders.Info {
	providerID := mustDecodePeerID(peerID)

	privbytes, err := base64.StdEncoding.DecodeString(b64priv)
	if err != nil {
		panic(err)
	}

	priv, err := crypto.UnmarshalPrivateKey(privbytes)
	if err != nil {
		panic(err)
	}

	addrs := []multiaddr.Multiaddr{mustParseMultiaddr(addr)}

	metabytes, err := base64.RawStdEncoding.DecodeString(meta)
	if err != nil {
		panic(err)
	}

	return xproviders.NewInfo(providerID, priv, metabytes, addrs)
}
