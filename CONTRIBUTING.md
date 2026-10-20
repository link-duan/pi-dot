# Contributing

Thanks for helping with Pi Dot. Bug reports, ideas, and pull requests are all welcome.

## Setup

Pi Dot runs on macOS. You need [Bun](https://bun.sh) 1.3+.

```sh
bun install
bun run dev
```

The development build runs beside an installed Pi Dot, with its own data and a graphite icon. `#/playground` shows the transcript in its mocked states without a real session.

## Before you open a pull request

```sh
bun run typecheck
bun run lint
bun run fmt:check
bun run test
```

CI runs the same checks. A pre-commit hook formats and lints staged files.

## Conventions

- Commit messages follow [Conventional Commits](https://www.conventionalcommits.org): `feat(renderer): …`, `fix(loop): …`.
- Use the terms in [CONTEXT.md](CONTEXT.md) (Window, Session, Plan Mode, …) in code and discussion.
- Prefer color tokens over raw colors, so a change works in both the dark and light themes.
- For a UI change, include a screenshot in each theme.
