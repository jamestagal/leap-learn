package config

import (
	"os"
	"strings"
	"time"
)

func isRunningTest() bool {
	for _, arg := range os.Args {
		if strings.HasSuffix(arg, ".test") {
			return true
		}
	}

	return false
}

func MustSetEnv(active bool, key string) string {
	if active && os.Getenv(key) == "" {
		if isRunningTest() {
			return "test"
		}
		panic("Missing environment variable: " + key)
	}

	return os.Getenv(key)
}

type Config struct {
	// General
	LogLevel       string
	HTTPPort       string
	SSEPort        string
	Domain         string
	AdminURL       string
	SSEURL         string
	NATSURL        string
	CoreURL        string
	CoreURI        string
	ReadTimeout    time.Duration
	IdleTimeout    time.Duration
	WriteTimeout   time.Duration
	ContextTimeout time.Duration
	ToastDuration  int
}

func LoadConfig() *Config {
	const (
		ReadTimeout     = 10 * time.Second
		IdleTimeout     = 120 * time.Second
		WriteTimeout    = 10 * time.Second
		ContextTimeout  = 10 * time.Second
		AccessTokenExp  = 15 * time.Minute
		RefreshTokenExp = 30 * 24 * time.Hour
		ToastDuration   = 4000
	)
	return &Config{
		LogLevel:       MustSetEnv(true, "LOG_LEVEL"),
		HTTPPort:       MustSetEnv(true, "HTTP_PORT"),
		SSEPort:        MustSetEnv(true, "SSE_PORT"),
		Domain:         MustSetEnv(true, "DOMAIN"),
		AdminURL:       MustSetEnv(true, "ADMIN_URL"),
		SSEURL:         MustSetEnv(true, "SSE_URL"),
		NATSURL:        MustSetEnv(true, "NATS_URL"),
		CoreURL:        MustSetEnv(true, "CORE_URL"),
		CoreURI:        MustSetEnv(true, "CORE_URI"),
		ReadTimeout:    ReadTimeout,
		IdleTimeout:    IdleTimeout,
		WriteTimeout:   WriteTimeout,
		ContextTimeout: ContextTimeout,
		ToastDuration:  ToastDuration,
	}
}

func LoadTestConfig() *Config {
	const (
		ReadTimeout     = 10 * time.Second
		IdleTimeout     = 120 * time.Second
		WriteTimeout    = 10 * time.Second
		ContextTimeout  = 10 * time.Second
		AccessTokenExp  = 5 * time.Minute
		RefreshTokenExp = 30 * 24 * time.Hour
		ToastDuration   = 5000
	)
	return &Config{
		LogLevel:       "debug",
		HTTPPort:       "8080",
		SSEPort:        "8081",
		Domain:         "localhost",
		AdminURL:       "http://localhost:8080",
		SSEURL:         "http://localhost:8081",
		NATSURL:        "nats://localhost:4222",
		CoreURL:        "http://localhost:8080",
		CoreURI:        "localhost:8080",
		ReadTimeout:    ReadTimeout,
		IdleTimeout:    IdleTimeout,
		WriteTimeout:   WriteTimeout,
		ContextTimeout: ContextTimeout,
		ToastDuration:  ToastDuration,
	}
}
