terraform {
  backend "gcs" {
    bucket  = "test-3-477821-tf-state"
    prefix  = "infra"
  }
}