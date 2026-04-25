# --- Route 53 Hosted Zone ---

resource "aws_route53_zone" "main" {
  name = var.domain_name

  tags = {
    Name = var.domain_name
  }
}

# --- DNS Records ---

# prod: kuleysoft.com -> prod EC2 Elastic IP
resource "aws_route53_record" "root" {
  zone_id = aws_route53_zone.main.zone_id
  name    = var.domain_name
  type    = "A"
  ttl     = 300
  records = [aws_eip.app["prod"].public_ip]
}

# dev: dev.kuleysoft.com -> dev EC2 Elastic IP
resource "aws_route53_record" "dev" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "dev.${var.domain_name}"
  type    = "A"
  ttl     = 300
  records = [aws_eip.app["dev"].public_ip]
}
