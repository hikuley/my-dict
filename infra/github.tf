# --- GitHub Actions Secrets (auto-updated on terraform apply) ---

resource "github_actions_secret" "ec2_dev_host" {
  repository  = var.github_repo
  secret_name = "EC2_DEV_HOST"
  value       = aws_eip.app["dev"].public_ip
}

resource "github_actions_secret" "ec2_prod_host" {
  repository  = var.github_repo
  secret_name = "EC2_PROD_HOST"
  value       = aws_eip.app["prod"].public_ip
}

resource "github_actions_secret" "ec2_dev_ssh_key" {
  repository  = var.github_repo
  secret_name = "EC2_DEV_SSH_KEY"
  value       = tls_private_key.app.private_key_openssh
}

resource "github_actions_secret" "ec2_prod_ssh_key" {
  repository  = var.github_repo
  secret_name = "EC2_PROD_SSH_KEY"
  value       = tls_private_key.app.private_key_openssh
}
