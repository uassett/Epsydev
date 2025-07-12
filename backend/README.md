# Epo Backend

A comprehensive Node.js backend for the Epo Fortnite private server ecosystem. This backend provides authentication, player management, matchmaking, economy, content management, and security services.

## Features

- **Authentication System**: User registration, login, JWT tokens, password reset
- **Player Management**: Profiles, stats, inventory, leaderboards
- **Matchmaking Service**: Queue management, skill-based matching, server allocation
- **Economy System**: V-Bucks, item shop, battle pass, transactions
- **Content Management**: Items, news, events, recommendations
- **Security & Anti-Cheat**: Ban management, suspicious activity detection, reporting
- **Admin Panel**: User management, system monitoring, content moderation

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL with Knex.js ORM
- **Cache**: Redis
- **Real-time**: Socket.io
- **Authentication**: JWT
- **Validation**: Joi
- **Logging**: Winston
- **Security**: Helmet, bcrypt, rate limiting

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Set up PostgreSQL database**
   ```bash
   # Create database and user
   sudo -u postgres psql
   CREATE DATABASE epo_database;
   CREATE USER epo_user WITH PASSWORD 'epo_password';
   GRANT ALL PRIVILEGES ON DATABASE epo_database TO epo_user;
   ```

5. **Set up Redis**
   ```bash
   # Install Redis (Ubuntu/Debian)
   sudo apt update
   sudo apt install redis-server
   sudo systemctl start redis-server
   ```

6. **Run database migrations**
   ```bash
   npm run migrate
   ```

7. **Seed database (optional)**
   ```bash
   npm run seed
   ```

8. **Start the server**
   ```bash
   # Development
   npm run dev
   
   # Production
   npm start
   ```

## Environment Variables

Copy `.env.example` to `.env` and configure the following:

### Required Configuration
- `NODE_ENV`: Environment (development/production)
- `PORT`: Server port (default: 3000)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`: PostgreSQL configuration
- `REDIS_HOST`, `REDIS_PORT`: Redis configuration
- `JWT_SECRET`, `JWT_REFRESH_SECRET`: JWT signing secrets

### Optional Configuration
- Payment gateway credentials (Stripe, PayPal)
- Discord bot integration
- Email service configuration
- CDN and asset URLs
- Anti-cheat settings

## API Endpoints

### Authentication (`/api/auth`)
- `POST /register` - Register new user
- `POST /login` - User login
- `POST /refresh` - Refresh access token
- `POST /logout` - User logout
- `GET /profile` - Get user profile
- `POST /change-password` - Change password
- `POST /forgot-password` - Request password reset
- `POST /reset-password` - Reset password with token

### Player Management (`/api/player`)
- `GET /profile` - Get player profile
- `PUT /profile` - Update player profile
- `GET /stats` - Get player statistics
- `GET /inventory` - Get player inventory
- `GET /rank` - Get player rank
- `GET /leaderboard` - Get leaderboards
- `GET /search` - Search players

### Economy (`/api/economy`)
- `GET /vbucks/balance` - Get V-Bucks balance
- `POST /vbucks/purchase` - Purchase V-Bucks
- `GET /shop` - Get item shop
- `POST /shop/purchase` - Purchase items
- `GET /battlepass` - Get battle pass info
- `POST /battlepass/purchase` - Purchase battle pass
- `GET /history` - Get purchase history

### Content (`/api/content`)
- `GET /items` - Get all items
- `GET /items/:id` - Get specific item
- `GET /items/featured` - Get featured items
- `GET /news` - Get news articles
- `GET /events` - Get game events
- `GET /popular` - Get popular items
- `GET /recommended` - Get recommended items

### Matchmaking (`/api/matchmaking`)
- `GET /queue/status` - Get queue status
- `GET /history` - Get match history
- `GET /active` - Get active matches
- `GET /servers` - Get server status
- `GET /current-match` - Get current match
- `POST /leave-match` - Leave current match

### Admin (`/api/admin`)
- `GET /users` - Get all users
- `GET /users/:id` - Get specific user
- `POST /users/:id/ban` - Ban user
- `POST /users/:id/unban` - Unban user
- `GET /security/reports` - Get security reports
- `GET /dashboard/stats` - Get dashboard statistics
- `GET /system/health` - Check system health

## Database Schema

The backend uses PostgreSQL with the following main tables:

- `users` - User accounts and authentication
- `player_profiles` - Player game profiles and stats
- `items` - Cosmetic items and content
- `transactions` - Economy transactions
- `matches` - Game matches and results
- `match_players` - Player participation in matches
- `player_inventory` - Player-owned items
- `bans` - User ban records
- `security_reports` - Security incident reports
- `seasons` - Game seasons
- `battle_passes` - Battle pass ownership

## WebSocket Events

The server supports real-time communication via Socket.io:

### Client → Server
- `join-queue` - Join matchmaking queue
- `leave-queue` - Leave matchmaking queue
- `player-update` - Update player status

### Server → Client
- `queue_joined` - Queue join confirmation
- `queue_left` - Queue leave confirmation
- `match_found` - Match found notification
- `queue_error` - Queue error messages
- `friend_status_update` - Friend status changes

## Security Features

- **JWT Authentication**: Secure token-based authentication
- **Rate Limiting**: API endpoint rate limiting
- **Input Validation**: Comprehensive input validation with Joi
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: Helmet.js security headers
- **Password Hashing**: bcrypt password hashing
- **HWID Tracking**: Hardware ID tracking and ban system
- **Anti-Cheat Integration**: Suspicious activity detection
- **Audit Logging**: Comprehensive security event logging

## Monitoring & Logging

- **Winston Logging**: Structured logging with multiple transports
- **Request Logging**: All API requests logged with unique IDs
- **Error Tracking**: Comprehensive error logging and handling
- **Security Events**: Login attempts, bans, suspicious activity
- **Performance Metrics**: Response times and database queries

## Development

### Running Tests
```bash
npm test
```

### Database Operations
```bash
# Create new migration
npx knex migrate:make migration_name

# Run migrations
npm run migrate

# Rollback migrations
npx knex migrate:rollback

# Create seed
npx knex seed:make seed_name

# Run seeds
npm run seed
```

### Code Style
- ESLint configuration for code linting
- Prettier for code formatting
- Follow Node.js best practices

## Deployment

### Production Setup
1. Set `NODE_ENV=production`
2. Configure production database and Redis
3. Set strong JWT secrets
4. Configure payment gateways
5. Set up SSL/TLS termination
6. Configure process manager (PM2)
7. Set up monitoring and alerting

### Docker Support
```bash
# Build Docker image
docker build -t epo-backend .

# Run with Docker Compose
docker-compose up -d
```

### Performance Optimization
- Database connection pooling
- Redis caching for frequent queries
- Response compression
- Database indexing
- Query optimization
- Rate limiting

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Create an issue on GitHub
- Join our Discord server
- Check the documentation

---

**Epo Backend v1.0.0** - Built for the Epo Fortnite Private Server Ecosystem