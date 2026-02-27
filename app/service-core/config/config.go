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
	value := os.Getenv(key)
	if active && value == "" {
		if isRunningTest() {
			return "test"
		}
		panic("Missing environment variable: " + key)
	}

	return os.Getenv(key)
}

type Config struct {
	// General
	LogLevel  string
	HTTPPort  string
	GRPCPort  string
	Domain    string
	CoreURL   string
	AdminURL  string
	ClientURL string
	TaskToken string

	// Constants
	MaxFileSize     int64
	HTTPTimeout     time.Duration
	ContextTimeout  time.Duration
	AccessTokenExp  time.Duration
	RefreshTokenExp time.Duration

	// Database
	DatabaseProvider string
	// Postgres
	PostgresHost     string
	PostgresPort     string
	PostgresDB       string
	PostgresUser     string
	PostgresPassword string
	// Turso
	TursoURL   string
	TursoToken string

	// OAuth
	GithubClientID        string
	GithubClientSecret    string
	GoogleClientID        string
	GoogleClientSecret    string
	MicrosoftClientID     string
	MicrosoftClientSecret string
	FacebookClientID      string
	FacebookClientSecret  string
	TwilioServiceSID      string

	// Payment
	PaymentProvider            string
	SubscriptionSafePeriodDays int
	StripeAPIKey               string
	StripeWebhookSecret        string

	// Organisation Billing (Platform Subscriptions)
	StripePriceStarterMonthly    string
	StripePriceStarterYearly     string
	StripePriceGrowthMonthly     string
	StripePriceGrowthYearly      string
	StripePriceEnterpriseMonthly string
	StripePriceEnterpriseYearly  string
	StripeBillingWebhookSecret   string

	// Email
	EmailProvider string
	EmailFrom     string
	// Postmark
	PostmarkAPIKey string
	// Sendgrid
	SendgridAPIKey string
	// Resend
	ResendAPIKey string
	// Ses
	SesAccessKey string
	SesSecretKey string
	SesRegion    string
	// SMTP
	SMTPHost     string
	SMTPPort     string
	SMTPUsername string
	SMTPPassword string

	// Files
	FileProvider string
	LocalFileDir string
	BucketName   string
	// AWS S3
	S3Region    string
	S3AccessKey string
	S3SecretKey string
	// Cloudfare R2
	R2AccessKey string
	R2SecretKey string
	R2Endpoint  string
	// Google Cloud Storage
	GoogleApplicationCredentials string
	// Azure Blob Storage
	AzblobAccountName string
	AzblobAccountKey  string
}

