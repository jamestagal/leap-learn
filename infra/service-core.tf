resource "kubernetes_deployment" "service_core" {
  metadata {
    name = "service-core"
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        app = "service-core"
      }
    }

    template {
      metadata {
        labels = {
          app = "service-core"
        }
      }

      spec {
        container {
          image = var.CORE_IMAGE_TAG
          name  = "service-core"

          port {
            container_port = 4000
            name           = "connect"
          }

          resources {
            limits = {
              cpu    = "250m"
              memory = "256Mi"
            }
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = "connect"
            }
            initial_delay_seconds = 15
            period_seconds        = 20
          }

          readiness_probe {
            http_get {
              path = "/ready"
              port = "connect"
            }
          }

          env {
            name  = "LOG_LEVEL"
            value = var.LOG_LEVEL
          }
          env {
            name  = "SERVICE_NAME"
            value = "service-core"
          }
          env {
            name  = "PORT"
            value = "4000"
          }
          env {
            name  = "DOMAIN"
            value = var.DOMAIN
          }
          env {
            name  = "CORE_URL"
            value = "https://${var.CORE_URL}"
          }
          env {
            name  = "CLIENT_URL"
            value = "https://${var.CLIENT_URL}"
          }
          env {
            name  = "ALLOY_URL"
            value = "alloy.monitoring:4317"
          }
          env {
            name = "CRON_TOKEN"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.cron_token.metadata[0].name
                key  = "token"
              }
            }
          }
          env {
            name = "POSTGRES_HOST"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db_credentials.metadata[0].name
                key  = "host"
              }
            }
          }
          env {
            name = "POSTGRES_PORT"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db_credentials.metadata[0].name
                key  = "port"
              }
            }
          }
          env {
            name = "POSTGRES_DB"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db_credentials.metadata[0].name
                key  = "dbname"
              }
            }
          }
          env {
            name = "POSTGRES_USER"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db_credentials.metadata[0].name
                key  = "username"
              }
            }
          }
          env {
            name = "POSTGRES_PASSWORD"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.db_credentials.metadata[0].name
                key  = "password"
              }
            }
          }
          env {
            name = "GOOGLE_CLIENT_ID"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.google_oauth.metadata[0].name
                key  = "client_id"
              }
            }
          }
          env {
            name = "GOOGLE_CLIENT_SECRET"
            value_from {
              secret_key_ref {
                name = kubernetes_secret.google_oauth.metadata[0].name
                key  = "client_secret"
              }
            }
          }
          env {
            name  = "OAUTH_REDIRECT_URI"
            value = "https://oauth-proxy.${var.DOMAIN}/callback"
          }
        }

        container {
          name  = "cloud-sql-proxy"
          image = "gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.18.0"
          args = [
            "--structured-logs",
            var.CLOUD_SQL_CONNECTION_NAME,
            "--credentials-file=/secrets/gcp/key.json"
          ]

          resources {
            limits = {
              cpu    = "50m"
              memory = "64Mi"
            }
            requests = {
              cpu    = "25m"
              memory = "32Mi"
            }
          }

          security_context {
            run_as_user = 65532
            run_as_non_root = true
          }
          volume_mount {
            name       = "gcp-sa-key-volume"
            mount_path = "/secrets/gcp/"
            read_only  = true
          }
        }

        image_pull_secrets {
          name = kubernetes_secret.regcred.metadata[0].name
        }

        volume {
          name = "gcp-sa-key-volume"
          secret {
            secret_name = kubernetes_secret.gcp_sa_key.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "service_core_sv" {
  metadata {
    name = "service-core-sv"
  }

  spec {
    selector = {
      app = "service-core"
    }

    port {
      name        = "connect"
      port        = 80
      target_port = "connect"
    }

  }
}
