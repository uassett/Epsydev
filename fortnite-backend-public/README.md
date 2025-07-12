# Fortnite Backend Public

A comprehensive, open-source backend for Fortnite private servers with configurable item shop, economy system, and full Chapter 2 Season 5 support.

## 🚀 Features

- **Configurable Item Shop**: Easily customize items, prices, rotations, and exotic weapons
- **Complete Economy System**: V-Bucks, Gold Bars, transactions, and player wallets
- **Authentication & Player Management**: Registration, login, profiles, and session management
- **Matchmaking System**: Queue management with Redis-based real-time updates
- **Battle Pass Support**: Configurable battle pass with tier progression
- **Statistics Tracking**: Player stats, match history, and leaderboards
- **Admin Panel**: Administrative tools and logging
- **Fortnite Client Compatible**: Endpoints compatible with actual Fortnite clients
- **Chapter 2 Season 5 Focus**: Exotic weapons, gold bars, bounty system, NPCs

## 📋 Prerequisites

- **Node.js** 16+ and npm 8+
- **PostgreSQL** 12+
- **Redis** 6+
- **Git**

## 🛠️ Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/fortnite-backend-public.git
cd fortnite-backend-public
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Setup

#### Create PostgreSQL Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database and user
CREATE DATABASE fortnite_backend;
CREATE USER fortnite_user WITH ENCRYPTED PASSWORD 'your_password_here';
GRANT ALL PRIVILEGES ON DATABASE fortnite_backend TO fortnite_user;
\q
```

#### Run Database Schema

```bash
psql -U fortnite_user -d fortnite_backend -f database/schema.sql
```

### 4. Redis Setup

Ensure Redis is running on your system:

```bash
# Ubuntu/Debian
sudo systemctl start redis-server

# macOS (with Homebrew)
brew services start redis

# Or run manually
redis-server
```

### 5. Environment Configuration

Create a `.env` file in the root directory:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fortnite_backend
DB_USER=fortnite_user
DB_PASSWORD=your_password_here
DB_SSL=false

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0

# Security
JWT_SECRET=your_super_secret_jwt_key_change_this
NODE_ENV=production

# Server
PORT=3000
MAX_PLAYERS=100
REGION=NA-EAST
```

### 6. Configuration

#### Server Configuration

Edit `config/server.json` to customize:

- Database connection settings
- Security options (JWT, CORS, rate limiting)
- Game settings (chapter, season, build version)
- Feature toggles (item shop, battle pass, etc.)

#### Item Shop Configuration

Edit `config/itemshop.json` to customize:

- **Featured Items**: Highlight specific items with custom availability
- **Daily Rotation**: Configure daily shop items and rotation schedule
- **Exotic Weapons**: Set up NPC vendors and weapon pricing
- **Bundles**: Create item bundles with discounts
- **Battle Pass**: Configure tiers and rewards
- **Pricing Tiers**: Set price ranges by rarity

Example item shop customization:

```json
{
  "itemshop": {
    "rotation_schedule": {
      "enabled": true,
      "rotation_interval_hours": 24
    },
    "featured_section": {
      "enabled": true,
      "max_items": 6,
      "items": [
        {
          "id": "CID_694_Athena_Commando_M_MandalorianSeason",
          "name": "The Mandalorian",
          "type": "outfit",
          "rarity": "legendary",
          "price": 1500,
          "currency": "vbucks",
          "description": "This is the Way."
        }
      ]
    }
  }
}
```

## 🚗 Running the Server

### Development Mode

```bash
npm run dev
```

### Production Mode

```bash
npm start
```

### Database Migration & Seeding

```bash
# Run initial setup (creates tables and default data)
npm run setup
```

## 📡 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new player
- `POST /api/auth/login` - Player login
- `POST /api/auth/logout` - Player logout
- `GET /api/auth/me` - Get current player info

### Item Shop

- `GET /api/itemshop` - Get current item shop
- `POST /api/itemshop/purchase` - Purchase an item
- `GET /api/itemshop/config` - Get item shop configuration (admin)
- `POST /api/itemshop/config` - Update item shop configuration (admin)
- `POST /api/itemshop/rotate` - Force item shop rotation (admin)

