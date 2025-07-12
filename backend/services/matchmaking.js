const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { redisHelper } = require('../config/redis');
const { gameLogger } = require('../middleware/logger');
const { 
  NotFoundError, 
  ValidationError,
  ConflictError,
  ForbiddenError 
} = require('../middleware/errorHandler');

class EpoMatchmakingService {
  constructor() {
    this.gameServers = {
      na: ['na-1.epo.com', 'na-2.epo.com', 'na-3.epo.com'],
      eu: ['eu-1.epo.com', 'eu-2.epo.com', 'eu-3.epo.com'],
      oce: ['oce-1.epo.com', 'oce-2.epo.com'],
      asia: ['asia-1.epo.com', 'asia-2.epo.com']
    };
    
    this.queueTimeouts = {
      solo: 30000, // 30 seconds
      duo: 45000,  // 45 seconds
      squad: 60000, // 60 seconds
      ltm: 90000   // 90 seconds
    };
    
    this.maxPlayersPerMatch = {
      solo: 100,
      duo: 100,
      squad: 100,
      ltm: 50
    };
  }

  // Join matchmaking queue
  async joinQueue(socket, data) {
    try {
      const { game_mode, region, skill_level } = data;
      const userId = socket.userId;
      
      if (!userId) {
        socket.emit('queue_error', { error: 'User not authenticated' });
        return;
      }

      // Check if user is already in queue
      const existingQueue = await redisHelper.get(`queue:${userId}`);
      if (existingQueue) {
        socket.emit('queue_error', { error: 'Already in queue' });
        return;
      }

      // Check if user is banned
      const user = await db('users')
        .where('id', userId)
        .first();
      
      if (user.is_banned) {
        socket.emit('queue_error', { error: 'Account is banned' });
        return;
      }

      // Get user's skill rating
      const playerStats = await db('player_profiles')
        .where('user_id', userId)
        .first();
      
      const skillRating = skill_level || this.calculateSkillRating(playerStats);

      // Add to queue
      const queueEntry = {
        user_id: userId,
        username: user.username,
        socket_id: socket.id,
        game_mode,
        region,
        skill_rating: skillRating,
        queue_time: Date.now(),
        is_premium: user.is_premium
      };

      await redisHelper.setex(`queue:${userId}`, 300, queueEntry);
      await redisHelper.sadd(`queue:${region}:${game_mode}`, userId);

      socket.emit('queue_joined', {
        game_mode,
        region,
        estimated_wait_time: this.getEstimatedWaitTime(game_mode, region)
      });

      // Join user to queue room
      socket.join(`queue_${region}_${game_mode}`);

      // Start matchmaking process
      this.processQueue(region, game_mode);

      gameLogger.playerJoin(userId, null);
    } catch (error) {
      socket.emit('queue_error', { error: error.message });
    }
  }

  // Leave matchmaking queue
  async leaveQueue(socket, data) {
    try {
      const userId = socket.userId;
      
      if (!userId) return;

      const queueEntry = await redisHelper.get(`queue:${userId}`);
      if (!queueEntry) {
        socket.emit('queue_error', { error: 'Not in queue' });
        return;
      }

      // Remove from queue
      await redisHelper.del(`queue:${userId}`);
      await redisHelper.srem(`queue:${queueEntry.region}:${queueEntry.game_mode}`, userId);

      socket.leave(`queue_${queueEntry.region}_${queueEntry.game_mode}`);
      socket.emit('queue_left', {});

      gameLogger.playerLeave(userId, null, 'left_queue');
    } catch (error) {
      socket.emit('queue_error', { error: error.message });
    }
  }

  // Process matchmaking queue
  async processQueue(region, gameMode) {
    try {
      const queueKey = `queue:${region}:${gameMode}`;
      const queuedPlayers = await redisHelper.smembers(queueKey);
      
      if (queuedPlayers.length < this.getMinPlayersForMatch(gameMode)) {
        return;
      }

      // Get player details
      const playerDetails = [];
      for (const playerId of queuedPlayers) {
        const playerData = await redisHelper.get(`queue:${playerId}`);
        if (playerData) {
          playerDetails.push(playerData);
        }
      }

      // Group players by skill rating
      const matchGroups = this.groupPlayersBySkill(playerDetails, gameMode);

      // Create matches for each group
      for (const group of matchGroups) {
        await this.createMatch(group, region, gameMode);
      }
    } catch (error) {
      console.error('Error processing queue:', error);
    }
  }

