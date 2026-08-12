import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
    checks: ['rate>0.99'],
  },
  scenarios: {
    health: {
      executor: 'constant-vus',
      vus: 5,
      duration: '20s',
    },
  },
};

const baseUrl = __ENV.API_URL ?? 'http://127.0.0.1:3001';

export default function () {
  const live = http.get(`${baseUrl}/health/live`);
  check(live, { 'live répond 200': (response) => response.status === 200 });

  const ready = http.get(`${baseUrl}/health/ready`);
  check(ready, { 'ready répond 200': (response) => response.status === 200 });
  sleep(0.1);
}
