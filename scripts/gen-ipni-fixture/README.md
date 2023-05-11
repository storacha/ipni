# gen-ipni-fixture

Generate an IPNI advertisement directly from the golang IPNI reference implementation code.

The generator currently uses the peer ID and provider information found in `test/fixtures/ad-1` and `test/fixtures/ad-2` to generate an advertisement with `ExtendedProvider`s. The output is encoded as dag-json.

## Usage

```sh
go run main.go | jq
```