func LoadConfig() *Config {
	const (
		HTTPTimeout                = 10 * time.Second
		ContextTimeout             = 10 * time.Second
		AccessTokenExp             = 15 * time.Minute
		RefreshTokenExp            = 30 * 24 * time.Hour
		MaxFileSize                = 10 << 20
		SubscriptionSafePeriodDays = 2
	)
	return &Config{
		LogLevel:                     MustSetEnv(true, "LOG_LEVEL"),
		HTTPPort:                     MustSetEnv(true, "HTTP_PORT"),
		GRPCPort:                     MustSetEnv(true, "GRPC_PORT"),
		Domain:                       MustSetEnv(true, "DOMAIN"),
		CoreURL:                      MustSetEnv(true, "CORE_URL"),
		AdminURL:                     MustSetEnv(true, "ADMIN_URL"),
		ClientURL:                    MustSetEnv(true, "CLIENT_URL"),
		TaskToken:                    MustSetEnv(true, "TASK_TOKEN"),
		HTTPTimeout:                  HTTPTimeout,
		ContextTimeout:               ContextTimeout,
		AccessTokenExp:               AccessTokenExp,
		RefreshTokenExp:              RefreshTokenExp,
		MaxFileSize:                  MaxFileSize,
		SubscriptionSafePeriodDays:   SubscriptionSafePeriodDays,
		DatabaseProvider:             MustSetEnv(true, "DATABASE_PROVIDER"),
		PostgresHost:                 MustSetEnv(os.Getenv("DATABASE_PROVIDER") == "postgres", "POSTGRES_HOST"),
		PostgresPort:                 MustSetEnv(os.Getenv("DATABASE_PROVIDER") == "postgres", "POSTGRES_PORT"),
		PostgresDB:                   MustSetEnv(os.Getenv("DATABASE_PROVIDER") == "postgres", "POSTGRES_DB"),
		PostgresUser:                 MustSetEnv(os.Getenv("DATABASE_PROVIDER") == "postgres", "POSTGRES_USER"),
		PostgresPassword:             MustSetEnv(os.Getenv("DATABASE_PROVIDER") == "postgres", "POSTGRES_PASSWORD"),
		TursoURL:                     MustSetEnv(os.Getenv("DATABASE_PROVIDER") == "turso", "TURSO_URL"),
		TursoToken:                   MustSetEnv(os.Getenv("DATABASE_PROVIDER") == "turso", "TURSO_TOKEN"),
		GithubClientID:               os.Getenv("GITHUB_CLIENT_ID"),
		GithubClientSecret:           os.Getenv("GITHUB_CLIENT_SECRET"),
		GoogleClientID:               os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret:           os.Getenv("GOOGLE_CLIENT_SECRET"),
		MicrosoftClientID:            os.Getenv("MICROSOFT_CLIENT_ID"),
		MicrosoftClientSecret:        os.Getenv("MICROSOFT_CLIENT_SECRET"),
		FacebookClientID:             os.Getenv("FACEBOOK_CLIENT_ID"),
		FacebookClientSecret:         os.Getenv("FACEBOOK_CLIENT_SECRET"),
		TwilioServiceSID:             os.Getenv("TWILIO_SERVICE_SID"),
		PaymentProvider:              MustSetEnv(true, "PAYMENT_PROVIDER"),
		StripeAPIKey:                 MustSetEnv(os.Getenv("PAYMENT_PROVIDER") == "stripe", "STRIPE_API_KEY"),
		StripeWebhookSecret:          MustSetEnv(os.Getenv("PAYMENT_PROVIDER") == "stripe", "STRIPE_WEBHOOK_SECRET"),
		// Organisation billing price IDs (optional - loaded if set)
		StripePriceStarterMonthly:    os.Getenv("STRIPE_PRICE_STARTER_MONTHLY"),
		StripePriceStarterYearly:     os.Getenv("STRIPE_PRICE_STARTER_YEARLY"),
		StripePriceGrowthMonthly:     os.Getenv("STRIPE_PRICE_GROWTH_MONTHLY"),
		StripePriceGrowthYearly:      os.Getenv("STRIPE_PRICE_GROWTH_YEARLY"),
		StripePriceEnterpriseMonthly: os.Getenv("STRIPE_PRICE_ENTERPRISE_MONTHLY"),
		StripePriceEnterpriseYearly:  os.Getenv("STRIPE_PRICE_ENTERPRISE_YEARLY"),
		StripeBillingWebhookSecret:   os.Getenv("STRIPE_BILLING_WEBHOOK_SECRET"),
		EmailProvider:                MustSetEnv(true, "EMAIL_PROVIDER"),
		EmailFrom:                    MustSetEnv(true, "EMAIL_FROM"),
		SendgridAPIKey:               MustSetEnv(os.Getenv("EMAIL_PROVIDER") == "sendgrid", "SENDGRID_API_KEY"),
		PostmarkAPIKey:               MustSetEnv(os.Getenv("EMAIL_PROVIDER") == "postmark", "POSTMARK_API_KEY"),
		ResendAPIKey:                 MustSetEnv(os.Getenv("EMAIL_PROVIDER") == "resend", "RESEND_API_KEY"),
		SesAccessKey:                 MustSetEnv(os.Getenv("EMAIL_PROVIDER") == "ses", "SES_ACCESS_KEY"),
		SesSecretKey:                 MustSetEnv(os.Getenv("EMAIL_PROVIDER") == "ses", "SES_SECRET_KEY"),
		SesRegion:                    MustSetEnv(os.Getenv("EMAIL_PROVIDER") == "ses", "SES_REGION"),
		SMTPHost:                     MustSetEnv(os.Getenv("EMAIL_PROVIDER") == "smtp", "SMTP_HOST"),
		SMTPPort:                     MustSetEnv(os.Getenv("EMAIL_PROVIDER") == "smtp", "SMTP_PORT"),
		SMTPUsername:                 os.Getenv("SMTP_USERNAME"),
		SMTPPassword:                 os.Getenv("SMTP_PASSWORD"),
		FileProvider:                 MustSetEnv(true, "FILE_PROVIDER"),
		LocalFileDir:                 MustSetEnv(os.Getenv("FILE_PROVIDER") == "local", "LOCAL_FILE_DIR"),
		BucketName:                   MustSetEnv(os.Getenv("FILE_PROVIDER") != "local", "BUCKET_NAME"),
		S3Region:                     MustSetEnv(os.Getenv("FILE_PROVIDER") == "s3", "S3_REGION"),
		S3AccessKey:                  MustSetEnv(os.Getenv("FILE_PROVIDER") == "s3", "S3_ACCESS_KEY"),
		S3SecretKey:                  MustSetEnv(os.Getenv("FILE_PROVIDER") == "s3", "S3_SECRET_KEY"),
		R2AccessKey:                  MustSetEnv(os.Getenv("FILE_PROVIDER") == "r2", "R2_ACCESS_KEY"),
		R2SecretKey:                  MustSetEnv(os.Getenv("FILE_PROVIDER") == "r2", "R2_SECRET_KEY"),
		R2Endpoint:                   MustSetEnv(os.Getenv("FILE_PROVIDER") == "r2", "R2_ENDPOINT"),
		GoogleApplicationCredentials: MustSetEnv(os.Getenv("FILE_PROVIDER") == "gcs", "GOOGLE_APPLICATION_CREDENTIALS"),
		AzblobAccountName:            MustSetEnv(os.Getenv("FILE_PROVIDER") == "azblob", "AZBLOB_ACCOUNT_NAME"),
		AzblobAccountKey:             MustSetEnv(os.Getenv("FILE_PROVIDER") == "azblob", "AZBLOB_ACCOUNT_KEY"),
	}
}

