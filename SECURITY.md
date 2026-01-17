# Security Policy

## Private Repository Notice

This is a **private repository**. Unauthorized access, distribution, or modification is prohibited.

## Security Features

### 1. Environment Variables
- All sensitive configurations are stored in `.env` file
- `.env` file is **never committed** to version control
- Use `.env.example` as template for local setup

### 2. API Keys & Secrets
**Never commit:**
- API keys
- Session secrets
- Database credentials
- Personal information

**Always use:**
- Environment variables via `dotenv`
- Secure configuration module (`config.js`)

### 3. Local Data Storage
- All user data stored locally on user's machine
- No external data transmission unless explicitly enabled
- Database files excluded from version control

### 4. Code Security
- Input validation on all user inputs
- SQL injection prevention via parameterized queries
- XSS protection in renderer process
- Context isolation enabled in Electron

## Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public issue
2. Contact the repository maintainer directly
3. Provide detailed information about the vulnerability
4. Allow time for the issue to be addressed before disclosure

## Security Checklist for Contributors

Before committing code:

- [ ] No API keys or secrets in code
- [ ] `.env` file is in `.gitignore`
- [ ] Sensitive data uses environment variables
- [ ] Input validation implemented
- [ ] SQL queries use parameterized statements
- [ ] No console.log() with sensitive data in production

## Secure Development Practices

### Environment Setup
```bash
# Always use .env for configuration
cp .env.example .env
# Edit .env with your settings (never commit this file)
```

### Configuration Loading
```javascript
// ✅ Good: Use config module
const config = require('./config');
const apiKey = config.ai.apiKey;

// ❌ Bad: Hardcoded values
const apiKey = 'sk-1234567890abcdef';
```

### Database Queries
```javascript
// ✅ Good: Parameterized query
db.prepare('SELECT * FROM users WHERE id = ?').get(userId);

// ❌ Bad: String concatenation (SQL injection risk)
db.prepare(`SELECT * FROM users WHERE id = ${userId}`).get();
```

## Security Audit Log

| Date | Issue | Status | Action Taken |
|------|-------|--------|--------------|
| 2026-01-17 | Initial security review | ✅ Complete | Implemented environment variables |

## Contact

For security concerns, contact: [Your Contact Information]

---

**Remember**: Security is everyone's responsibility. Keep sensitive data secure.
