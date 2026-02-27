resource "kubernetes_deployment" "oauth_proxy" {
  metadata {
    name = "oauth-proxy"
  }

  spec {
    replicas = 2

    selector {
      match_labels = {
        app = "oauth-proxy"
      }
    }

    template {
      metadata {
        labels = {
          app = "oauth-proxy"
        }
      }

      spec {
        container {
          image = var.OAUTH_PROXY_IMAGE_TAG
          name  = "oauth-proxy"

          port {
            container_port = 8080
            name           = "http"
          }

          resources {
            limits = {
              cpu    = "100m"
              memory = "64Mi"
            }
            requests = {
              cpu    = "50m"
              memory = "32Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/health"
              port = "http"
            }
            initial_delay_seconds = 5
            period_seconds        = 10
          }

          readiness_probe {
            http_get {
              path = "/health"
              port = "http"
            }
            initial_delay_seconds = 2
            period_seconds        = 5
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
            name  = "PORT"
            value = "8080"
          }
        }

        image_pull_secrets {
          name = "regcred"
        }
      }
    }
  }
}

resource "kubernetes_service" "oauth_proxy" {
  metadata {
    name = "oauth-proxy"
  }

  spec {
    selector = {
      app = "oauth-proxy"
    }

    port {
      name        = "http"
      port        = 80
      target_port = "http"
    }
  }
}

resource "kubernetes_ingress_v1" "oauth_proxy" {
  metadata {
    name = "oauth-proxy-ingress"
    annotations = {
      "kubernetes.io/ingress.class" = "nginx"
    }
  }

  spec {
    rule {
      host = "oauth-proxy.${var.DOMAIN}"
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = kubernetes_service.oauth_proxy.metadata[0].name
              port {
                name = "http"
              }
            }
          }
        }
      }
    }
  }
}
