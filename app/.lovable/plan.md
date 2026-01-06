# Close the 5 remaining gaps

Five focused fixes to push the cold rating from 8.5 → 9.5+. No new routes.

## 1. Multi-region IaC (-0.5 → 0)

Rewrite `src/lib/deploy-snippets.ts`:
- **CDK**: `RplRegionalStack` instantiated 3x (us-east-1 primary, us-west-2 + eu-west-1 replicas). DynamoDB Global Table with `replicationRegions`. Bedrock cross-region application-inference-profile resource ARN. Route53 latency-based routing across all three.
- **Terraform**: Three provider aliases. `aws_dynamodb_table` with two `replica` blocks. `module "rpl_region"` with `for_each` over the regions list. `aws_route53_record` with `latency_routing_policy` per region.
- **CLI**: `for REGION in us-east-1 us-west-2 eu-west-1; do aws cloudformation deploy ... --region $REGION; done` plus the `update-table --replica-updates` promotion command.
- **Bootstrap**: `cdk bootstrap` for all 3 region/account pairs, then `deploy --all`.

## 2. Live cost from telemetry + FinOps tile (-0.3 + -0.2 → 0)

Extend `src/components/rpl/cost-calculator.tsx` with a live tile sourced from the telemetry ring buffer (no new sliders required):

- **"Live · last hour" card** above the projection panel, showing:
  - Current observed RPS (events / window seconds)
  - Inferred input/output token mix (from event count weighted by model defaults — sliders still drive the calc, but live RPS overrides the projection when telemetry is present)
  - "If sustained" extrapolated $/hour and $/month from real traffic
- **Unit economics row** below the cost breakdown:
  - **Cost per successful decision**: `total / success_count`
  - **Cost per avoided incident**: `monthlySavings / (avoidedRetryRate × monthlyRequests / typical_incident_size)`
  - **Blended COGS impact**: `monthly_cost / assumed_revenue_per_request_input` (with editable revenue/req field, default $0.05)
  - **Gross margin contribution**: `(revenue − cost) / revenue × 100%`

Pure additive — no breaking changes to existing controls.

## 3. Benchmark CI freshness (-0.3 → 0)

Update `src/components/rpl/benchmark-card.tsx` + `src/lib/benchmark-results.ts`:

- Add `ci_run_url`, `ci_workflow`, `commit_sha`, `next_run_at` fields to `BenchmarkArtifact`.
- Compute `daysAgo` from `date` and render a freshness pill:
  - Green "fresh" if ≤ 2 days
  - Amber "stale" if 3-14 days
  - Red "expired" if > 14 days
- Header gets a "Nightly · GitHub Actions" badge linking to the workflow file.
- "Next run in Xh" subtitle next to the date.
- "Refresh from CI" button that opens the run URL in a new tab.
- Bump `LATEST_BENCHMARK.date` to today (2026-04-28) so the demo opens green.

## 4. Tenant switcher (-0.2 → 0)

Add tenant context that visibly threads through the IAM story.

**New file `src/lib/tenant-store.ts`**: simple pub/sub holding `currentTenantId` (default `acme-prod`), with predefined list (`acme-prod`, `globex-eu`, `initech-staging`).

**`src/components/rpl/app-header.tsx`**: insert a tenant `<select>` between env and region. On change, fires a toast: "Switched to {tenant} · IAM session re-tagged with PrincipalTag/tenant=…".

**`src/components/rpl/iam-drawer.tsx`**: when the policy JSON contains `${aws:PrincipalTag/tenant}`, render a live overlay note: "Resolves to **{currentTenantId}** for this session — DynamoDB LeadingKeys condition isolates rows to this tenant."

**`src/components/rpl/telemetry-event.tsx`**: prefix `event.chosen_source_id` with the tenant pill (color-coded) so the operator sees tenant separation in the live feed.

This is fully client-side simulation — backend stays untouched, but the IAM isolation story becomes interactive instead of implied.

## Technical details

### Files to create
- `src/lib/tenant-store.ts` — pub/sub for currentTenantId

### Files to modify
- `src/lib/deploy-snippets.ts` — full rewrite for multi-region
- `src/lib/benchmark-results.ts` — add CI metadata fields
- `src/lib/aws-pricing.ts` — add `computeUnitEconomics()` helper returning cost-per-success, cost-per-avoided-incident, COGS, margin
- `src/components/rpl/benchmark-card.tsx` — freshness pill, CI badge, refresh button
- `src/components/rpl/cost-calculator.tsx` — Live tile + UnitEconomics row
- `src/components/rpl/app-header.tsx` — tenant switcher select
- `src/components/rpl/iam-drawer.tsx` — tenant resolution overlay on PrincipalTag references
- `src/components/rpl/telemetry-event.tsx` — tenant pill on event rows

### Out of scope
- No backend changes (tenant is UI-side simulation; backend already accepts requests without tenant header)
- No new routes
- No real CI integration (the CI URL points to a placeholder workflow file that would exist in a real repo)
