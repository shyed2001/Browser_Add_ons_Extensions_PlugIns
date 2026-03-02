# MindVault Companion Daemon — Makefile
# Requires Go 1.22+

BINARY   := bin/mvaultd
MAIN     := ./cmd/mvaultd
VERSION  := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS  := -ldflags "-X main.version=$(VERSION)"

.PHONY: all build run test clean tidy vet

all: build

## build: Compile the daemon binary to bin/mvaultd(.exe)
build:
	go build $(LDFLAGS) -o $(BINARY) $(MAIN)

## run: Build and run the daemon
run: build
	./$(BINARY)

## test: Run all tests
test:
	go test ./...

## vet: Run go vet
vet:
	go vet ./...

## tidy: Tidy and verify go.mod / go.sum
tidy:
	go mod tidy
	go mod verify

## clean: Remove build outputs
clean:
	rm -rf bin/

## help: Show this help
help:
	@grep -E '^## ' Makefile | sed 's/## /  /'
