# Working on this site

This is Nolan's personal site, live at nolandruid.com. Right now it's a one-page placeholder while the full revamp gets built.

## Rules

- This repo is public. Anything committed, written in a PR, or deployed can be read by anyone, and git history keeps it even after deletion. Never commit API keys, tokens, or `.env` files (use GitHub Actions secrets), and never publish a phone number, home address, or anything that pins down where Nolan lives, like Strava routes or start points.
- Don't push straight to `main`. Every push to `main` deploys to the live site, so always work on a branch and open a PR, even for small changes. Nolan merges.
- Write in a natural, plain tone. That goes for page copy, commit messages, and PR descriptions. No marketing speak, and no em dashes.
- Don't add "Generated with Claude Code" or any other tool credit to PR descriptions.
- Keep the site readable by agents. Real content goes in the HTML itself, not behind JavaScript, and `public/llms.txt` should match what the page says. If you change one, update the other.
- Check changes in a browser at desktop and phone sizes before opening the PR.

## How it's set up

- `index.html` at the root is the homepage. It's plain HTML, CSS, and a little inline JS, set in Charter with a light and dark theme.
- Vite builds it and GitHub Actions deploys `dist/` to GitHub Pages on every push to `main` (`.github/workflows/deploy.yml`).
- Static files that need to be served as-is live in `public/`: `llms.txt`, `resume.pdf`, the `/resume` redirect, and the favicon.
- `src/` holds the old 3D badge React app. The homepage doesn't use it anymore, but it's kept around for later.
- Run it locally with `npm run dev`.
