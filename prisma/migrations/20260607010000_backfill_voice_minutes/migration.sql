-- Backfill voice minutes for tenants that already existed when the voice columns
-- were added (the column defaulted to 0; applyPlanLimits only sets it on plan change).
-- Idempotent: the "= 0" guard makes a re-run a no-op. Only Business has voice.
UPDATE usage_limits
SET "monthlyVoiceMinutes" = 300
FROM tenants
WHERE tenants.id = usage_limits."tenantId"
  AND tenants.plan = 'business'
  AND usage_limits."monthlyVoiceMinutes" = 0;
