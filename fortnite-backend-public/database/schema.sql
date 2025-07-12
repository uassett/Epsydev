-- Fortnite Backend Database Schema
-- PostgreSQL 12+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Players table
CREATE TABLE players (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(30) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(50) NOT NULL,
    is_admin BOOLEAN DEFAULT FALSE,
    banned BOOLEAN DEFAULT FALSE,
    ban_reason TEXT,
    banned_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_username CHECK (username ~ '^[a-zA-Z0-9]+$'),
    CONSTRAINT valid_email CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$')
);

-- Player wallets for economy
CREATE TABLE player_wallets (
    player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    vbucks INTEGER DEFAULT 0 CHECK (vbucks >= 0),
    gold_bars INTEGER DEFAULT 0 CHECK (gold_bars >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transaction history
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- 'purchase', 'earn', 'admin_add', etc.
    amount INTEGER NOT NULL, -- Can be negative for purchases
    currency VARCHAR(20) NOT NULL, -- 'vbucks', 'gold_bars'
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_currency CHECK (currency IN ('vbucks', 'gold_bars'))
);

-- Player inventory
CREATE TABLE player_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    item_id VARCHAR(255) NOT NULL, -- Item template ID from config
    acquired_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id, item_id)
);

-- Player statistics
CREATE TABLE player_stats (
    player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    wins INTEGER DEFAULT 0 CHECK (wins >= 0),
    kills INTEGER DEFAULT 0 CHECK (kills >= 0),
    matches_played INTEGER DEFAULT 0 CHECK (matches_played >= 0),
    playtime INTEGER DEFAULT 0 CHECK (playtime >= 0), -- in seconds
    level INTEGER DEFAULT 1 CHECK (level >= 1),
    xp INTEGER DEFAULT 0 CHECK (xp >= 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Item shop current state (optional - can use config files instead)
CREATE TABLE item_shop (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    item_id VARCHAR(255) NOT NULL,
    section VARCHAR(50) NOT NULL, -- 'featured', 'daily', 'bundles'
    display_order INTEGER DEFAULT 0,
    price INTEGER NOT NULL CHECK (price > 0),
    currency VARCHAR(20) NOT NULL CHECK (currency IN ('vbucks', 'gold_bars')),
    is_active BOOLEAN DEFAULT TRUE,
    available_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Game matches (for tracking)
CREATE TABLE matches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    game_mode VARCHAR(50) NOT NULL,
    region VARCHAR(20) NOT NULL,
    players_count INTEGER NOT NULL CHECK (players_count > 0),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE,
    winner_id UUID REFERENCES players(id),
    match_data JSONB -- Additional match information
);

-- Match participants
CREATE TABLE match_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    match_id UUID NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    placement INTEGER, -- Final placement (1 = winner)
    kills INTEGER DEFAULT 0,
    damage_dealt INTEGER DEFAULT 0,
    time_survived INTEGER DEFAULT 0, -- in seconds
    left_early BOOLEAN DEFAULT FALSE,
    
    UNIQUE(match_id, player_id)
);

-- Friend system
CREATE TABLE friendships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    addressee_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'accepted', 'blocked'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(requester_id, addressee_id),
    CONSTRAINT no_self_friend CHECK (requester_id != addressee_id),
    CONSTRAINT valid_status CHECK (status IN ('pending', 'accepted', 'blocked'))
);

-- Server regions and status
CREATE TABLE server_regions (
    id VARCHAR(20) PRIMARY KEY, -- 'NA-EAST', 'EU-WEST', etc.
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'online', -- 'online', 'offline', 'maintenance'
    player_count INTEGER DEFAULT 0 CHECK (player_count >= 0),
    max_players INTEGER DEFAULT 1000 CHECK (max_players > 0),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Battle pass progress (if enabled)
CREATE TABLE battle_pass_progress (
    player_id UUID PRIMARY KEY REFERENCES players(id) ON DELETE CASCADE,
    season INTEGER NOT NULL,
    chapter INTEGER NOT NULL,
    tier INTEGER DEFAULT 1 CHECK (tier >= 1),
    xp INTEGER DEFAULT 0 CHECK (xp >= 0),
    is_premium BOOLEAN DEFAULT FALSE,
    purchased_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Battle pass rewards claimed
CREATE TABLE battle_pass_rewards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    season INTEGER NOT NULL,
    chapter INTEGER NOT NULL,
    tier INTEGER NOT NULL,
    item_id VARCHAR(255) NOT NULL,
    claimed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(player_id, season, chapter, tier, item_id)
);

-- Admin logs
CREATE TABLE admin_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES players(id),
    action VARCHAR(100) NOT NULL,
    target_player_id UUID REFERENCES players(id),
    details JSONB,
    ip_address INET,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for better performance
CREATE INDEX idx_players_username ON players(username);
CREATE INDEX idx_players_email ON players(email);
CREATE INDEX idx_transactions_player_id ON transactions(player_id);
CREATE INDEX idx_transactions_created_at ON transactions(created_at);
CREATE INDEX idx_player_inventory_player_id ON player_inventory(player_id);
CREATE INDEX idx_match_participants_player_id ON match_participants(player_id);
CREATE INDEX idx_match_participants_match_id ON match_participants(match_id);
CREATE INDEX idx_friendships_requester ON friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON friendships(addressee_id);
CREATE INDEX idx_battle_pass_progress_player_season ON battle_pass_progress(player_id, season, chapter);

-- Triggers for updating timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_player_wallets_updated_at 
    BEFORE UPDATE ON player_wallets 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_player_stats_updated_at 
    BEFORE UPDATE ON player_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_friendships_updated_at 
    BEFORE UPDATE ON friendships 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_server_regions_updated_at 
    BEFORE UPDATE ON server_regions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_battle_pass_progress_updated_at 
    BEFORE UPDATE ON battle_pass_progress 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default server regions
INSERT INTO server_regions (id, name, status, max_players) VALUES
('NA-EAST', 'North America East', 'online', 1000),
('NA-WEST', 'North America West', 'online', 1000),
('EU-WEST', 'Europe West', 'online', 1000),
('EU-CENTRAL', 'Europe Central', 'online', 1000),
('ASIA', 'Asia', 'online', 1000),
('OCEANIA', 'Oceania', 'online', 500);

-- Create a default admin user (change credentials immediately)
-- Password is 'admin123' - CHANGE THIS IMMEDIATELY
INSERT INTO players (username, email, password_hash, display_name, is_admin) VALUES
('admin', 'admin@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeKlEnBkEQHIwLY4u', 'Administrator', TRUE);

-- Initialize admin wallet
INSERT INTO player_wallets (player_id, vbucks, gold_bars) 
SELECT id, 99999, 99999 FROM players WHERE username = 'admin';