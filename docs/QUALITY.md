# CPI GO : quality gates

The repository has two levels of verification:

- `ci.yml`: required PR checks (format, lint, types, PostgreSQL integration,
  build, contract generation, mobile analysis). Unit tests are forbidden: the
  `node` job fails on any `*.test.ts`, `*.test.tsx` or `apps/mobile/test`
  file.
- `security.yml`: scheduled and PR security checks (Gitleaks, Semgrep,
  OSV-Scanner and Trivy).
- `quality-extended.yml`: scheduled/manual performance checks (Lighthouse and
  k6). These are intentionally separate from every PR so a slow browser or a
  hosted runner does not make a code review flaky.

## SonarQube Cloud

The Sonar job is activated only when the repository variable `SONAR_ENABLED` is
`true`. Configure these values in GitHub repository settings:

| Type     | Name                 | Value                                 |
| -------- | -------------------- | ------------------------------------- |
| Secret   | `SONAR_TOKEN`        | token created in SonarQube Cloud      |
| Variable | `SONAR_ENABLED`      | `true`                                |
| Variable | `SONAR_PROJECT_KEY`  | project key from SonarQube Cloud      |
| Variable | `SONAR_ORGANIZATION` | organization key from SonarQube Cloud |

The scan waits for the Sonar quality gate. Recommended gate conditions:

- no new blocker or critical issues;
- no new security hotspots left unreviewed;
- no coverage condition (no unit tests, no coverage report);
- new-code duplication below 3%;
- reliability and security ratings at least A.

The free SonarQube Cloud tier currently supports private projects up to 50k
LOC. If CPI GO grows beyond that limit, keep the local checks and move only the
Sonar subscription; the rest of the quality stack remains free/open source.

## UX acceptance bar

Playwright covers real browser journeys and download bytes. The extended
workflow adds Lighthouse accessibility/performance budgets, k6 API latency
budgets and a Maestro Android smoke journey.

Every important mutation must have a visible pending state, a success/error
state, retry behavior and an offline-safe outcome. Haptics happen after a local
commit or confirmed result, never on every keystroke. `prefers-reduced-motion`
and the platform reduced-motion setting remain mandatory.

The only checks that cannot be honestly made fully automatic are physical-device
feel and network quality in the field. Those require a short release checklist
on real Android/iOS devices; CI must not pretend a simulator proves them.
