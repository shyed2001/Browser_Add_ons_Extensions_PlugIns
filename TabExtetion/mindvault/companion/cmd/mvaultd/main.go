// Package main is the entry point for the MindVault companion daemon (mvaultd).
// It starts the REST API server on :47821 and optionally handles native messaging.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/mindvault/companion/internal/api"
	"github.com/mindvault/companion/internal/auth"
	"github.com/mindvault/companion/internal/db"
)

const (
	defaultPort   = 47821
	defaultDBPath = ""  // resolved at runtime to %APPDATA%\MindVault\db.sqlite
	version       = "0.1.0"
)

func main() {
	var (
		port          = flag.Int("port", defaultPort, "REST API listen port")
		dbPath        = flag.String("db", defaultDBPath, "SQLite database path")
		nativeMsg     = flag.Bool("native", false, "Run in native messaging mode (stdin/stdout)")
		showVersion   = flag.Bool("version", false, "Print version and exit")
	)
	flag.Parse()

	if *showVersion {
		fmt.Printf("mvaultd v%s\n", version)
		os.Exit(0)
	}

	// Resolve default DB path
	if *dbPath == "" {
		*dbPath = db.DefaultDBPath()
	}

	log.Printf("mvaultd v%s starting", version)
	log.Printf("  DB path : %s", *dbPath)

	// Initialise database
	database, err := db.Open(*dbPath)
	if err != nil {
		log.Fatalf("failed to open database: %v", err)
	}
	defer database.Close()

	if err := database.Migrate(); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	// One-time retroactive rename: "Default Library" → "Default (Chrome/Firefox/…)"
	// Safe to call every start — idempotent; only renames libraries still named exactly
	// "Default Library" by looking at dominant source_browser of their sessions.
	if err := database.MigrateDefaultLibraryNames(); err != nil {
		log.Printf("default-library rename migration warning: %v", err)
	}

	// Load or generate auth token
	token, err := auth.LoadOrCreateToken()
	if err != nil {
		log.Fatalf("auth token error: %v", err)
	}
	log.Printf("  Auth    : token loaded (%d chars)", len(token))

	// Native messaging mode: read JSON from stdin, write JSON to stdout
	if *nativeMsg {
		log.Printf("  Mode    : native messaging")
		// TODO(step-12): implement native messaging host protocol
		log.Fatal("native messaging not yet implemented — coming in Step 12")
	}

	// HTTP REST API mode
	addr := fmt.Sprintf("127.0.0.1:%d", *port)
	log.Printf("  Mode    : REST API at http://%s", addr)

	router := api.NewRouter(database, token)

	srv := &http.Server{
		Addr:         addr,
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown on SIGINT / SIGTERM
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		log.Printf("listening on http://%s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	<-stop
	log.Println("shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Printf("shutdown error: %v", err)
	}
	log.Println("bye")
}
