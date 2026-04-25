output "public_ips" {
  description = "Public IP addresses of the EC2 instances"
  value       = { for env, eip in aws_eip.app : env => eip.public_ip }
}

output "app_urls" {
  description = "URLs to access the application"
  value = {
    dev  = "http://dev.${var.domain_name}"
    prod = "http://${var.domain_name}"
  }
}

output "ssh_commands" {
  description = "SSH commands to connect to the instances"
  value       = { for env, eip in aws_eip.app : env => "ssh -i ${path.module}/${var.app_name}-key.pem ec2-user@${eip.public_ip}" }
}

output "nameservers" {
  description = "Route 53 nameservers — set these at your domain registrar (IONOS)"
  value       = aws_route53_zone.main.name_servers
}
