variable "KUBE_CONFIG_PATH" {
  description = "Path to the kubeconfig file"
  type        = string
  default     = "~/.kube/config"
}

variable "MONITORING_CLUSTER_LABEL" {
  description = "Label value used for the origin_prometheus tag in monitoring metrics."
  type        = string
  default     = "default"
}

variable "DOCKER_CONFIG_JSON" {
  description = "The content of the .dockerconfigjson file."
  type        = string
  sensitive   = true
}

variable "LOG_LEVEL" {
  description = "The log level for the applications."
  type        = string
  default     = "info"
}

variable "DOMAIN" {
  description = "The domain for the applications."
  type        = string
}

variable "CORE_IMAGE_TAG" {
  description = "The Docker image for the service-core application."
  type        = string
}

variable "OAUTH_PROXY_IMAGE_TAG" {
  description = "The Docker image for the oauth-proxy application."
  type        = string
}

variable "CORE_URL" {
  description = "The URL for the service-core application."
  type        = string
}

variable "CLIENT_URL" {
  description = "The URL for the service-client application."
  type        = string
}

variable "GRAFANA_URL" {
  description = "The URL for the Grafana dashboard."
  type        = string
}

variable "CRON_TOKEN" {
  description = "The token for the cron job to access the service-core application."
  type        = string
  sensitive   = true
}

variable "DB_USER" {
  description = "The user for the database."
  type        = string
  sensitive   = true
}

variable "DB_PASSWORD" {
  description = "The password for the database."
  type        = string
  sensitive   = true
}

variable "DB_NAME" {
  description = "The name of the database."
  type        = string
  sensitive   = true
}

variable "CLOUD_SQL_CONNECTION_NAME" {
  description = "The connection name of the Cloud SQL instance."
  type        = string
}

variable "GCP_SA_KEY" {
  description = "The Google Cloud service account key."
  type        = string
  sensitive   = true
}

variable "GOOGLE_CLIENT_ID" {
  description = "The Google OAuth client ID."
  type        = string
  sensitive   = true
}

variable "GOOGLE_CLIENT_SECRET" {
  description = "The Google OAuth client secret."
  type        = string
  sensitive   = true
}
