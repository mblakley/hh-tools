# RDYSL Callup API

A server-side API that securely accesses RDYSL (Rochester District Youth Soccer League) game fines data to analyze player callup compliance. This eliminates the need for manual copy/paste workflows while respecting CORS policies and website terms of service.

## Features

- **Secure Authentication**: Server-side login with stored credentials
- **Automated Data Scraping**: Uses Puppeteer to extract callup data
- **Caching**: 30-minute cache to reduce server load and improve performance
- **REST API**: Clean endpoints for frontend consumption
- **Docker Support**: Containerized deployment with health checks
- **Rate Limiting**: Built-in protection against abuse
- **Input Validation**: Secure handling of user inputs

## Quick Start

### Prerequisites

- Docker and Docker Compose
- RDYSL website credentials

### Setup

1. **Clone and configure**:
   ```bash
   git clone <repository-url>
   cd rdysl-callup-api
   ```

2. **Set environment variables**:
   ```bash
   cp env.example .env
   # Edit .env with your RDYSL credentials
   ```

3. **Start the service**:
   ```bash
   docker-compose up -d
   ```

4. **Access the application**:
   - Open http://localhost:3000 in your browser
   - The API will automatically authenticate and cache initial data

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `RDYSL_USERNAME` | RDYSL login username | Required |
| `RDYSL_PASSWORD` | RDYSL login password | Required |
| `PORT` | Server port | 3000 |
| `NODE_ENV` | Environment mode | production |
| `SESSION_SECRET` | Session secret key | Random generated |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window (ms) | 900000 (15 min) |
| `RATE_LIMIT_MAX_REQUESTS` | Max requests per window | 100 |
| `CACHE_DURATION_MINUTES` | Cache duration (minutes) | 30 |
| `ALLOWED_ORIGINS` | CORS allowed origins | * |

### .env Example

```env
RDYSL_USERNAME=your_username
RDYSL_PASSWORD=your_password
PORT=3000
NODE_ENV=production
SESSION_SECRET=your_secure_session_secret
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CACHE_DURATION_MINUTES=30
ALLOWED_ORIGINS=http://localhost:3000,https://yourdomain.com
```

## API Endpoints

### Health Check
```
GET /api/health
```
Returns server status and version information.

### Get Callup Data
```
POST /api/callups
Content-Type: application/json

{
  "playerSearch": "optional player name"
}
```
Fetches fresh callup data from RDYSL (with caching).

### Get Cached Data
```
GET /api/callups/cached
```
Returns cached callup data without triggering a new scrape.

## Response Format

```json
{
  "success": true,
  "summary": [
    {
      "playerName": "John Doe",
      "callupCount": 3,
      "status": "WARNING",
      "isWarning": true,
      "isUnavailable": false,
      "isOverLimit": false
    }
  ],
  "stats": {
    "totalPlayers": 50,
    "warnings": 5,
    "unavailable": 2,
    "overLimit": 1,
    "totalCallups": 125
  },
  "lastUpdated": "2023-12-01T10:30:00.000Z",
  "totalRecords": 125
}
```

## Status Codes

- **OK**: 0-2 callups
- **WARNING**: 3 callups (approaching limit)
- **UNAVAILABLE**: 4 callups (at limit)
- **OVER LIMIT**: 5+ callups (exceeds limit)

## Development

### Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set environment variables**:
   ```bash
   cp env.example .env
   # Edit .env with your credentials
   ```

3. **Start development server**:
   ```bash
   npm run dev
   ```

### Testing

```bash
npm test
```

## Deployment

### Docker Deployment

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Production Considerations

1. **Security**:
   - Use strong session secrets
   - Configure proper CORS origins
   - Consider using a reverse proxy (nginx)
   - Enable HTTPS

2. **Monitoring**:
   - Monitor container health
   - Set up log aggregation
   - Monitor API response times

3. **Scaling**:
   - Consider load balancing for multiple instances
   - Use external cache (Redis) for shared state
   - Monitor memory usage (Puppeteer can be memory intensive)

## Troubleshooting

### Common Issues

1. **Authentication Failures**:
   - Verify credentials in `.env`
   - Check if RDYSL website structure has changed
   - Review logs for specific error messages

2. **No Data Returned**:
   - Ensure you're logged into RDYSL with appropriate permissions
   - Check if the game fines page structure has changed
   - Verify network connectivity

3. **High Memory Usage**:
   - Puppeteer uses significant memory
   - Consider reducing cache duration
   - Monitor container resource limits

### Logs

```bash
# View application logs
docker-compose logs -f rdysl-callup-api

# View specific time range
docker-compose logs --since="2023-12-01T10:00:00" rdysl-callup-api
```

## Security

- Credentials are stored as environment variables
- No sensitive data is logged
- Rate limiting prevents abuse
- Input validation prevents injection attacks
- Non-root user in Docker container
- Helmet.js provides security headers

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Support

For issues and questions:
1. Check the troubleshooting section
2. Review application logs
3. Create an issue with detailed information