func LoadTestConfig() *Config {
	const (
		HTTPTimeout                = 10 * time.Second
		ContextTimeout             = 10 * time.Second
		AccessTokenExp             = 5 * time.Minute
		RefreshTokenExp            = 30 * 24 * time.Hour
		MaxFileSize                = 10 << 20
		SubscriptionSafePeriodDays = 2
	)
	return &Config{
		LogLevel:                     "debug",
		HTTPPort:                     "8080",
		GRPCPort:                     "50051",
		Domain:                       "localhost",
		CoreURL:                      "http://localhost:8080",
		AdminURL:                     "http://localhost:8080",
		ClientURL:                    "http://localhost:3000",
		TaskToken:                    "test",
		HTTPTimeout:                  HTTPTimeout,
		ContextTimeout:               ContextTimeout,
		AccessTokenExp:               AccessTokenExp,
		RefreshTokenExp:              RefreshTokenExp,
		MaxFileSize:                  MaxFileSize,
		DatabaseProvider:             "postgres",
		PostgresHost:                 "localhost",
		PostgresPort:                 "5432",
		PostgresDB:                   "test",
		PostgresUser:                 "test",
		PostgresPassword:             "test",
		TursoURL:                     "http://localhost:8080",
		TursoToken:                   "test",
		GithubClientID:               "github_client_id",
		GithubClientSecret:           "github_client_secret",
		GoogleClientID:               "google_client_id",
		GoogleClientSecret:           "google_client_secret",
		MicrosoftClientID:            "microsoft_client_id",
		MicrosoftClientSecret:        "microsoft_client_secret",
		FacebookClientID:             "facebook_client_id",
		FacebookClientSecret:         "facebook_client_secret",
		TwilioServiceSID:             "twilio_service_sid",
		PaymentProvider:              "stripe",
		SubscriptionSafePeriodDays:   SubscriptionSafePeriodDays,
		StripeAPIKey:                 "stripe_api_key",
		StripeWebhookSecret:          "stripe_webhook_secret",
		StripePriceStarterMonthly:    "price_starter_monthly_test",
		StripePriceStarterYearly:     "price_starter_yearly_test",
		StripePriceGrowthMonthly:     "price_growth_monthly_test",
		StripePriceGrowthYearly:      "price_growth_yearly_test",
		StripePriceEnterpriseMonthly: "price_enterprise_monthly_test",
		StripePriceEnterpriseYearly:  "price_enterprise_yearly_test",
		StripeBillingWebhookSecret:   "billing_webhook_secret_test",
		EmailProvider:                "sendgrid",
		EmailFrom:                    "email_from",
		SendgridAPIKey:               "sendgrid_api_key",
		PostmarkAPIKey:               "postmark_api_key",
		ResendAPIKey:                 "resend_api_key",
		SesAccessKey:                 "ses_access_key",
		SesSecretKey:                 "ses_secret_key",
		SesRegion:                    "ses_region",
		FileProvider:                 "local",
		LocalFileDir:                 "file_dir",
		BucketName:                   "bucket_name",
		S3Region:                     "s3_region",
		S3AccessKey:                  "s3_access_key",
		S3SecretKey:                  "s3_secret_key",
		R2AccessKey:                  "r2_access_key",
		R2SecretKey:                  "r2_secret_key",
		R2Endpoint:                   "r2_endpoint",
		GoogleApplicationCredentials: "google_application_credentials",
		AzblobAccountName:            "azblob_account_name",
		AzblobAccountKey:             "azblob_account_key",
	}
}