  // Create a match
  async createMatch(players, region, gameMode) {
    try {
      const matchId = uuidv4();
      const gameServer = this.selectGameServer(region);
      
      // Create match record
      await db('matches').insert({
        id: matchId,
        game_mode: gameMode,
        region,
        server: gameServer,
        max_players: this.maxPlayersPerMatch[gameMode],
        status: 'starting',
        created_at: new Date()
      });

      // Add players to match
      for (const player of players) {
        await db('match_players').insert({
          id: uuidv4(),
          match_id: matchId,
          user_id: player.user_id,
          joined_at: new Date()
        });

        // Remove from queue
        await redisHelper.del(`queue:${player.user_id}`);
        await redisHelper.srem(`queue:${region}:${gameMode}`, player.user_id);
      }

      // Notify players
      const matchData = {
        match_id: matchId,
        game_mode: gameMode,
        region,
        server: gameServer,
        players: players.map(p => ({
          username: p.username,
          skill_rating: p.skill_rating
        })),
        start_time: new Date().toISOString()
      };

      players.forEach(player => {
        // Emit to specific socket
        global.io.to(player.socket_id).emit('match_found', matchData);
      });

      // Start match on game server
      await this.startGameServerMatch(gameServer, matchData);

      gameLogger.matchStart(matchId, players.map(p => p.user_id));

      return matchId;
    } catch (error) {
      console.error('Error creating match:', error);
      throw error;
    }
  }

  // Group players by skill rating
  groupPlayersBySkill(players, gameMode) {
    const maxPlayersPerMatch = this.maxPlayersPerMatch[gameMode];
    const groups = [];
    
    // Sort players by skill rating
    players.sort((a, b) => a.skill_rating - b.skill_rating);
    
    // Group players with similar skill ratings
    for (let i = 0; i < players.length; i += maxPlayersPerMatch) {
      const group = players.slice(i, i + maxPlayersPerMatch);
      if (group.length >= this.getMinPlayersForMatch(gameMode)) {
        groups.push(group);
      }
    }
    
    return groups;
  }

  // Calculate skill rating based on player stats
  calculateSkillRating(playerStats) {
    if (!playerStats) return 0;
    
    const level = playerStats.level || 1;
    const winRate = playerStats.matches_played > 0 ? 
      (playerStats.wins / playerStats.matches_played) * 100 : 0;
    const kdRatio = playerStats.deaths > 0 ? 
      playerStats.kills / playerStats.deaths : playerStats.kills;
    
    // Simple skill rating calculation
    return Math.floor(level * 0.5 + winRate * 0.3 + kdRatio * 0.2);
  }

  // Get minimum players required for a match
  getMinPlayersForMatch(gameMode) {
    const minimums = {
      solo: 20,
      duo: 20,
      squad: 20,
      ltm: 10
    };
    
    return minimums[gameMode] || 20;
  }

  // Select game server for region
  selectGameServer(region) {
    const servers = this.gameServers[region] || this.gameServers.na;
    return servers[Math.floor(Math.random() * servers.length)];
  }

  // Get estimated wait time
  getEstimatedWaitTime(gameMode, region) {
    // This would be based on current queue sizes and historical data
    // For now, return base timeout
    return this.queueTimeouts[gameMode] || 60000;
  }

  // Start match on game server
  async startGameServerMatch(server, matchData) {
    try {
      // This would communicate with the actual game server
      // For now, just log the match start
      console.log(`Starting match ${matchData.match_id} on server ${server}`);
      
      // Update match status
      await db('matches')
        .where('id', matchData.match_id)
        .update({
          status: 'in_progress',
          started_at: new Date()
        });
    } catch (error) {
      console.error('Error starting game server match:', error);
    }
  }

