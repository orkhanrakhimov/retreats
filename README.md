# retreats.ge

Website for Anastasia Mzhavia's yoga & Pilates retreats. Live at https://retreats.ge.

## How it works

- **Pages** are built by `_src/build.py` from the templates in `_src/templates` and the content in `_src/data`.
- **Retreats** are added and edited in the admin panel (https://retreats.ge/admin/). They are stored in the
  "Retreats" tab of the Google Sheet. Only retreats marked "Coming soon" or "Registration open" are published.
- **Publishing**: GitHub Actions (`.github/workflows/deploy.yml`) runs `python3 _src/build.py --live` on every push
  and every 15 minutes, pulling the published retreats from the Google Sheet, then publishes to GitHub Pages.
  GitHub Pages must be set to Source: "GitHub Actions" (Settings > Pages).
- **Forms** (retreat interest, online sessions, corporate) save to the "Sign-ups" tab; Anastasia gets an email for each.
- **Visitor statistics** are counted without cookies into the "Visits" tab and shown in the admin panel.

## The Google Sheet backend

The code is in `_src/admin/google-apps-script.gs`, pasted into the Sheet's Extensions > Apps Script.
After changing it: Deploy > Manage deployments > Edit > Version: New version > Deploy (the URL stays the same).
Script properties: `ADMIN_KEY` (admin password) and `NOTIFY_EMAIL`.

## Local build

    pip install jinja2
    python3 _src/build.py          # with the saved copy of retreats
    python3 _src/build.py --live   # fetch the latest published retreats first

Note: GitHub pauses scheduled workflows in public repositories after 60 days without any commits. If retreats stop
updating automatically, re-enable the workflow in the Actions tab, or push any small change.
