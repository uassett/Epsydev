const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');
const { redisHelper } = require('../config/redis');
const { gameLogger } = require('../middleware/logger');
const { 
  NotFoundError, 
  ValidationError,
  ConflictError 
} = require('../middleware/errorHandler');

class EpoPlayerService {
  constructor() {
    this.maxLevel = 100;
    this.experiencePerLevel = 1000;
  }

  // Get player profile
  async getPlayerProfile(userId) {
    try {
      const profile = await db('player_profiles')
        .where('user_id', userId)
        .first();
      
      if (!profile) {
        throw new NotFoundError('Player profile not found');
      }

      // Get recent match history
      const recentMatches = await db('match_history')
        .where('user_id', userId)
        .orderBy('created_at', 'desc')
        .limit(10)
        .select('*');

      // Get player stats
      const stats = await this.getPlayerStats(userId);

      // Get player inventory
      const inventory = await this.getPlayerInventory(userId);

      return {
        ...profile,
        settings: JSON.parse(profile.settings || '{}'),
        recent_matches: recentMatches,
        stats,
        inventory
      };
    } catch (error) {
      throw error;
    }
  }

  // Update player profile
  async updatePlayerProfile(userId, updateData) {
    try {
      const { display_name, avatar_url, settings } = updateData;
      
      // Check if display name is already taken
      if (display_name) {
        const existingProfile = await db('player_profiles')
          .where('display_name', display_name)
          .where('user_id', '!=', userId)
          .first();
        
        if (existingProfile) {
          throw new ConflictError('Display name already taken');
        }
      }

      const updateFields = {
        updated_at: new Date()
      };

      if (display_name) updateFields.display_name = display_name;
      if (avatar_url) updateFields.avatar_url = avatar_url;
      if (settings) updateFields.settings = JSON.stringify(settings);

      await db('player_profiles')
        .where('user_id', userId)
        .update(updateFields);

      return { message: 'Profile updated successfully' };
    } catch (error) {
      throw error;
    }
  }

  // Get player stats
  async getPlayerStats(userId) {
    try {
      const profile = await db('player_profiles')
        .where('user_id', userId)
        .first();
      
      if (!profile) {
        throw new NotFoundError('Player profile not found');
      }

      // Calculate KD ratio
      const kdRatio = profile.deaths > 0 ? (profile.kills / profile.deaths).toFixed(2) : profile.kills;
      
      // Calculate win rate
      const winRate = profile.matches_played > 0 ? 
        ((profile.wins / profile.matches_played) * 100).toFixed(1) : 0;

      return {
        level: profile.level,
        experience: profile.experience,
        wins: profile.wins,
        kills: profile.kills,
        deaths: profile.deaths,
        matches_played: profile.matches_played,
        kd_ratio: parseFloat(kdRatio),
        win_rate: parseFloat(winRate),
        rank: await this.getPlayerRank(userId),
        season_stats: await this.getSeasonStats(userId)
      };
    } catch (error) {
      throw error;
    }
  }

  // Get player inventory
  async getPlayerInventory(userId) {
    try {
      const inventory = await db('player_inventory')
        .join('items', 'player_inventory.item_id', 'items.id')
        .where('player_inventory.user_id', userId)
        .select(
          'items.*',
          'player_inventory.quantity',
          'player_inventory.equipped',
          'player_inventory.acquired_at'
        );

      const organizedInventory = {
        skins: inventory.filter(item => item.type === 'skin'),
        emotes: inventory.filter(item => item.type === 'emote'),
        pickaxes: inventory.filter(item => item.type === 'pickaxe'),
        gliders: inventory.filter(item => item.type === 'glider'),
        wraps: inventory.filter(item => item.type === 'wrap'),
        music: inventory.filter(item => item.type === 'music'),
        other: inventory.filter(item => !['skin', 'emote', 'pickaxe', 'glider', 'wrap', 'music'].includes(item.type))
      };

      return organizedInventory;
    } catch (error) {
      throw error;
    }
  }

