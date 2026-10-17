CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'rejected', 'expired', 'submitted');--> statement-breakpoint
CREATE TYPE "public"."network" AS ENUM('testnet', 'mainnet');--> statement-breakpoint
CREATE TYPE "public"."payment_source" AS ENUM('x402', 'direct');--> statement-breakpoint
CREATE TABLE "agent_accounts" (
	"contract_id" text PRIMARY KEY NOT NULL,
	"owner_public_key" text NOT NULL,
	"agent_public_key" text NOT NULL,
	"label" text NOT NULL,
	"network" "network" NOT NULL,
	"token" text NOT NULL,
	"api_key_id" text NOT NULL,
	"api_key_hash" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "approval_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text NOT NULL,
	"token" text NOT NULL,
	"to_address" text NOT NULL,
	"amount" text NOT NULL,
	"reason" text NOT NULL,
	"approval_tx_hash" text,
	"status" "approval_status" NOT NULL,
	"rejection_reason" text,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indexer_cursors" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_challenges" (
	"nonce" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"message" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "owner_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"public_key" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_records" (
	"id" text PRIMARY KEY NOT NULL,
	"contract_id" text NOT NULL,
	"token" text NOT NULL,
	"to_address" text NOT NULL,
	"amount" text NOT NULL,
	"tx_hash" text NOT NULL,
	"ledger" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"source" "payment_source" NOT NULL,
	"resource" text
);
--> statement-breakpoint
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_contract_id_agent_accounts_contract_id_fk" FOREIGN KEY ("contract_id") REFERENCES "public"."agent_accounts"("contract_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_accounts_owner_idx" ON "agent_accounts" USING btree ("owner_public_key");--> statement-breakpoint
CREATE UNIQUE INDEX "agent_accounts_api_key_id_idx" ON "agent_accounts" USING btree ("api_key_id");--> statement-breakpoint
CREATE INDEX "approval_requests_contract_status_idx" ON "approval_requests" USING btree ("contract_id","status");--> statement-breakpoint
CREATE INDEX "approval_requests_status_expires_idx" ON "approval_requests" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "owner_sessions_expires_idx" ON "owner_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "payment_records_contract_ledger_idx" ON "payment_records" USING btree ("contract_id","ledger");