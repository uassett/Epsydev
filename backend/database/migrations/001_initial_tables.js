exports.up = function(knex) {
  return Promise.all([
    // Users table
    knex.schema.createTable('users', function(table) {
      table.uuid('id').primary();
      table.string('username').unique().notNullable();
      table.string('email').unique().notNullable();
      table.string('password').notNullable();
      table.string('hwid').notNullable();
      table.integer('epo_level').defaultTo(1);
      table.integer('vbucks').defaultTo(0);
      table.boolean('is_premium').defaultTo(false);
      table.enum('role', ['user', 'admin']).defaultTo('user');
      table.boolean('is_active').defaultTo(true);
      table.boolean('is_banned').defaultTo(false);
      table.string('ban_reason').nullable();
      table.timestamp('ban_expires').nullable();
      table.string('banned_by').nullable();
      table.timestamp('banned_at').nullable();
      table.boolean('email_verified').defaultTo(false);
      table.string('email_verification_token').nullable();
      table.timestamp('last_login').nullable();
      table.timestamp('last_activity').nullable();
      table.integer('login_count').defaultTo(0);
      table.timestamps(true, true);
    }),

    // Player profiles table
    knex.schema.createTable('player_profiles', function(table) {
      table.uuid('id').primary();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('display_name').notNullable();
      table.string('avatar_url').nullable();
      table.integer('level').defaultTo(1);
      table.integer('experience').defaultTo(0);
      table.integer('wins').defaultTo(0);
      table.integer('kills').defaultTo(0);
      table.integer('deaths').defaultTo(0);
      table.integer('matches_played').defaultTo(0);
      table.json('settings').nullable();
      table.timestamps(true, true);
    }),

    // Items table
    knex.schema.createTable('items', function(table) {
      table.uuid('id').primary();
      table.string('name').notNullable();
      table.text('description').nullable();
      table.enum('type', ['skin', 'emote', 'pickaxe', 'glider', 'wrap', 'music', 'loading_screen', 'spray', 'banner', 'emoticon']).notNullable();
      table.enum('rarity', ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic']).notNullable();
      table.integer('price').notNullable();
      table.json('tags').nullable();
      table.json('metadata').nullable();
      table.boolean('is_active').defaultTo(true);
      table.boolean('is_featured').defaultTo(false);
      table.boolean('is_exclusive').defaultTo(false);
      table.boolean('is_consumable').defaultTo(false);
      table.timestamp('deleted_at').nullable();
      table.timestamps(true, true);
    }),

    // Player inventory table
    knex.schema.createTable('player_inventory', function(table) {
      table.uuid('id').primary();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.uuid('item_id').references('id').inTable('items').onDelete('CASCADE');
      table.integer('quantity').defaultTo(1);
      table.boolean('equipped').defaultTo(false);
      table.timestamp('acquired_at').defaultTo(knex.fn.now());
      table.unique(['user_id', 'item_id']);
    }),

    // Transactions table
    knex.schema.createTable('transactions', function(table) {
      table.uuid('id').primary();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.enum('type', ['vbucks_purchase', 'item_purchase', 'vbucks_reward', 'battle_pass_purchase']).notNullable();
      table.uuid('item_id').references('id').inTable('items').nullable();
      table.integer('quantity').nullable();
      table.integer('amount').notNullable();
      table.enum('currency', ['USD', 'vbucks']).notNullable();
      table.decimal('price', 10, 2).nullable();
      table.string('payment_method').nullable();
      table.string('payment_id').nullable();
      table.string('reason').nullable();
      table.enum('status', ['pending', 'completed', 'failed', 'refunded']).defaultTo('pending');
      table.timestamps(true, true);
    }),

    // Seasons table
    knex.schema.createTable('seasons', function(table) {
      table.uuid('id').primary();
      table.string('name').notNullable();
      table.timestamp('start_date').notNullable();
      table.timestamp('end_date').notNullable();
      table.boolean('is_active').defaultTo(false);
      table.timestamps(true, true);
    }),

    // Battle passes table
    knex.schema.createTable('battle_passes', function(table) {
      table.uuid('id').primary();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.uuid('season_id').references('id').inTable('seasons').onDelete('CASCADE');
      table.integer('tier').defaultTo(1);
      table.integer('experience').defaultTo(0);
      table.boolean('has_premium').defaultTo(false);
      table.timestamps(true, true);
      table.unique(['user_id', 'season_id']);
    }),

    // Matches table
    knex.schema.createTable('matches', function(table) {
      table.uuid('id').primary();
      table.enum('game_mode', ['solo', 'duo', 'squad', 'ltm']).notNullable();
      table.enum('region', ['na', 'eu', 'oce', 'asia']).notNullable();
      table.string('server').notNullable();
      table.integer('max_players').notNullable();
      table.enum('status', ['starting', 'in_progress', 'completed', 'ended']).defaultTo('starting');
      table.string('end_reason').nullable();
      table.uuid('winner_id').references('id').inTable('users').nullable();
      table.integer('duration').nullable(); // in seconds
      table.timestamp('started_at').nullable();
      table.timestamp('ended_at').nullable();
      table.timestamps(true, true);
    }),

    // Match players table
    knex.schema.createTable('match_players', function(table) {
      table.uuid('id').primary();
      table.uuid('match_id').references('id').inTable('matches').onDelete('CASCADE');
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.integer('placement').nullable();
      table.integer('kills').defaultTo(0);
      table.integer('deaths').defaultTo(0);
      table.integer('damage_dealt').defaultTo(0);
      table.integer('damage_taken').defaultTo(0);
      table.integer('experience_gained').defaultTo(0);
      table.enum('status', ['active', 'disconnected', 'eliminated']).defaultTo('active');
      table.timestamp('joined_at').defaultTo(knex.fn.now());
      table.timestamp('disconnected_at').nullable();
      table.unique(['match_id', 'user_id']);
    }),

    // Season stats table
    knex.schema.createTable('season_stats', function(table) {
      table.uuid('id').primary();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.uuid('season_id').references('id').inTable('seasons').onDelete('CASCADE');
      table.integer('wins').defaultTo(0);
      table.integer('kills').defaultTo(0);
      table.integer('matches_played').defaultTo(0);
      table.integer('experience').defaultTo(0);
      table.integer('tier').defaultTo(1);
      table.integer('tier_progress').defaultTo(0);
      table.timestamps(true, true);
      table.unique(['user_id', 'season_id']);
    }),

    // Match history table
    knex.schema.createTable('match_history', function(table) {
      table.uuid('id').primary();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.uuid('match_id').references('id').inTable('matches').onDelete('CASCADE');
      table.enum('game_mode', ['solo', 'duo', 'squad', 'ltm']).notNullable();
      table.integer('kills').defaultTo(0);
      table.integer('deaths').defaultTo(0);
      table.integer('placement').nullable();
      table.integer('match_duration').nullable();
      table.integer('experience_gained').defaultTo(0);
      table.boolean('is_win').defaultTo(false);
      table.timestamps(true, true);
    })
  ]);
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('match_history'),
    knex.schema.dropTableIfExists('season_stats'),
    knex.schema.dropTableIfExists('match_players'),
    knex.schema.dropTableIfExists('matches'),
    knex.schema.dropTableIfExists('battle_passes'),
    knex.schema.dropTableIfExists('seasons'),
    knex.schema.dropTableIfExists('transactions'),
    knex.schema.dropTableIfExists('player_inventory'),
    knex.schema.dropTableIfExists('items'),
    knex.schema.dropTableIfExists('player_profiles'),
    knex.schema.dropTableIfExists('users')
  ]);
};