# ScribeCore Desktop

A private, local work-activity log for Windows. Write down what you worked on each day, tag it,
and pull it back out when it is time for an annual review.

- **Local only.** Your entries live in a file on your computer. The app makes no network calls:
  no accounts, no cloud, no telemetry, no auto-update.
- **No database to install.** Data is stored in an embedded SQLite file.
- **Optional password** that encrypts your data.

> **Status: early development.** Nothing is usable yet. The plan is in [docs/SPEC.md](docs/SPEC.md).

## Requirements

- Windows 10 (22H2) or Windows 11, x64

## Building from source

You need [Node.js](https://nodejs.org/) 22.12 or newer.

```sh
npm ci
npm run dev        # run the app with hot reload
npm run typecheck  # TypeScript and Svelte checks
npm test           # unit tests
npm run dist       # Windows installers in release/<version>/ (run on Windows)
```

`npm run dist` produces:

| File | What it is |
|---|---|
| `ScribeCore-Setup-<version>.exe` | Installer for the current user, no admin rights needed |
| `ScribeCore-<version>.msi` | Per-machine installer for IT deployment |
| `ScribeCore-<version>-portable.zip` | Portable build |

Every push and pull request is built on Windows by GitHub Actions; the unsigned installers are
attached to the workflow run.

## License

ScribeCore Desktop is free software, licensed under the
[GNU General Public License v3.0 or later](LICENSE).
