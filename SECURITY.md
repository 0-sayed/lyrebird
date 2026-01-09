# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

### Preferred Method: GitHub Security Advisories

Report vulnerabilities privately through GitHub's Security Advisory feature:

1. Go to <https://github.com/0-sayed/lyrebird/security/advisories/new>
2. Provide detailed information about the vulnerability
3. We will respond within 48 hours

### Alternative: Email

If you cannot use GitHub Security Advisories, you can email the maintainer:

- **Email**: <2sayed.5ashraf@gmail.com>

### What to Include

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

**Please do NOT open a public GitHub issue for security vulnerabilities.**

## Security Best Practices

When deploying Lyrebird:

- Use strong passwords for all services (PostgreSQL, RabbitMQ, Redis)
- Enable TLS/SSL in production
- Restrict network access to internal services
- Regularly update dependencies
- Review environment variables before deployment
- Use secrets management tools (e.g., HashiCorp Vault, AWS Secrets Manager)
- Enable audit logging for all services
- Implement network segmentation and firewalls
