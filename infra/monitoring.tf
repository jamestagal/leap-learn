resource "helm_release" "local_path_provisioner" {
  name             = "local-path-provisioner"
  repository       = "https://containeroo.github.io/helm-charts/"
  chart            = "local-path-provisioner"
  version          = "0.0.33"
  namespace        = "local-path-storage"
  create_namespace = true

  values = [
    <<-EOT
storageClass:
  defaultClass: true
EOT
  ]
}

resource "kubernetes_namespace" "monitoring" {
  metadata {
    name = "monitoring"
  }
}

resource "helm_release" "kube_state_metrics" {
  name             = "kube-state-metrics"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "kube-state-metrics"
  version          = "6.3.0"
  namespace        = kubernetes_namespace.monitoring.metadata[0].name
  create_namespace = false
}

resource "kubernetes_config_map" "alloy_config" {
  metadata {
    name      = "alloy-config"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "config.alloy" = file("${path.module}/../monitoring/alloy-config-k8s.alloy")
  }
}

resource "kubernetes_config_map" "tempo_config" {
  metadata {
    name      = "tempo-config"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "tempo.yaml" = file("${path.module}/../monitoring/tempo.yaml")
  }
}

resource "kubernetes_config_map" "loki_config" {
  metadata {
    name      = "loki-config"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "loki-config.yaml" = file("${path.module}/../monitoring/loki-config.yaml")
  }
}

resource "kubernetes_config_map" "prometheus_config" {
  metadata {
    name      = "prometheus-config"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "prometheus.yml" = file("${path.module}/../monitoring/prometheus.yml")
  }
}

resource "kubernetes_config_map" "grafana_datasources" {
  metadata {
    name      = "grafana-datasources"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "datasources.yaml" = file("${path.module}/../monitoring/grafana-datasources.yaml")
  }
}

resource "kubernetes_config_map" "grafana_dashboards_config" {
  metadata {
    name      = "grafana-dashboards-config"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "dashboards.yaml" = file("${path.module}/../monitoring/grafana-dashboards.yaml")
  }
}

