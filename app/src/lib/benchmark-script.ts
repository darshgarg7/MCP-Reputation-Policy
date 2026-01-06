/**
 * Reference k6 script for reproducing the load test in benchmark-results.ts.
 * Exported as a string so the UI can offer it as a download.
 */

export const K6_SCRIPT_FILENAME = "rpl-loadtest.js";

export const K6_SCRIPT = `import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

// ---------------------------------------------------------------------------
// RPL load test — reproduces the artifact in /observability.
// Run:   k6 run -e BASE_URL=https://api.example.com rpl-loadtest.js
// ---------------------------------------------------------------------------

const BASE = __ENV.BASE_URL || 'http://localhost:8000/api/v1';

const policyLatency = new Trend('rpl_policy_latency_ms');
const decisionErrors = new Rate('rpl_decision_errors');

export const options = {
  scenarios: {
    sustained: {
      executor: 'ramping-arrival-rate',
      startRate: 100,
      timeUnit: '1s',
      preAllocatedVUs: 200,
      maxVUs: 800,
      stages: [
        { target: 5000, duration: '2m' }, // ramp
        { target: 5000, duration: '6m' }, // hold
        { target: 0,    duration: '2m' }, // drain
      ],
    },
  },
  thresholds: {
    'http_req_duration{status:200}': ['p(95)<200', 'p(99)<300'],
    rpl_decision_errors: ['rate<0.01'],
  },
};

const TOOLS = ['MATH_COMPUTE', 'WEB_SEARCH', 'FINANCIAL_DATA', 'RESEARCH_DB', 'NEWS_FEED'];
const RISKS = ['low', 'medium', 'high'];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

export default function () {
  const payload = JSON.stringify({
    prompt: 'k6 synthetic request',
    tool_type: pick(TOOLS),
    goal: {
      goal_type: 'general',
      risk_tolerance: pick(RISKS),
      latency_priority: pick(['low','medium','high']),
      accuracy_priority: pick(['low','medium','high']),
    },
  });

  const res = http.post(\`\${BASE}/execute\`, payload, {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'execute' },
  });

  policyLatency.add(res.timings.duration);
  decisionErrors.add(res.status !== 200);

  check(res, {
    'status 200': (r) => r.status === 200,
    'has server_id': (r) => !!(r.json() || {}).server_id,
  });

  sleep(0.05);
}
`;
