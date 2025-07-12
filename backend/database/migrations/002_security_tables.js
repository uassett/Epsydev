exports.up = function(knex) {
  return Promise.all([
    // HWID bans table
    knex.schema.createTable('hwid_bans', function(table) {
      table.uuid('id').primary();
      table.string('hwid').notNullable();
      table.string('admin_id').nullable();
      table.string('reason').notNullable();
      table.timestamp('expires_at').nullable();
      table.boolean('is_active').defaultTo(true);
      table.string('revoked_by').nullable();
      table.timestamp('revoked_at').nullable();
      table.string('revoke_reason').nullable();
      table.timestamps(true, true);
      table.index('hwid');
    }),

    // Bans table
    knex.schema.createTable('bans', function(table) {
      table.uuid('id').primary();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('admin_id').nullable();
      table.string('reason').notNullable();
      table.enum('ban_type', ['temporary', 'permanent']).notNullable();
      table.integer('duration').nullable(); // days
      table.timestamp('expires_at').nullable();
      table.boolean('is_active').defaultTo(true);
      table.string('revoked_by').nullable();
      table.timestamp('revoked_at').nullable();
      table.string('revoke_reason').nullable();
      table.timestamps(true, true);
      table.index('user_id');
    }),

    // Security reports table
    knex.schema.createTable('security_reports', function(table) {
      table.uuid('id').primary();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.enum('activity_type', [
        'multiple_accounts_same_hwid',
        'rapid_fire_requests',
        'impossible_stats',
        'hwid_mismatch',
        'vpn_usage',
        'suspicious_gameplay'
      ]).notNullable();
      table.json('details').nullable();
      table.integer('severity').notNullable(); // 1-10 scale
      table.enum('status', ['pending', 'reviewed', 'resolved', 'false_positive']).defaultTo('pending');
      table.timestamps(true, true);
      table.index(['user_id', 'activity_type']);
    }),

    // Security actions table
    knex.schema.createTable('security_actions', function(table) {
      table.uuid('id').primary();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.enum('action_type', ['warning', 'temporary_ban', 'permanent_ban', 'hwid_ban']).notNullable();
      table.string('reason').notNullable();
      table.integer('duration').nullable(); // days for temporary actions
      table.string('administered_by').notNullable(); // 'system' or admin ID
      table.timestamps(true, true);
      table.index('user_id');
    }),

    // Player reports table
    knex.schema.createTable('player_reports', function(table) {
      table.uuid('id').primary();
      table.uuid('reporter_id').references('id').inTable('users').onDelete('CASCADE');
      table.uuid('reported_user_id').references('id').inTable('users').onDelete('CASCADE');
      table.enum('reason', ['cheating', 'harassment', 'inappropriate_name', 'griefing', 'other']).notNullable();
      table.text('description').notNullable();
      table.json('evidence').nullable(); // URLs to screenshots/videos
      table.enum('status', ['pending', 'investigating', 'resolved', 'dismissed']).defaultTo('pending');
      table.string('admin_notes').nullable();
      table.string('resolved_by').nullable();
      table.timestamp('resolved_at').nullable();
      table.timestamps(true, true);
      table.index(['reporter_id', 'reported_user_id']);
    }),

    // Login attempts table
    knex.schema.createTable('login_attempts', function(table) {
      table.uuid('id').primary();
      table.string('username').notNullable();
      table.string('ip_address').notNullable();
      table.boolean('success').notNullable();
      table.string('failure_reason').nullable();
      table.string('user_agent').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index(['username', 'created_at']);
      table.index(['ip_address', 'created_at']);
    }),

    // Password resets table
    knex.schema.createTable('password_resets', function(table) {
      table.uuid('id').primary();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.string('token').notNullable().unique();
      table.timestamp('expires_at').notNullable();
      table.boolean('used').defaultTo(false);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.index('token');
    }),

    // Friendships table
    knex.schema.createTable('friendships', function(table) {
      table.uuid('id').primary();
      table.uuid('user_id').references('id').inTable('users').onDelete('CASCADE');
      table.uuid('friend_id').references('id').inTable('users').onDelete('CASCADE');
      table.enum('status', ['pending', 'accepted', 'blocked']).defaultTo('pending');
      table.timestamp('requested_at').defaultTo(knex.fn.now());
      table.timestamp('responded_at').nullable();
      table.unique(['user_id', 'friend_id']);
      table.index(['user_id', 'status']);
    })
  ]);
};

exports.down = function(knex) {
  return Promise.all([
    knex.schema.dropTableIfExists('friendships'),
    knex.schema.dropTableIfExists('password_resets'),
    knex.schema.dropTableIfExists('login_attempts'),
    knex.schema.dropTableIfExists('player_reports'),
    knex.schema.dropTableIfExists('security_actions'),
    knex.schema.dropTableIfExists('security_reports'),
    knex.schema.dropTableIfExists('bans'),
    knex.schema.dropTableIfExists('hwid_bans')
  ]);
};