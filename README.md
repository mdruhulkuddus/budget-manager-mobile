# বাজেট — Budget Mobile

A personal, offline-only Android app for monthly budget planning and expense tracking.
It answers one question at a glance: **how much did I spend this month, and in which category?**

- Plan each month: income and a planned amount per category (copy from last month in one tap).
- Add expenses in a few seconds: amount, category, date, optional note.
- The dashboard shows spent vs planned per category and overall, with green / yellow / red bars.
- Every past month has a report: totals, per-category table, and the full expense list.
- Settings: manage categories, and back up / restore all data as a JSON file.

All data stays on the phone in SQLite. No account, no internet, no sync. The UI is in Bengali.

## Run it in Expo Go (development)

Requirements: Node.js 22+, the **Expo Go** app on the phone, phone and PC on the same Wi-Fi.

```sh
npm install
npx expo start
```

Scan the QR code with Expo Go. If the phone can't connect, use `npx expo start --tunnel`.

Checks:

```sh
npx tsc --noEmit   # type-check
npm test           # all tests (database tests need Node's SQLite, which npm test enables)
```

`npx jest` also works. On Node versions older than 22.13 it skips the database tests and prints a warning.

## Build the installable APK

The APK is built in the cloud by EAS Build (free account at https://expo.dev).

```sh
npm install -g eas-cli          # once
eas login                       # once, with your expo.dev account
eas init                        # once: links the project, adds its id to app.json (commit that change)
eas build -p android --profile preview
```

The build takes about 10–20 minutes. When it finishes, the terminal shows a link and a QR code.
On the phone, open the link, download the `.apk`, allow **Install unknown apps** for your
browser or file manager when Android asks, and install.

For a new version, raise `version` and `android.versionCode` in `app.json`, then build again.
Installing the new APK over the old one keeps the data.

## Back up and restore

**Settings (⚙ on the dashboard) → ব্যাকআপ**

- **ব্যাকআপ নিন** writes `budget-backup-YYYY-MM-DD.json` and opens the Android share sheet.
  Save it to Google Drive or Files, or send it to yourself.
  The settings screen shows the last backup date. It turns red after 30 days, or if you have never backed up.
- **ব্যাকআপ থেকে ফেরত আনুন** lets you pick a backup file. The app checks it first, shows its date and how many months and expenses it holds, and asks for confirmation.
  It then **replaces all current data** with the backup in a single transaction.
  An invalid file changes nothing.

Expo Go and the installed APK are separate apps with separate data. To move data between them,
back up in one and restore in the other.

## Project layout

```
app/          screens (expo-router)
src/db/       SQLite schema, migrations, repositories
src/lib/      pure logic: calculations, dates, formatting, backup format (unit-tested)
src/components/
src/i18n/bn.ts  all UI text
__tests__/    Jest tests
```

See `CLAUDE.md` for the full spec, data model and design decisions.
