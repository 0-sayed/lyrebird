# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email the maintainer directly with details
3. Include steps to reproduce if possible

We will respond within 48 hours and work with you to understand and resolve the issue.

## Security Best Practices

When deploying Lyrebird:

- Use strong passwords for all services (PostgreSQL, RabbitMQ, Redis)
- Enable TLS/SSL in production
- Restrict network access to internal services
- Regularly update dependencies
- Review environment variables before deployment