  // Update player stats after match
  async updatePlayerStats(userId, matchData) {
    try {
      const { kills, deaths, placement, match_duration, game_mode } = matchData;
      const isWin = placement === 1;
      
      // Calculate experience gained
      const baseXP = 100;
      const killXP = kills * 50;
      const placementXP = Math.max(0, 100 - placement * 10);
      const winXP = isWin ? 500 : 0;
      const totalXP = baseXP + killXP + placementXP + winXP;

      // Update player profile
      const profile = await db('player_profiles')
        .where('user_id', userId)
        .first();
      
      if (!profile) {
        throw new NotFoundError('Player profile not found');
      }

      const newExperience = profile.experience + totalXP;
      const newLevel = Math.min(this.maxLevel, Math.floor(newExperience / this.experiencePerLevel) + 1);
      const leveledUp = newLevel > profile.level;

      await db('player_profiles')
        .where('user_id', userId)
        .update({
          level: newLevel,
          experience: newExperience,
          kills: profile.kills + kills,
          deaths: profile.deaths + deaths,
          wins: profile.wins + (isWin ? 1 : 0),
          matches_played: profile.matches_played + 1,
          updated_at: new Date()
        });

      // Record match history
      await db('match_history').insert({
        id: uuidv4(),
        user_id: userId,
        match_id: matchData.match_id,
        game_mode,
        kills,
        deaths,
        placement,
        match_duration,
        experience_gained: totalXP,
        is_win: isWin,
        created_at: new Date()
      });

      // Update season stats
      await this.updateSeasonStats(userId, matchData, totalXP);

      gameLogger.playerLeave(userId, matchData.match_id, 'match_completed');

      return {
        experience_gained: totalXP,
        new_level: newLevel,
        leveled_up: leveledUp,
        total_experience: newExperience
      };
    } catch (error) {
      throw error;
    }
  }

  // Get player rank
  async getPlayerRank(userId) {
    try {
      const profile = await db('player_profiles')
        .where('user_id', userId)
        .first();
      
      if (!profile) {
        return { rank: 'Unranked', position: 0 };
      }

      // Get player's position in leaderboard
      const position = await db('player_profiles')
        .where('level', '>', profile.level)
        .orWhere(function() {
          this.where('level', profile.level)
            .andWhere('experience', '>', profile.experience);
        })
        .count('* as count')
        .first();

      const rankPosition = parseInt(position.count) + 1;

      // Determine rank based on level and position
      let rank = 'Bronze';
      if (profile.level >= 80) rank = 'Champion';
      else if (profile.level >= 60) rank = 'Diamond';
      else if (profile.level >= 40) rank = 'Platinum';
      else if (profile.level >= 20) rank = 'Gold';
      else if (profile.level >= 10) rank = 'Silver';

      return {
        rank,
        position: rankPosition,
        level: profile.level,
        experience: profile.experience
      };
    } catch (error) {
      throw error;
    }
  }

  // Get season stats
  async getSeasonStats(userId) {
    try {
      const currentSeason = await this.getCurrentSeason();
      
      const seasonStats = await db('season_stats')
        .where('user_id', userId)
        .where('season_id', currentSeason.id)
        .first();

      if (!seasonStats) {
        return {
          season: currentSeason.name,
          wins: 0,
          kills: 0,
          matches_played: 0,
          experience: 0,
          tier: 1,
          tier_progress: 0
        };
      }

      return {
        season: currentSeason.name,
        wins: seasonStats.wins,
        kills: seasonStats.kills,
        matches_played: seasonStats.matches_played,
        experience: seasonStats.experience,
        tier: seasonStats.tier,
        tier_progress: seasonStats.tier_progress
      };
    } catch (error) {
      throw error;
    }
  }

  // Update season stats
  async updateSeasonStats(userId, matchData, experienceGained) {
    try {
      const currentSeason = await this.getCurrentSeason();
      const { kills, deaths, placement } = matchData;
      const isWin = placement === 1;

      // Get or create season stats
      let seasonStats = await db('season_stats')
        .where('user_id', userId)
        .where('season_id', currentSeason.id)
        .first();

      if (!seasonStats) {
        seasonStats = {
          id: uuidv4(),
          user_id: userId,
          season_id: currentSeason.id,
          wins: 0,
          kills: 0,
          matches_played: 0,
          experience: 0,
          tier: 1,
          tier_progress: 0,
          created_at: new Date()
        };
        await db('season_stats').insert(seasonStats);
      }

      // Update stats
      const newExperience = seasonStats.experience + experienceGained;
      const newTier = Math.min(100, Math.floor(newExperience / 10000) + 1);
      const tierProgress = (newExperience % 10000) / 10000 * 100;

      await db('season_stats')
        .where('user_id', userId)
        .where('season_id', currentSeason.id)
        .update({
          wins: seasonStats.wins + (isWin ? 1 : 0),
          kills: seasonStats.kills + kills,
          matches_played: seasonStats.matches_played + 1,
          experience: newExperience,
          tier: newTier,
          tier_progress: Math.floor(tierProgress),
          updated_at: new Date()
        });

      return {
        tier: newTier,
        tier_progress: Math.floor(tierProgress),
        experience: newExperience
      };
    } catch (error) {
      throw error;
    }
  }

