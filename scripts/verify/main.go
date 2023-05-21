package main

import (
	"fmt"
	"os"

	"github.com/ipld/go-ipld-prime"
	"github.com/ipld/go-ipld-prime/codec/dagjson"
	"github.com/ipni/go-libipni/ingest/schema"
)

func main() {
	file := os.Args[1]

	content, err := os.ReadFile(file)
	if err != nil {
		panic(err)
	}

	node, err := ipld.Decode(content, dagjson.Decode)
	if err != nil {
		panic(err)
	}

	ad, err := schema.UnwrapAdvertisement(node)
	if err != nil {
		panic(err)
	}

	err = ad.Validate()
	if err != nil {
		panic(err)
	}

	signerID, err := ad.VerifySignature()
	if err != nil {
		panic(err)
	}

	// fmt.Println(string(content))
	fmt.Printf("Valid! Signed by %s \n", signerID)
}
