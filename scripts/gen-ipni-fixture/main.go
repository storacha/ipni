package main

import (
	"encoding/base64"
	"os"

	"github.com/ipfs/go-cid"
	"github.com/ipld/go-ipld-prime/codec/dagjson"
	cidlink "github.com/ipld/go-ipld-prime/linking/cid"
	"github.com/ipni/index-provider/engine/xproviders"
	"github.com/libp2p/go-libp2p/core/crypto"
	"github.com/libp2p/go-libp2p/core/peer"
	"github.com/multiformats/go-multiaddr"
)

func main() {
	provider := mustNewProviderInfo(
		"QmdZre8ojuCjqQMgfryVF7uXAz5kWFD1uzY5jiNfFrVUMP",
		"CAASqQkwggSlAgEAAoIBAQC5XofXmvS1Ui36YZla+LzOqO9zY5HvKSIo/sREe6UpSOnIT3topvYlYx4CUauAzdYX6kqikgt1E0x3iu8H8A15hoUew8xVKWUjsn1I1Oin2Z3iRrIlXXeN7TaDqcDgh6bUPrLekVxhf9wZfjwD3NkuCeZk24E0B5vVD98l8hmdOZl3PePI/yQ2UDtyf5xxI5ti4R+ihak5bPOLQrfSH0Reh/Jjq259UeY+c7gzdbZ4CiiZNLNkrFK+9Y5q47BRu+ACc9XF9Fcr3BxlGEXfTkZF8jmO+LN8Yh0PG1gZ4btx8ogZvBei2MNB5U/rBh3sLG6fThbEWoRp2FO8VF3Iix03AgMBAAECggEAS1VZi4vT62SMfvbvJgN0Z+BL/+71PebPlS2Egfhl9NNG/zseAjfoTOVtKrAaLOx6F5oF3u/PbDL9no99+RHbyAmdTBVykyGRkuJU/CZaruxHt8/XUkwb7Df9MaDpW9aFPDiG5ODaVF1sC4g7x64XLRik41Q5u/VjpUEgBQHQ2w38X7p77jE1EcPs5ZpmNIKyuQpJoVWQ6GF+AMIVk5bvRV5fKJjYJEGCvId6QGL/jeylaOIqoo1rDZMI9+oaPRV2/GLFhtIrlNrWoYHTi4vKl0KiVuQElxSenwEt5lwsKXMZyOSDk7X6FwarikkZdnYEf0s/2tXPSIbz5rp+QDS3kQKBgQD+Hqyi17xmIa2Q6jQxyEy4PBV7jm3aEKQLO3VDkRrM1FoumM7iA/HHMSIOgg467yCw9mW4zMm9StCD4qN58rly3jtevT14OZuKE0FhHr7bxDFubInvoxhEW4TtRpuVKS6TyVaUWhuMZYMOKB/0o72c8wR8UNDw42RW+wP9BCHHiwKBgQC6vaL2O7PcZ/DSnjdZXmqW1imFtXuADg9qbvt42f5YeLorJexmq4h2RNWk7UYIvfx8XpaU5NE1okyxsOrllRaSatmnwBwi/OD6UNXdVoKhjZBVs9EjDW4pouJcX6TINTP1RnlshXONNBMH/EGIgFvzlwdZEjsknw6UOHUugpmWhQKBgQCXqCbPaID/UsoK2jscGrXuna0UeAQHSDcenPV2xXqBE5pehMOzDzeT8TaqAeQMN/oCoopCp7UeSy/2BaQae0lBzG8SM04kGf1Bggxascal0YjOpegMJAGvig7irGjdtB4gBOCu2LfoKgz0ve2USsQ2jrH2nySTHqIbZuMSdQzT0QKBgQCSac0zsmu7C+PNvy82asi3qwKzSy+hn2SG1q1ke8boJwAQhJNtjGBaGm5H+aFHiW5FNQRriVxe6Pmo+EWz68je09gDpqRo6kya9nY4LHQPpqbcCziWexk8m/FO686PCufKD490fs2ykHm7cRUQqVNvEaM5OwoUFIGhxQJbjRpO4QKBgQCGDyqpqx+zCIE3dK8saygiU+dePYtt36EZ9GLrWTWf67IeuYVuBIFujqX04r3KCGGcgq438wfCinrhUyUXVZUuMTVEr03q1KVCpaxsuQrasFtO32jZA2Ky5IlUX4G4W3pCMsmtrBfGOZ1L//RhvdWRCyB0c5jeUkbNXmfxR8b2zA==",
		"/ip4/12.34.56.78/tcp/999/ws",
		"gBI",
	)

	extendedProviders := []xproviders.Info{
		provider,
		mustNewProviderInfo(
			"QmdStuHqfeTztnB3LBa7VUQD6Dw9kGiPtuGWP46mVxsPco",
			"CAASqAkwggSkAgEAAoIBAQCjsiDFrLsP8SkT63k4piz+yif7/7GtOeAF3s4eSQ7qxpr+JVOywNA+xr+S5rRAy9Mp6LcJB0cyWCZnXfZpjbx8zXG4iLl1P1Puj0EMryAFtDyn9K7M0LslndY1NTpJ4okzZ7YZt5CoLbNsrgyn0aH0dsXJJeTZ9ZqgumeSkLKP4f86/lMPDd1nJCXWE7/Wx8snYNnviSo3onE+XQRHwIWfOec0jlyh/QUJzHQ8flHgP6EEMGXudaEtRCgJAtdiKjU01g05VeUpiIXx0yemsxQIrt/yDwqD+TdzkQo1v4rrsMNrnDaOHlxAxgU9ceyMO49foRit1xWEH1Pfd/zyO5tpAgMBAAECggEAT7vJ/r8d9qvu6EcAKrm2nPx28WYgc1IHbpSSLWpEm9LVWAlydVU5mfpRAgrhrdYaKwWxcfJbmYgaXKsGBXAGaXvgcpQWUafhCAg7FSSQInciPGUQZ68cGTyCRDSDCc4QKjvQFUK2cVShWsSEYZHYoyzfNhUBHbFl+fgRzvAwKaiRphDbKYEQv3v8fVoMauYadrI5UYz3ZlVFYQCmxn8a1T8KlV3xbEu26p1CrVJldHIU2jOWL/X7e/wUfUoAofc8jNMhSn90xnlQHYwZqUFWDZcPHVD3BQ8f/uqGILHU31f67PMQt4pkVokhfxtIg1RmvXaQf2oVmU2CwB/zxzG7aQKBgQDI9/tGt5H2m8NqSrlhNRYMY87PtkND1XUr5NAU8mIS2TOgNr11JnoyuwY5HJ1s2Qg7WM+gymVFd5Ux9MYY4D55FGFShNPvTa0mD6hxlTB2Ds5ZehX+cbqsEwe53XM0z/VOINPodPlbFpgkKxTeDiygoxT647VtebWVbWNyB+wg1wKBgQDQhUwlAckIEjd21pJxteY/Cci7rpzfUN2CwuUiusThHqQ7T828+hk13BfoX8kib2TfpP2tbDTV6W3Wti4Z4ep2sWt9aBuCK1ytUDWXkTSbxXPOf0k5UT6l9BuhUQhl8g5MRc92EBLVTnKnkdYCrscb4z08hUl5LeorJT9R1sddvwKBgFQnW0ZCilGc6hhxT+0/oIrxpGFgLgySru0BdIzA7oZ8A108bttGkHb7z+BMdjNlMkg/qTnoZr3PFF+F4wn5pM9o1FQMoP6dJTtB5UQit9dH3eqj79/LWeLCWULgU2SzDEJ6BqJZkS0uaekDTUqq3s8pWxiwD4HXLE11L+ZJIPyjAoGBALtRU3LXJLmca7jUzt9ZcYnlhy6akI/H/AVwgRhuwVgeB5jEeuStoyIQImX8ThoiCXMiq0Q0NU6IkMRWChn0KYUQoqgYcsW/oFSM/me26JSajwrMq4HS6z13ia6jtbCm/pMkD1dW3yRBgZvo1WC5k2IJA8SvU66JQZgasMQa9iPPAoGBAI969kZMaZJKue0LDWllTgoiXD+sVL3Oi5cvR27n0vV++9BxR3HmE1VT/Fib0Q2uqCp90zxj0IAQ6zu9mBh/LuXNWx16V2LcXKQgFgmFxjDGDNgqmT3SVAI1K3mRIElv1vmddtXCQrZ8KOANzh7RIsqza0ip0mOK42GWb6REtdsY",
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

	advert.Entries = cidlink.Link{Cid: cid.MustParse("bafybeiczsscdsbs7ffqz55asqdf3smv6klcw3gofszvwlyarci47bgf354")}

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