resource "kubernetes_config_map" "grafana_dashboards" {
  metadata {
    name      = "grafana-dashboards"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  data = {
    "observability.json" = file("${path.module}/../monitoring/dashboards/observability.json")
    "kubernetes.json" = file("${path.module}/../monitoring/dashboards/kubernetes.json")
  }
}

resource "kubernetes_service_account" "alloy" {
  metadata {
    name      = "alloy"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }
}

resource "kubernetes_cluster_role" "alloy" {
  metadata {
    name = "alloy"
  }

  rule {
    api_groups = [""]
    resources  = ["nodes", "nodes/proxy", "nodes/metrics", "services", "endpoints", "pods"]
    verbs      = ["get", "list", "watch"]
  }

  rule {
    api_groups = [""]
    resources  = ["configmaps"]
    verbs      = ["get"]
  }

  rule {
    non_resource_urls = ["/metrics", "/metrics/cadvisor"]
    verbs             = ["get"]
  }
}

resource "kubernetes_cluster_role_binding" "alloy" {
  metadata {
    name = "alloy"
  }

  role_ref {
    api_group = "rbac.authorization.k8s.io"
    kind      = "ClusterRole"
    name      = kubernetes_cluster_role.alloy.metadata[0].name
  }

  subject {
    kind      = "ServiceAccount"
    name      = kubernetes_service_account.alloy.metadata[0].name
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }
}

resource "kubernetes_persistent_volume_claim" "alloy_data" {
  metadata {
    name      = "alloy-data"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    access_modes = ["ReadWriteOnce"]

    resources {
      requests = {
        storage = "5Gi"
      }
    }

    storage_class_name = "local-path"
  }

  wait_until_bound = false

  depends_on = [
    helm_release.local_path_provisioner
  ]
}

resource "kubernetes_persistent_volume_claim" "tempo_data" {
  metadata {
    name      = "tempo-data"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    access_modes = ["ReadWriteOnce"]

    resources {
      requests = {
        storage = "8Gi"
      }
    }

    storage_class_name = "local-path"
  }

  wait_until_bound = false

  depends_on = [
    helm_release.local_path_provisioner
  ]
}

resource "kubernetes_persistent_volume_claim" "loki_data" {
  metadata {
    name      = "loki-data"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    access_modes = ["ReadWriteOnce"]

    resources {
      requests = {
        storage = "8Gi"
      }
    }

    storage_class_name = "local-path"
  }

  wait_until_bound = false

  depends_on = [
    helm_release.local_path_provisioner
  ]
}

resource "kubernetes_persistent_volume_claim" "prometheus_data" {
  metadata {
    name      = "prometheus-data"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    access_modes = ["ReadWriteOnce"]

    resources {
      requests = {
        storage = "10Gi"
      }
    }

    storage_class_name = "local-path"
  }

  wait_until_bound = false

  depends_on = [
    helm_release.local_path_provisioner
  ]
}

resource "kubernetes_persistent_volume_claim" "grafana_data" {
  metadata {
    name      = "grafana-data"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
  }

  spec {
    access_modes = ["ReadWriteOnce"]

    resources {
      requests = {
        storage = "2Gi"
      }
    }

    storage_class_name = "local-path"
  }

  wait_until_bound = false

  depends_on = [
    helm_release.local_path_provisioner
  ]
}

resource "kubernetes_deployment" "alloy" {
  metadata {
    name      = "alloy"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      app = "alloy"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "alloy"
      }
    }

    template {
      metadata {
        labels = {
          app = "alloy"
        }
      }

      spec {
        service_account_name = kubernetes_service_account.alloy.metadata[0].name

        container {
          name  = "alloy"
          image = "grafana/alloy:latest"
          args = [
            "run",
            "/etc/alloy/config.alloy",
            "--server.http.listen-addr=0.0.0.0:12345",
            "--storage.path=/var/lib/alloy/data",
            "--stability.level=experimental"
          ]

          env {
            name  = "ALLOY_CLUSTER_LABEL"
            value = var.MONITORING_CLUSTER_LABEL
          }

          port {
            name           = "otlp-grpc"
            container_port = 4317
          }

          port {
            name           = "otlp-http"
            container_port = 4318
          }

          port {
            name           = "ui"
            container_port = 12345
          }

          resources {
            limits = {
              cpu    = "100m"
              memory = "256Mi"
            }
            requests = {
              cpu    = "10m"
              memory = "64Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/-/healthy"
              port = "ui"
            }
            initial_delay_seconds = 30
            period_seconds        = 20
          }

          readiness_probe {
            http_get {
              path = "/-/ready"
              port = "ui"
            }
            initial_delay_seconds = 20
            period_seconds        = 10
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/alloy"
            read_only  = true
          }

          volume_mount {
            name       = "data"
            mount_path = "/var/lib/alloy/data"
          }
        }

        volume {
          name = "config"

          config_map {
            name = kubernetes_config_map.alloy_config.metadata[0].name

            items {
              key  = "config.alloy"
              path = "config.alloy"
            }
          }
        }

        volume {
          name = "data"

          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.alloy_data.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "alloy" {
  metadata {
    name      = "alloy"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      app = "alloy"
    }
  }

  spec {
    selector = {
      app = "alloy"
    }

    port {
      name        = "otlp-grpc"
      port        = 4317
      target_port = "otlp-grpc"
    }

    port {
      name        = "otlp-http"
      port        = 4318
      target_port = "otlp-http"
    }

    port {
      name        = "ui"
      port        = 12345
      target_port = "ui"
    }
  }
}

resource "kubernetes_deployment" "loki" {
  metadata {
    name      = "loki"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      app = "loki"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "loki"
      }
    }

    template {
      metadata {
        labels = {
          app = "loki"
        }
      }

      spec {
        container {
          name  = "loki"
          image = "grafana/loki:latest"
          args  = ["-config.file=/etc/loki/loki-config.yaml"]

          port {
            name           = "http"
            container_port = 3100
          }

          resources {
            limits = {
              cpu    = "150m"
              memory = "384Mi"
            }
            requests = {
              cpu    = "10m"
              memory = "64Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/ready"
              port = "http"
            }
            initial_delay_seconds = 45
            period_seconds        = 20
          }

          readiness_probe {
            http_get {
              path = "/ready"
              port = "http"
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/loki"
            read_only  = true
          }

          volume_mount {
            name       = "data"
            mount_path = "/loki"
          }
        }

        volume {
          name = "config"

          config_map {
            name = kubernetes_config_map.loki_config.metadata[0].name

            items {
              key  = "loki-config.yaml"
              path = "loki-config.yaml"
            }
          }
        }

        volume {
          name = "data"

          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.loki_data.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "loki" {
  metadata {
    name      = "loki"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      app = "loki"
    }
  }

  spec {
    selector = {
      app = "loki"
    }

    port {
      name        = "http"
      port        = 3100
      target_port = "http"
    }
  }
}

resource "kubernetes_deployment" "tempo" {
  metadata {
    name      = "tempo"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      app = "tempo"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "tempo"
      }
    }

    template {
      metadata {
        labels = {
          app = "tempo"
        }
      }

      spec {
        container {
          name  = "tempo"
          image = "grafana/tempo:latest"
          args  = ["-config.file=/etc/tempo/tempo.yaml"]

          port {
            name           = "http"
            container_port = 3200
          }

          port {
            name           = "otlp-grpc"
            container_port = 4317
          }

          port {
            name           = "zipkin"
            container_port = 9411
          }

          resources {
            limits = {
              cpu    = "150m"
              memory = "384Mi"
            }
            requests = {
              cpu    = "25m"
              memory = "128Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/ready"
              port = "http"
            }
            initial_delay_seconds = 45
            period_seconds        = 20
          }

          readiness_probe {
            http_get {
              path = "/ready"
              port = "http"
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/tempo"
            read_only  = true
          }

          volume_mount {
            name       = "data"
            mount_path = "/tmp/tempo"
          }
        }

        volume {
          name = "config"

          config_map {
            name = kubernetes_config_map.tempo_config.metadata[0].name

            items {
              key  = "tempo.yaml"
              path = "tempo.yaml"
            }
          }
        }

        volume {
          name = "data"

          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.tempo_data.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "tempo" {
  metadata {
    name      = "tempo"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      app = "tempo"
    }
  }

  spec {
    selector = {
      app = "tempo"
    }

    port {
      name        = "http"
      port        = 3200
      target_port = "http"
    }

    port {
      name        = "otlp-grpc"
      port        = 4317
      target_port = "otlp-grpc"
    }

    port {
      name        = "zipkin"
      port        = 9411
      target_port = "zipkin"
    }
  }
}

resource "kubernetes_deployment" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      app = "prometheus"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "prometheus"
      }
    }

    template {
      metadata {
        labels = {
          app = "prometheus"
        }
      }

      spec {
        container {
          name  = "prometheus"
          image = "prom/prometheus:latest"
          args = [
            "--config.file=/etc/prometheus/prometheus.yml",
            "--enable-feature=remote-write-receiver",
            "--enable-feature=exemplar-storage",
            "--web.enable-remote-write-receiver",
            "--storage.tsdb.retention.time=30d"
          ]

          port {
            name           = "http"
            container_port = 9090
          }

          resources {
            limits = {
              cpu    = "250m"
              memory = "512Mi"
            }
            requests = {
              cpu    = "10m"
              memory = "64Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/-/healthy"
              port = "http"
            }
            initial_delay_seconds = 45
            period_seconds        = 20
          }

          readiness_probe {
            http_get {
              path = "/-/ready"
              port = "http"
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/prometheus"
            read_only  = true
          }

          volume_mount {
            name       = "data"
            mount_path = "/prometheus"
          }
        }

        volume {
          name = "config"

          config_map {
            name = kubernetes_config_map.prometheus_config.metadata[0].name

            items {
              key  = "prometheus.yml"
              path = "prometheus.yml"
            }
          }
        }

        volume {
          name = "data"

          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.prometheus_data.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "prometheus" {
  metadata {
    name      = "prometheus"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      app = "prometheus"
    }
  }

  spec {
    selector = {
      app = "prometheus"
    }

    port {
      name        = "http"
      port        = 9090
      target_port = "http"
    }
  }
}

resource "kubernetes_deployment" "grafana" {
  metadata {
    name      = "grafana"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      app = "grafana"
    }
  }

  spec {
    replicas = 1

    selector {
      match_labels = {
        app = "grafana"
      }
    }

    template {
      metadata {
        labels = {
          app = "grafana"
        }
      }

      spec {
        container {
          name  = "grafana"
          image = "grafana/grafana-enterprise:latest"

          port {
            name           = "http"
            container_port = 3000
          }

          resources {
            limits = {
              cpu    = "100m"
              memory = "256Mi"
            }
            requests = {
              cpu    = "10m"
              memory = "64Mi"
            }
          }

          liveness_probe {
            http_get {
              path = "/api/health"
              port = "http"
            }
            initial_delay_seconds = 45
            period_seconds        = 20
          }

          readiness_probe {
            http_get {
              path = "/api/health"
              port = "http"
            }
            initial_delay_seconds = 30
            period_seconds        = 10
          }

          volume_mount {
            name       = "grafana-datasources"
            mount_path = "/etc/grafana/provisioning/datasources/datasources.yaml"
            sub_path   = "datasources.yaml"
            read_only  = true
          }

          volume_mount {
            name       = "grafana-dashboards-config"
            mount_path = "/etc/grafana/provisioning/dashboards/dashboards.yaml"
            sub_path   = "dashboards.yaml"
            read_only  = true
          }

  volume_mount {
    name       = "grafana-dashboards"
    mount_path = "/etc/grafana/provisioning/dashboards/starter"
    read_only  = true
  }

          volume_mount {
            name       = "data"
            mount_path = "/var/lib/grafana"
          }
        }

        volume {
          name = "grafana-datasources"

          config_map {
            name = kubernetes_config_map.grafana_datasources.metadata[0].name
          }
        }

        volume {
          name = "grafana-dashboards-config"

          config_map {
            name = kubernetes_config_map.grafana_dashboards_config.metadata[0].name
          }
        }

        volume {
          name = "grafana-dashboards"

          config_map {
            name = kubernetes_config_map.grafana_dashboards.metadata[0].name
          }
        }

        volume {
          name = "data"

          persistent_volume_claim {
            claim_name = kubernetes_persistent_volume_claim.grafana_data.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "grafana" {
  metadata {
    name      = "grafana"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    labels = {
      app = "grafana"
    }
  }

  spec {
    selector = {
      app = "grafana"
    }

    port {
      name        = "http"
      port        = 3000
      target_port = "http"
    }
  }
}

resource "kubernetes_ingress_v1" "grafana" {
  metadata {
    name      = "grafana"
    namespace = kubernetes_namespace.monitoring.metadata[0].name
    annotations = {
      "kubernetes.io/ingress.class" = "nginx"
    }
  }

  spec {
    rule {
      host = var.GRAFANA_URL

      http {
        path {
          path      = "/"
          path_type = "Prefix"

          backend {
            service {
              name = kubernetes_service.grafana.metadata[0].name

              port {
                number = 3000
              }
            }
          }
        }
      }
    }
  }
}