  // Handle player disconnect
  async handleDisconnect(socket) {
    try {
      const userId = socket.userId;
      if (!userId) return;

      // Remove from queue if in queue
      const queueEntry = await redisHelper.get(`queue:${userId}`);
      if (queueEntry) {
        await redisHelper.del(`queue:${userId}`);
        await redisHelper.srem(`queue:${queueEntry.region}:${queueEntry.game_mode}`, userId);
      }

      // Handle in-game disconnect
      const activeMatch = await db('matches')
        .join('match_players', 'matches.id', 'match_players.match_id')
        .where('match_players.user_id', userId)
        .where('matches.status', 'in_progress')
        .first();

      if (activeMatch) {
        await this.handlePlayerDisconnect(activeMatch.match_id, userId);
      }
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  }

  // Handle player disconnect during match
  async handlePlayerDisconnect(matchId, userId) {
    try {
      // Mark player as disconnected
      await db('match_players')
        .where('match_id', matchId)
        .where('user_id', userId)
        .update({
          disconnected_at: new Date(),
          status: 'disconnected'
        });

      // Check if match should be ended
      const activePlayers = await db('match_players')
        .where('match_id', matchId)
        .where('status', 'active')
        .count('* as count')
        .first();

      if (activePlayers.count < 2) {
        await this.endMatch(matchId, 'insufficient_players');
      }

      gameLogger.playerLeave(userId, matchId, 'disconnected');
    } catch (error) {
      console.error('Error handling player disconnect:', error);
    }
  }

  // End match
  async endMatch(matchId, reason = 'completed') {
    try {
      await db('matches')
        .where('id', matchId)
        .update({
          status: 'ended',
          end_reason: reason,
          ended_at: new Date()
        });

      // Get match results
      const matchPlayers = await db('match_players')
        .where('match_id', matchId)
        .select('*');

      gameLogger.matchEnd(matchId, null, null, { reason, players: matchPlayers.length });
    } catch (error) {
      console.error('Error ending match:', error);
    }
  }

  // Get match history
  async getMatchHistory(userId, limit = 20) {
    try {
      const matches = await db('matches')
        .join('match_players', 'matches.id', 'match_players.match_id')
        .where('match_players.user_id', userId)
        .orderBy('matches.created_at', 'desc')
        .limit(limit)
        .select(
          'matches.*',
          'match_players.placement',
          'match_players.kills',
          'match_players.deaths'
        );

      return matches;
    } catch (error) {
      throw error;
    }
  }

  // Get active matches
  async getActiveMatches() {
    try {
      const matches = await db('matches')
        .where('status', 'in_progress')
        .select('*');

      return matches;
    } catch (error) {
      throw error;
    }
  }

  // Get queue status
  async getQueueStatus(region, gameMode) {
    try {
      const queueKey = `queue:${region}:${gameMode}`;
      const queueSize = await redisHelper.smembers(queueKey);
      
      return {
        queue_size: queueSize.length,
        estimated_wait_time: this.getEstimatedWaitTime(gameMode, region),
        active_matches: await this.getActiveMatchCount(region, gameMode)
      };
    } catch (error) {
      throw error;
    }
  }

  // Get active match count
  async getActiveMatchCount(region, gameMode) {
    try {
      const count = await db('matches')
        .where('region', region)
        .where('game_mode', gameMode)
        .where('status', 'in_progress')
        .count('* as count')
        .first();

      return count.count;
    } catch (error) {
      throw error;
    }
  }

  // Get server status
  async getServerStatus() {
    try {
      const status = {};
      
      for (const [region, servers] of Object.entries(this.gameServers)) {
        status[region] = {
          servers: servers.length,
          active_matches: await this.getActiveMatchCount(region, 'solo'),
          queue_sizes: {
            solo: (await redisHelper.smembers(`queue:${region}:solo`)).length,
            duo: (await redisHelper.smembers(`queue:${region}:duo`)).length,
            squad: (await redisHelper.smembers(`queue:${region}:squad`)).length,
            ltm: (await redisHelper.smembers(`queue:${region}:ltm`)).length
          }
        };
      }

      return status;
    } catch (error) {
      throw error;
    }
  }

  // Update match results
  async updateMatchResults(matchId, results) {
    try {
      // Update match
      await db('matches')
        .where('id', matchId)
        .update({
          winner_id: results.winner_id,
          duration: results.duration,
          status: 'completed',
          ended_at: new Date()
        });

      // Update player results
      for (const playerResult of results.players) {
        await db('match_players')
          .where('match_id', matchId)
          .where('user_id', playerResult.user_id)
          .update({
            placement: playerResult.placement,
            kills: playerResult.kills,
            deaths: playerResult.deaths,
            damage_dealt: playerResult.damage_dealt,
            damage_taken: playerResult.damage_taken,
            experience_gained: playerResult.experience_gained
          });
      }

      gameLogger.matchEnd(matchId, results.winner_id, results.duration, results);
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new EpoMatchmakingService();