const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const { createServer } = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

// Import services
const authService = require('./services/auth');
const playerService = require('./services/player');
const matchmakingService = require('./services/matchmaking');
const economyService = require('./services/economy');
const contentService = require('./services/content');
const securityService = require('./services/security');

// Import middleware
const auth = require('./middleware/auth');
const logger = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const playerRoutes = require('./routes/player');
const matchmakingRoutes = require('./routes/matchmaking');
const economyRoutes = require('./routes/economy');
const contentRoutes = require('./routes/content');
const adminRoutes = require('./routes/admin');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "*",
    methods: ["GET", "POST"]
  }
});

// Configure logger
const epoLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/epo-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/epo-combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(compression());
app.use(limiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(logger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Epo Backend',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/player', auth, playerRoutes);
app.use('/api/matchmaking', auth, matchmakingRoutes);
app.use('/api/economy', auth, economyRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/admin', auth, adminRoutes);

// Socket.io connection handling
io.on('connection', (socket) => {
  epoLogger.info(`New client connected: ${socket.id}`);
  
  // Handle matchmaking events
  socket.on('join-queue', (data) => {
    matchmakingService.joinQueue(socket, data);
  });
  
  socket.on('leave-queue', (data) => {
    matchmakingService.leaveQueue(socket, data);
  });
  
  // Handle player events
  socket.on('player-update', (data) => {
    playerService.updatePlayerStatus(socket, data);
  });
  
  socket.on('disconnect', () => {
    epoLogger.info(`Client disconnected: ${socket.id}`);
    matchmakingService.handleDisconnect(socket);
  });
});

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  epoLogger.info(`Epo Backend Server running on port ${PORT}`);
  console.log(`
  ███████╗██████╗  ██████╗ 
  ██╔════╝██╔══██╗██╔═══██╗
  █████╗  ██████╔╝██║   ██║
  ██╔══╝  ██╔═══╝ ██║   ██║
  ███████╗██║     ╚██████╔╝
  ╚══════╝╚═╝      ╚═════╝ 
  
  Epo Backend v1.0.0
  Port: ${PORT}
  Environment: ${process.env.NODE_ENV || 'development'}
  `);
});

module.exports = { app, server, io };