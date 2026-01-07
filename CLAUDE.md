# Project Instructions

## Git Commits
- Use short commit messages only: "feat: added x" or "fix: y and x"
- No commit descriptions or body text
- No "Generated with Claude Code" footer
- No co-author lines

## AWS Bedrock Setup
- Uses Claude via AWS Bedrock Converse API
- Model: `anthropic.claude-3-5-sonnet-20241022-v2:0`
- Region: `us-east-1` (configurable via AWS_REGION)
- Credentials: AWS CLI profile, IAM role, or env vars (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
