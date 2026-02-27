resource "kubernetes_ingress_v1" "service_ingress" {
  metadata {
    name = "service-ingress"
    annotations = {
      "kubernetes.io/ingress.class" = "nginx"
    }
  }

  spec {
    rule {
      host = var.CORE_URL
      http {
        path {
          path = "/"
          path_type = "Prefix"
          backend {
            service {
              name = kubernetes_service.service_core_sv.metadata[0].name
              port {
                name = "connect"
              }
            }
          }
        }
      }
    }
  }
}
