CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"telegram_user_id" bigint NOT NULL UNIQUE,
	"holding_usdt" numeric(20,2) DEFAULT '0' NOT NULL,
	"role" text DEFAULT 'Operator',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"label" text NOT NULL,
	"bank_name" text NOT NULL,
	"account_number" text,
	"current_balance" numeric(20,2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_metrics" (
	"id" text PRIMARY KEY DEFAULT 'singleton',
	"error_rate" numeric DEFAULT '0' NOT NULL,
	"avg_response_ms" numeric DEFAULT '0' NOT NULL,
	"rate_limit_pct" numeric DEFAULT '0' NOT NULL,
	"uptime_seconds" bigint DEFAULT 0 NOT NULL,
	"total_requests" bigint DEFAULT 0 NOT NULL,
	"total_errors" bigint DEFAULT 0 NOT NULL,
	"bot_started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bot_sessions" (
	"chat_id" bigint,
	"telegram_user_id" bigint,
	"admin_id" uuid,
	"admin_name" text,
	"state" text NOT NULL,
	"pending_type" text,
	"slip_url" text,
	"caption" text,
	"ocr_thb" numeric,
	"pending_usdt" numeric,
	"usdt_network" text,
	"usdt_txid" text,
	"usdt_image_url" text,
	"ocr_conf" numeric(6,2),
	"ledger_ref" text,
	"slip_receiver_name" text,
	"slip_fingerprint" text,
	"live_message_id" bigint,
	"live_tx_id" uuid,
	"vision_message_id" bigint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bot_sessions_pkey" PRIMARY KEY("chat_id","telegram_user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_settings" (
	"chat_id" bigint PRIMARY KEY,
	"room_name" text,
	"sell_rate" numeric(20,4),
	"day_cut_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_login_attempts" (
	"ip" text PRIMARY KEY,
	"attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pinned_bank_accounts" (
	"chat_id" bigint,
	"bank_account_id" uuid,
	"pinned_for_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pinned_bank_accounts_pkey" PRIMARY KEY("chat_id","bank_account_id","pinned_for_date")
);
--> statement-breakpoint
CREATE TABLE "rates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"sell_rate" numeric(20,4) NOT NULL,
	"market_usdt_rate" numeric(20,4) NOT NULL,
	"set_by_admin_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receivers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL,
	"bank_name" text,
	"account_number" text,
	"last4" text,
	"total_volume_thb" numeric(20,2) DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"key" text PRIMARY KEY,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "telegram_updates" (
	"update_id" bigint PRIMARY KEY,
	"claimed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_status_logs" (
	"id" bigserial PRIMARY KEY,
	"transaction_id" uuid NOT NULL,
	"status" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"admin_id" uuid NOT NULL,
	"bank_account_id" uuid,
	"receiver_id" uuid,
	"type" text NOT NULL,
	"status" text DEFAULT 'ocr_success',
	"thb_amount" numeric(20,2) DEFAULT '0' NOT NULL,
	"usdt_amount" numeric(20,2) DEFAULT '0' NOT NULL,
	"sell_rate" numeric(20,4) DEFAULT '0' NOT NULL,
	"buy_rate" numeric(20,4),
	"cost_per_unit" numeric(20,4) DEFAULT '0' NOT NULL,
	"sell_value_thb" numeric(20,2) DEFAULT '0' NOT NULL,
	"net_profit_thb" numeric(20,2) DEFAULT '0' NOT NULL,
	"profit_percent" numeric(20,4) DEFAULT '0' NOT NULL,
	"expected_usdt" numeric(20,2) DEFAULT '0' NOT NULL,
	"fee_usdt" numeric(20,2) DEFAULT '0' NOT NULL,
	"fee_percent" numeric(20,4) DEFAULT '0' NOT NULL,
	"note" text,
	"slip_image_url" text,
	"slip_fingerprint" text,
	"room_name" text,
	"ocr_confidence" numeric(6,2),
	"usdt_network" text,
	"usdt_txid" text,
	"usdt_image_url" text,
	"receiver_name" text,
	"receiver_bank" text,
	"receiver_last4" text,
	"ledger_ref" text,
	"chat_id" bigint,
	"live_message_id" bigint,
	"live_chat_id" bigint,
	"live_status" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pinned_bank_accounts" ADD CONSTRAINT "pinned_bank_accounts_bank_account_id_bank_accounts_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "rates" ADD CONSTRAINT "rates_set_by_admin_id_admins_id_fkey" FOREIGN KEY ("set_by_admin_id") REFERENCES "admins"("id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_admin_id_admins_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins"("id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bank_account_id_bank_accounts_id_fkey" FOREIGN KEY ("bank_account_id") REFERENCES "bank_accounts"("id");--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_receiver_id_receivers_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "receivers"("id");