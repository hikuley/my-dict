# --- AWS Secrets Manager ---

resource "aws_secretsmanager_secret" "app" {
  for_each = local.environments
  name     = "${var.app_name}/${each.key}/secrets"
  recovery_window_in_days = 0

  tags = {
    Name        = "${var.app_name}-${each.key}-secrets"
    Environment = each.key
  }
}

resource "aws_secretsmanager_secret_version" "app" {
  for_each  = local.environments
  secret_id = aws_secretsmanager_secret.app[each.key].id

  secret_string = jsonencode({
    ANTHROPIC_API_KEY = var.anthropic_api_key
    GOOGLE_CLIENT_ID  = var.google_client_id
    MAIL_USERNAME     = var.mail_username
    MAIL_PASSWORD     = var.mail_password
  })
}
