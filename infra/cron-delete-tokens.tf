resource "kubernetes_cron_job_v1" "cron_delete_tokens" {
  metadata {
    name = "cron-delete-tokens"
  }

  spec {
    schedule          = "0 0 * * *" # Daily at midnight
    concurrency_policy = "Forbid"
    job_template {
      metadata {
        name = "cron-delete-tokens"
      }
      spec {
        template {
          metadata {
            name = "cron-delete-tokens"
          }
          spec {
            container {
              name    = "delete-tokens"
              image   = "curlimages/curl:latest"
              command = ["/bin/sh", "-c"]
              args = [
                "curl -f -S -X POST -H \"Authorization: Bearer $(CRON_TOKEN)\" http://service-core-sv/crons/delete-tokens"
              ]

              env {
                name = "CRON_TOKEN"
                value_from {
                  secret_key_ref {
                    name = kubernetes_secret.cron_token.metadata[0].name
                    key  = "token"
                  }
                }
              }
            }
            restart_policy = "OnFailure"
          }
        }
      }
    }
  }
}
