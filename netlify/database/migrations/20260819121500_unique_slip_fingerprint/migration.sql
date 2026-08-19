CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_slip_fingerprint
  ON public.transactions (slip_fingerprint)
  WHERE slip_fingerprint IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_ledger_ref
  ON public.transactions (ledger_ref)
  WHERE ledger_ref IS NOT NULL;
