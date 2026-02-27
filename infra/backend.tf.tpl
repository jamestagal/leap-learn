terraform {
  backend "gcs" {
    bucket  = "__GCS_BUCKET_NAME__"
    prefix  = "infra"
  }
}