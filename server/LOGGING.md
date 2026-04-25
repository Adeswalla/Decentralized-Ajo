# Logging Implementation

This document describes the structured logging implementation using Winston.

## Overview

The application uses Winston for structured logging with different configurations for development and production environments.

## Features

- **Structured Logging**: All logs are structured with metadata for easy parsing and analysis
- **Log Levels**: Supports multiple log levels (error, warn, info, debug)
- **Environment-Specific Formatting**:
  - Development: Colored, human-readable console output
  - Production: JSON format for log aggregation tools
- **Daily Log Rotation**: Production logs are rotated daily with automatic cleanup
- **HTTP Request Logging**: All API requests are automatically logged with timing information

## Log Levels

- `error`: Error events that might still allow the application to continue running
- `warn`: Warning messages for potentially harmful situations
- `info`: Informational messages highlighting application progress
- `debug`: Detailed information for debugging (development only)

## Usage

### Import the logger

```typescript
import logger from './config/logger';
```

### Basic logging

```typescript
logger.info('User logged in', { userId: '123', email: 'user@example.com' });
logger.warn('Rate limit approaching', { userId: '123', requests: 95 });
logger.error('Database connection failed', { error: err.message });
logger.debug('Processing request', { data: requestData });
```

### HTTP Request Logging

All HTTP requests are automatically logged by the `requestLogger` middleware with:
- Request method and URL
- Client IP and user agent
- Response status code
- Request duration

## Configuration

### Environment Variables

- `NODE_ENV`: Set to `production` for production logging (JSON format, file rotation)
- Default is `development` (colored console output only)

### Log Files (Production Only)

Logs are stored in the `logs/` directory:
- `error-YYYY-MM-DD.log`: Error-level logs only
- `combined-YYYY-MM-DD.log`: All log levels

### Rotation Settings

- **Max File Size**: 20MB
- **Retention**: 14 days
- **Date Pattern**: YYYY-MM-DD

## Migration from console.log

Replace all `console.log`, `console.error`, `console.warn` with appropriate logger methods:

```typescript
// Before
console.log('Server started');
console.error('Error:', err);

// After
logger.info('Server started');
logger.error('Error occurred', { error: err.message, stack: err.stack });
```

## Best Practices

1. **Always include context**: Add relevant metadata to log messages
2. **Use appropriate log levels**: Don't log everything as `info`
3. **Avoid logging sensitive data**: Never log passwords, tokens, or PII
4. **Structure your logs**: Use objects for metadata instead of string concatenation
5. **Log errors with stack traces**: Include error details for debugging

## Example

```typescript
import logger from './config/logger';

export const createUser = async (userData: UserData) => {
  try {
    logger.debug('Creating new user', { email: userData.email });
    
    const user = await db.user.create(userData);
    
    logger.info('User created successfully', { 
      userId: user.id, 
      email: user.email 
    });
    
    return user;
  } catch (error) {
    logger.error('Failed to create user', {
      error: error.message,
      stack: error.stack,
      email: userData.email,
    });
    throw error;
  }
};
```
