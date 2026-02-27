resource "kubernetes_secret" "regcred" {
  metadata {
    name = "regcred"
  }

  data = {
    ".dockerconfigjson" = var.DOCKER_CONFIG_JSON
  }

  type = "kubernetes.io/dockerconfigjson"
}

resource "kubernetes_secret" "cron_token" {
  metadata {
    name = "cron-token"
  }

  data = {
    token = var.CRON_TOKEN
  }

  type = "Opaque"
}

resource "kubernetes_secret" "gcp_sa_key" {
  metadata {
    name = "gcp-sa-key"
  }

  data = {
    "key.json" = var.GCP_SA_KEY
  }

  type = "Opaque"
}

resource "kubernetes_secret" "db_credentials" {
  metadata {
    name = "db-credentials"
  }

  data = {
    host     = "127.0.0.1"
    port     = "5432"
    dbname   = var.DB_NAME
    username = var.DB_USER
    password = var.DB_PASSWORD
  }

  type = "Opaque"
}

resource "kubernetes_secret" "google_oauth" {
  metadata {
    name = "google-oauth"
  }

  data = {
    client_id     = var.GOOGLE_CLIENT_ID
    client_secret = var.GOOGLE_CLIENT_SECRET
  }

  type = "Opaque"
}
