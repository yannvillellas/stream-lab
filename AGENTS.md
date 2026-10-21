# Engineering rules

These rules describe the quality expected from the code. They apply to everyone who contributes.

## Before changing behaviour

- Read `README.md` and the relevant page in `docs/`.
- Add or update the check that proves the change: a unit test for logic, a documented manual check
  for media paths.

## Change discipline

- Keep each change small, focused and independently reviewable.
- Keep the build, the types and the tests green at every step.
- Do not add a dependency, a service or a state store without agreement.
- Prefer the simplest solution that can be demonstrated.

## Code

- TypeScript runs in strict mode; do not silence a type error with `any` or a cast without a written
  reason.
- Keep capture, transport, signalling and UI concerns separate.
- Name things after what they do. Avoid abbreviations that need a glossary.
- Comments explain why, not what.

## Safety and privacy

- Never commit secrets, tokens, `.env` files, captured video, audio or personal data.
- Use test devices and synthetic media only.
- State clearly what is simulated and what is real. Never present a simulated integration as a
  production one.

## Definition of done

A change is complete only when:

1. it runs with the documented commands;
2. format, types, tests and build pass;
3. the behaviour is demonstrated or measured;
4. `README.md` or `docs/` is updated where behaviour changed;
5. its limits are stated.

## Language

English for code, comments, commits, documentation and pull requests.
