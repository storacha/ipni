# verify

Verify a signed IPNI advertisement using [go-libipni](https://github.com/ipni/go-libipni)

## Getting started

Write a signed advertisement encoded as dag-json to a file. You can use the examples dir

```sh
$ node ../../examples/one-provider.js
# baguqeeract2ajcyrt7uhzl7o42oe6qcm4edbn7hb3txlmwsfwywndjpww6wa
```

Pass the file name to main.go 

```sh
$ go run main.go baguqeeract2ajcyrt7uhzl7o42oe6qcm4edbn7hb3txlmwsfwywndjpww6wa
Valid! Signed by 12D3KooWLjR7BQDTznBoWpXoVjHaSzzkbNoN7m83GT5Z1syxE6K9 
```
