-- supabase/init.sql
-- 结构化动态仓位配置亏损计划 - 数据库初始化

CREATE TABLE IF NOT EXISTS pools (
  id          INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name        VARCHAR(20) NOT NULL UNIQUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO pools (name, sort_order) VALUES
  ('共有', 1), ('春', 2), ('维', 3), ('队', 4), ('回', 5)
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS capital_log (
  id          INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pool_id     INT REFERENCES pools(id),
  type        VARCHAR(10) NOT NULL CHECK (type IN ('add', 'remove')),
  amount      DECIMAL(15,2) NOT NULL,
  note        TEXT,
  created_by  VARCHAR(20) NOT NULL DEFAULT 'admin',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id              INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pool_id         INT NOT NULL REFERENCES pools(id),
  stock_code      VARCHAR(6) NOT NULL,
  stock_name      VARCHAR(30),
  type            VARCHAR(4) NOT NULL CHECK (type IN ('buy', 'sell')),
  quantity        INT NOT NULL,
  price           DECIMAL(10,3) NOT NULL,
  amount          DECIMAL(15,2) NOT NULL,
  fee             DECIMAL(10,2) DEFAULT 0,
  status          VARCHAR(10) DEFAULT 'pending' CHECK (status IN ('pending', 'verified')),
  actual_amount   DECIMAL(15,2),
  trade_date      DATE NOT NULL,
  note            TEXT,
  created_by      VARCHAR(20) NOT NULL DEFAULT 'admin',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS holdings (
  id          INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  pool_id     INT NOT NULL REFERENCES pools(id),
  stock_code  VARCHAR(6) NOT NULL,
  stock_name  VARCHAR(30),
  quantity    INT NOT NULL DEFAULT 0,
  cost_price  DECIMAL(10,3) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(pool_id, stock_code)
);

CREATE TABLE IF NOT EXISTS stock_cache (
  stock_code    VARCHAR(6) PRIMARY KEY,
  stock_name    VARCHAR(30),
  price         DECIMAL(10,3),
  change_pct    DECIMAL(6,2),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_config (
  key   VARCHAR(50) PRIMARY KEY,
  value TEXT NOT NULL
);

INSERT INTO app_config (key, value) VALUES
  ('password_hash', 'MTExMQ==')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_capital_log_pool ON capital_log(pool_id);
CREATE INDEX IF NOT EXISTS idx_transactions_pool ON transactions(pool_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(trade_date);
CREATE INDEX IF NOT EXISTS idx_holdings_pool ON holdings(pool_id);
