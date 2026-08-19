import {
  pgTable,
  uuid,
  text,
  numeric,
  bigint,
  timestamp,
  date,
  integer,
  jsonb,
  bigserial,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

// 1) admins
export const admins = pgTable("admins", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  telegramUserId: bigint("telegram_user_id", { mode: "number" }).notNull().unique(),
  holdingUsdt: numeric("holding_usdt", { precision: 20, scale: 2 }).notNull().default("0"),
  role: text("role").default("Operator"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 2) bank_accounts
export const bankAccounts = pgTable("bank_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  label: text("label").notNull(),
  bankName: text("bank_name").notNull(),
  accountNumber: text("account_number"),
  currentBalance: numeric("current_balance", { precision: 20, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 3) pinned_bank_accounts
export const pinnedBankAccounts = pgTable(
  "pinned_bank_accounts",
  {
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    bankAccountId: uuid("bank_account_id")
      .notNull()
      .references(() => bankAccounts.id, { onDelete: "cascade" }),
    pinnedForDate: date("pinned_for_date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.bankAccountId, table.pinnedForDate] }),
  ]
);

// 4) receivers
export const receivers = pgTable("receivers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  bankName: text("bank_name"),
  accountNumber: text("account_number"),
  last4: text("last4"),
  totalVolumeThb: numeric("total_volume_thb", { precision: 20, scale: 2 }).notNull().default("0"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 5) transactions
export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  adminId: uuid("admin_id").notNull().references(() => admins.id),
  bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id),
  receiverId: uuid("receiver_id").references(() => receivers.id),
  type: text("type").notNull(), // 'THB_DEPOSIT' | 'USDT_SEND'
  status: text("status").default("ocr_success"),
  thbAmount: numeric("thb_amount", { precision: 20, scale: 2 }).notNull().default("0"),
  usdtAmount: numeric("usdt_amount", { precision: 20, scale: 2 }).notNull().default("0"),
  sellRate: numeric("sell_rate", { precision: 20, scale: 4 }).notNull().default("0"),
  buyRate: numeric("buy_rate", { precision: 20, scale: 4 }),
  costPerUnit: numeric("cost_per_unit", { precision: 20, scale: 4 }).notNull().default("0"),
  sellValueThb: numeric("sell_value_thb", { precision: 20, scale: 2 }).notNull().default("0"),
  netProfitThb: numeric("net_profit_thb", { precision: 20, scale: 2 }).notNull().default("0"),
  profitPercent: numeric("profit_percent", { precision: 20, scale: 4 }).notNull().default("0"),
  expectedUsdt: numeric("expected_usdt", { precision: 20, scale: 2 }).notNull().default("0"),
  feeUsdt: numeric("fee_usdt", { precision: 20, scale: 2 }).notNull().default("0"),
  feePercent: numeric("fee_percent", { precision: 20, scale: 4 }).notNull().default("0"),
  note: text("note"),
  slipImageUrl: text("slip_image_url"),
  slipFingerprint: text("slip_fingerprint"),
  roomName: text("room_name"),
  ocrConfidence: numeric("ocr_confidence", { precision: 6, scale: 2 }),
  usdtNetwork: text("usdt_network"),
  usdtTxid: text("usdt_txid"),
  usdtImageUrl: text("usdt_image_url"),
  receiverName: text("receiver_name"),
  receiverBank: text("receiver_bank"),
  receiverLast4: text("receiver_last4"),
  ledgerRef: text("ledger_ref"),
  chatId: bigint("chat_id", { mode: "number" }),
  liveMessageId: bigint("live_message_id", { mode: "number" }),
  liveChatId: bigint("live_chat_id", { mode: "number" }),
  liveStatus: text("live_status"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  uniqueIndex("uq_transactions_slip_fingerprint").on(table.slipFingerprint),
  uniqueIndex("uq_transactions_ledger_ref").on(table.ledgerRef),
]);

// 6) transaction_status_logs
export const transactionStatusLogs = pgTable("transaction_status_logs", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  transactionId: uuid("transaction_id").notNull(),
  status: text("status").notNull(),
  meta: jsonb("meta"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// 7) rates
export const rates = pgTable("rates", {
  id: uuid("id").primaryKey().defaultRandom(),
  sellRate: numeric("sell_rate", { precision: 20, scale: 4 }).notNull(),
  marketUsdtRate: numeric("market_usdt_rate", { precision: 20, scale: 4 }).notNull(),
  setByAdminId: uuid("set_by_admin_id").references(() => admins.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// 8) bot_sessions
export const botSessions = pgTable(
  "bot_sessions",
  {
    chatId: bigint("chat_id", { mode: "number" }).notNull(),
    telegramUserId: bigint("telegram_user_id", { mode: "number" }).notNull(),
    adminId: uuid("admin_id"),
    adminName: text("admin_name"),
    state: text("state").notNull(),
    pendingType: text("pending_type"),
    slipUrl: text("slip_url"),
    caption: text("caption"),
    ocrThb: numeric("ocr_thb"),
    pendingUsdt: numeric("pending_usdt"),
    usdtNetwork: text("usdt_network"),
    usdtTxid: text("usdt_txid"),
    usdtImageUrl: text("usdt_image_url"),
    ocrConf: numeric("ocr_conf", { precision: 6, scale: 2 }),
    ledgerRef: text("ledger_ref"),
    slipReceiverName: text("slip_receiver_name"),
    slipFingerprint: text("slip_fingerprint"),
    liveMessageId: bigint("live_message_id", { mode: "number" }),
    liveTxId: uuid("live_tx_id"),
    visionMessageId: bigint("vision_message_id", { mode: "number" }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.chatId, table.telegramUserId] }),
  ]
);

// 9) chat_settings
export const chatSettings = pgTable("chat_settings", {
  chatId: bigint("chat_id", { mode: "number" }).primaryKey(),
  roomName: text("room_name"),
  sellRate: numeric("sell_rate", { precision: 20, scale: 4 }),
  dayCutAt: timestamp("day_cut_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 10) telegram_updates
export const telegramUpdates = pgTable("telegram_updates", {
  updateId: bigint("update_id", { mode: "number" }).primaryKey(),
  claimedAt: timestamp("claimed_at", { withTimezone: true }).notNull().defaultNow(),
});

// 11) system_settings
export const systemSettings = pgTable("system_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

// 12) dashboard_login_attempts
export const dashboardLoginAttempts = pgTable("dashboard_login_attempts", {
  ip: text("ip").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// 13) bot_metrics
export const botMetrics = pgTable("bot_metrics", {
  id: text("id").primaryKey().default("singleton"),
  errorRate: numeric("error_rate").notNull().default("0"),
  avgResponseMs: numeric("avg_response_ms").notNull().default("0"),
  rateLimitPct: numeric("rate_limit_pct").notNull().default("0"),
  uptimeSeconds: bigint("uptime_seconds", { mode: "number" }).notNull().default(0),
  totalRequests: bigint("total_requests", { mode: "number" }).notNull().default(0),
  totalErrors: bigint("total_errors", { mode: "number" }).notNull().default(0),
  botStartedAt: timestamp("bot_started_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