  // Get current season
  async getCurrentSeason() {
    try {
      const season = await db('seasons')
        .where('is_active', true)
        .first();

      if (!season) {
        // Create default season if none exists
        const defaultSeason = {
          id: uuidv4(),
          name: 'Chapter 2 Season 5',
          start_date: new Date(),
          end_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
          is_active: true,
          created_at: new Date()
        };
        await db('seasons').insert(defaultSeason);
        return defaultSeason;
      }

      return season;
    } catch (error) {
      throw error;
    }
  }

  // Get leaderboard
  async getLeaderboard(type = 'level', limit = 100) {
    try {
      let query = db('player_profiles')
        .join('users', 'player_profiles.user_id', 'users.id')
        .select(
          'player_profiles.display_name',
          'player_profiles.level',
          'player_profiles.experience',
          'player_profiles.wins',
          'player_profiles.kills',
          'player_profiles.matches_played',
          'users.username'
        )
        .where('users.is_active', true)
        .where('users.is_banned', false)
        .limit(limit);

      switch (type) {
        case 'level':
          query = query.orderBy('level', 'desc').orderBy('experience', 'desc');
          break;
        case 'wins':
          query = query.orderBy('wins', 'desc');
          break;
        case 'kills':
          query = query.orderBy('kills', 'desc');
          break;
        case 'kd':
          query = query.orderByRaw('(kills::float / GREATEST(deaths, 1)) DESC');
          break;
        default:
          query = query.orderBy('level', 'desc').orderBy('experience', 'desc');
      }

      const leaderboard = await query;

      return leaderboard.map((player, index) => ({
        rank: index + 1,
        ...player,
        kd_ratio: player.deaths > 0 ? (player.kills / player.deaths).toFixed(2) : player.kills
      }));
    } catch (error) {
      throw error;
    }
  }

  // Update player status
  async updatePlayerStatus(socket, data) {
    try {
      const { status, game_mode, region } = data;
      const userId = socket.userId;

      if (!userId) return;

      // Update player status in Redis
      await redisHelper.setex(
        `player_status:${userId}`,
        300, // 5 minutes
        {
          status, // online, in_game, in_lobby, offline
          game_mode,
          region,
          socket_id: socket.id,
          last_update: new Date().toISOString()
        }
      );

      // Broadcast status to friends
      const friends = await this.getPlayerFriends(userId);
      friends.forEach(friend => {
        socket.to(`user_${friend.id}`).emit('friend_status_update', {
          user_id: userId,
          status,
          game_mode,
          region
        });
      });
    } catch (error) {
      console.error('Error updating player status:', error);
    }
  }

  // Get player friends
  async getPlayerFriends(userId) {
    try {
      const friends = await db('friendships')
        .join('users', function() {
          this.on('users.id', '=', db.raw('CASE WHEN friendships.user_id = ? THEN friendships.friend_id ELSE friendships.user_id END', [userId]));
        })
        .where(function() {
          this.where('friendships.user_id', userId)
            .orWhere('friendships.friend_id', userId);
        })
        .where('friendships.status', 'accepted')
        .select('users.id', 'users.username');

      return friends;
    } catch (error) {
      throw error;
    }
  }

  // Search players
  async searchPlayers(query, limit = 20) {
    try {
      const players = await db('player_profiles')
        .join('users', 'player_profiles.user_id', 'users.id')
        .where('users.is_active', true)
        .where('users.is_banned', false)
        .where(function() {
          this.where('player_profiles.display_name', 'ilike', `%${query}%`)
            .orWhere('users.username', 'ilike', `%${query}%`);
        })
        .select(
          'users.id',
          'users.username',
          'player_profiles.display_name',
          'player_profiles.level',
          'player_profiles.avatar_url'
        )
        .limit(limit);

      return players;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new EpoPlayerService();