### Player Management

- `GET /api/player/profile` - Get player profile
- `GET /api/player/inventory` - Get player inventory

### Economy

- `GET /api/economy/wallet` - Get player wallet
- `GET /api/economy/transactions` - Get transaction history
- `POST /api/economy/add-currency` - Add currency (admin)

### Matchmaking

- `POST /api/matchmaking/join` - Join matchmaking queue
- `POST /api/matchmaking/leave` - Leave matchmaking queue
- `GET /api/matchmaking/status` - Get matchmaking status

### Fortnite Client Compatible

- `POST /fortnite/api/oauth/token` - Fortnite client authentication
- `GET /fortnite/api/storefront/v2/catalog` - Fortnite client item shop
- `POST /fortnite/api/game/v2/profile/:accountId/client/:operation` - Profile operations

## 🎮 Usage Examples

### Register a New Player

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "password123",
    "displayName": "Test User"
  }'
```

### Login and Get Token

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "password": "password123"
  }'
```

### Get Current Item Shop

```bash
curl http://localhost:3000/api/itemshop
```

### Purchase an Item

```bash
curl -X POST http://localhost:3000/api/itemshop/purchase \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "itemId": "CID_694_Athena_Commando_M_MandalorianSeason",
    "currency": "vbucks"
  }'
```

### Update Item Shop Configuration

```bash
curl -X POST http://localhost:3000/api/itemshop/config \
  -H "Authorization: Bearer ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rotation_schedule": {
      "rotation_interval_hours": 12
    }
  }'
```

## 🔧 Customization

### Adding New Items

1. Edit `config/itemshop.json`
2. Add items to the appropriate section (featured, daily, bundles)
3. Restart the server or use the admin API to update configuration

### Changing Exotic Weapons

```json
{
  "exotic_weapons": {
    "npc_vendors": [
      {
        "npc_id": "NPC_CustomVendor",
        "name": "Custom Vendor",
        "location": "Custom Location",
        "weapons": [
          {
            "id": "WID_Custom_Weapon",
            "name": "Custom Exotic",
            "price": 750,
            "currency": "gold_bars",
            "description": "A custom exotic weapon"
          }
        ]
      }
    ]
  }
}
```

### Modifying Pricing Tiers

```json
{
  "pricing_tiers": {
    "legendary": {"min": 2000, "max": 2500},
    "mythic": {"min": 2500, "max": 5000}
  }
}
```

## 🛡️ Security

### Important Security Notes

1. **Change Default Credentials**: The default admin user is `admin` with password `admin123` - change this immediately!
2. **JWT Secret**: Use a strong, random JWT secret in production
3. **Database Passwords**: Use strong database passwords
4. **Rate Limiting**: Adjust rate limits based on your server capacity
5. **CORS**: Configure CORS origins for your domain

### Recommended Security Setup

```json
{
  "security": {
    "jwt_secret": "GENERATE_A_LONG_RANDOM_STRING",
    "jwt_expires_in": "24h",
    "bcrypt_rounds": 12,
    "rate_limit": {
      "enabled": true,
      "window_ms": 900000,
      "max_requests": 50
    }
  }
}
```

## 📊 Monitoring & Logs

Logs are stored in the `logs/` directory:

- `application-YYYY-MM-DD.log` - General application logs
- `error-YYYY-MM-DD.log` - Error logs
- `game-YYYY-MM-DD.log` - Game-specific events

### Health Check

```bash
curl http://localhost:3000/health
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This is an educational project for learning backend development. It is not affiliated with Epic Games or Fortnite. Use responsibly and respect Epic Games' terms of service.

## 🆘 Support

For support and questions:

1. Check the [Issues](https://github.com/yourusername/fortnite-backend-public/issues) page
2. Create a new issue if your problem isn't already reported
3. Join our Discord community (link in issues)

## 🙏 Acknowledgments

- Inspired by the Fortnite community
- Built for educational purposes
- Thanks to all contributors

---

**Note**: This backend is designed to work with Fortnite Chapter 2 Season 5 clients and assets. Make sure you have the appropriate game files and legal rights to use them.