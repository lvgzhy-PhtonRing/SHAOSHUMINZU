-- supabase/init.sql
-- 结构化动态仓位配置亏损计划 - 数据库初始化

CREATE TABLE IF NOT EXISTS pools (
  id          INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  name        VARCHAR(20) NOT NULL UNIQUE,
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO pools (name, sort_order) VALUES
  ('公共池', 1), ('春', 2), ('维', 3), ('队', 4), ('回', 5)
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
  cost_price  DECIMAL(15,6) NOT NULL DEFAULT 0,
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

-- 密码不在此处初始化。应用使用客户端 localStorage 存储密码哈希。
-- 若需服务端密码验证，请使用 bcrypt/scrypt 并通过 settings 页面设置初始密码。
--
-- ⚠️ 安全提醒：
--   Base64 编码不是加密，不能用于保护密码。
--   如需正式部署，应将认证迁移至 Supabase Auth（JWT + RLS）。

CREATE INDEX IF NOT EXISTS idx_capital_log_pool ON capital_log(pool_id);
CREATE INDEX IF NOT EXISTS idx_transactions_pool ON transactions(pool_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(trade_date);
CREATE INDEX IF NOT EXISTS idx_holdings_pool ON holdings(pool_id);
