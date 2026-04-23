#!/bin/bash
# One-time Terraform state migration script
# Moves existing single-instance resources into the "dev" key of the new for_each structure.
# Run this ONCE before 'terraform plan' after switching to the dual-env configuration.
#
# Usage: cd infra && bash migrate-state.sh

set -euo pipefail

echo "Migrating Terraform state to dual-env structure..."
echo "Existing resources will be assigned to the 'dev' environment."
echo ""

terraform state mv 'aws_ebs_volume.pgdata' 'aws_ebs_volume.pgdata["dev"]'
terraform state mv 'aws_instance.app' 'aws_instance.app["dev"]'
terraform state mv 'aws_volume_attachment.pgdata' 'aws_volume_attachment.pgdata["dev"]'
terraform state mv 'aws_eip.app' 'aws_eip.app["dev"]'
terraform state mv 'aws_cloudwatch_log_group.app' 'aws_cloudwatch_log_group.app["dev"]'

echo ""
echo "State migration complete."
echo "Run 'terraform plan' to verify — only prod resources should be new additions."
