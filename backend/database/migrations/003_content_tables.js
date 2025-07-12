exports.up = function(knex) {
  return Promise.all([
    // Item shop rotations table
    knex.schema.createTable('item_shop_rotations', function(table) {
      table.uuid('id').primary();
      table.uuid('item_id').references('id').inTable('items').onDelete('CASCADE');
      table.integer('original_price').notNullable();
      table.integer('discounted_price').nullable();
      table.boolean('featured').defaultTo(false);
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      table.index(['is_active', 'featured']);
    }),

    // News table
    knex.schema.createTable('news', function(table) {
      table.uuid('id').primary();
      table.string('title').notNullable();
      table.text('content').notNullable();
      table.text('summary').nullable();
      table.string('category').nullable();
      table.json('tags').nullable();
      table.timestamp('publish_date').defaultTo(knex.fn.now());
      table.boolean('is_published').defaultTo(false);
      table.string('author_id').nullable();
      table.timestamps(true, true);
      table.index(['is_published', 'publish_date']);
    }),

    // Game events table
    knex.schema.createTable('game_events', function(table) {
      table.uuid('id').primary();
      table.string('name').notNullable();
      table.text('description').notNullable();
      table.enum('type', ['limited_time', 'seasonal', 'tournament', 'community']).notNullable();
      table.json('rewards').nullable();
      table.timestamp('start_date').notNullable();
      table.timestamp('end_date').notNullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamps(true, true);
      table.index(['is_active', 'start_date', 'end_date']);
    }),

    // Battle pass rewards table
    knex.schema.createTable('battle_pass_rewards', function(table) {
      table.uuid('id').primary();
      table.uuid('season_id').references('id').inTable('seasons').onDelete('CASCADE');
      table.integer('tier').notNullable();
      table.enum('track', ['free', 'premium']).notNullable();
      table.uuid('item_id').references('id').inTable('items').nullable();
      table.integer('vbucks_amount').nullable();
      table.string('reward_type').notNullable(); // 'item', 'vbucks', 'experience', 'other'
      table.json('metadata').nullable();
      table.timestamps(true, true);
      table.index(['season_id', 'tier', 'track']);
    }),

    // User achievements table
    knex.schema.createTable('user_achievements', function(table) {
      table.uuid('id').primary();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('achievement_id').notNullable();
      table.timestamp('unlocked_at').defaultTo(knex.fn.now());
      table.json('progress_data').nullable();
      table.unique(['user_id', 'achievement_id']);
      table.index('user_id');
    }),

    // Game modes table
    knex.schema.createTable('game_modes', function(table) {
      table.string('id').primary();
      table.string('name').notNullable();
      table.text('description').nullable();
      table.integer('max_players').notNullable();
      table.integer('min_players').defaultTo(1);
      table.boolean('is_active').defaultTo(true);
      table.boolean('is_featured').defaultTo(false);
      table.json('settings').nullable();
      table.timestamps(true, true);
    }),

    // Server regions table
    knex.schema.createTable('server_regions', function(table) {
      table.string('id').primary();
      table.string('name').notNullable();
      table.string('location').notNullable();
      table.json('server_endpoints').notNullable();
      table.boolean('is_active').defaultTo(true);
      table.integer('max_capacity').notNullable();
      table.integer('current_load').defaultTo(0);
      table.timestamps(true, true);
    }),

    // Cosmetic presets table
    knex.schema.createTable('cosmetic_presets', function(table) {
      table.uuid('id').primary();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('name').notNullable();
      table.uuid('skin_id').references('id').inTable('items').nullable();
      table.uuid('pickaxe_id').references('id').inTable('items').nullable();
      table.uuid('glider_id').references('id').inTable('items').nullable();
      table.uuid('wrap_id').references('id').inTable('items').nullable();
      table.uuid('music_id').references('id').inTable('items').nullable();
      table.json('emote_slots').nullable(); // Array of emote IDs
      table.boolean('is_active').defaultTo(false);
      table.timestamps(true, true);
      table.index('user_id');
    }),

    // Daily challenges table
    knex.schema.createTable('daily_challenges', function(table) {
      table.uuid('id').primary();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('challenge_type').notNullable(); // 'kills', 'wins', 'damage', etc.
      table.text('description').notNullable();
      table.integer('target_value').notNullable();
      table.integer('current_progress').defaultTo(0);
      table.integer('xp_reward').notNullable();
      table.integer('vbucks_reward').defaultTo(0);
      table.boolean('is_completed').defaultTo(false);
      table.date('expires_at').notNullable();
      table.timestamp('completed_at').nullable();
      table.timestamps(true, true);
      table.index(['user_id', 'expires_at', 'is_completed']);
    })
  ]);
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('daily_challenges'),
    knex.schema.dropTableIfExists('cosmetic_presets'),
    knex.schema.dropTableIfExists('server_regions'),
    knex.schema.dropTableIfExists('game_modes'),
    knex.schema.dropTableIfExists('user_achievements'),
    knex.schema.dropTableIfExists('battle_pass_rewards'),
    knex.schema.dropTableIfExists('game_events'),
    knex.schema.dropTableIfExists('news'),
    knex.schema.dropTableIfExists('item_shop_rotations')
  ]);
};