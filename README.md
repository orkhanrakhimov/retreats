# retreats.ge

Website for Anastasia Mzhavia's women's wellness retreats in Georgia. Live at https://retreats.ge (GitHub Pages).

## How it's built

- `_src/data/site.json`: contact details (Instagram, email), deposit %, currency
- `_src/data/credentials.json`: Anastasia's diplomas and certificates (images in `assets/img/certificates`)
- `_src/data/retreats.json`: every retreat: name, dates, venue, rooms and prices, what's included. `"status": "open"` gets its own page and booking; `"soon"` shows as "Coming soon".
- `_src/templates/`: page templates (Home, Retreats, About, Private & corporate, Contact; `retreat.html` is used once a retreat's status is `open`)
- `assets/`: styles and scripts

After changing anything in `_src`, rebuild and commit:

```
python3 _src/build.py
```

Anything in square brackets, like `[Price]`, is a placeholder still to fill in. It shows highlighted on the site.

## Still to connect

- Real photos (each grey box is labelled with the photo it needs)
- Booking requests currently open the guest's email app addressed to Anastasia
- Online deposit payments (TBC / Bank of Georgia)
- Email sign-up service for the newsletter forms
- Georgian language version

## Sign-ups and the admin page

Form sign-ups (the retreat waitlist) are saved to a Google Sheet in Anastasia's Google account,
and she gets an email for each one. They can be viewed and managed at https://retreats.ge/admin/.

Setup, once:
1. Create a Google Sheet in Anastasia's Google account.
2. Extensions > Apps Script. Paste the contents of `_src/admin/google-apps-script.gs`. Save.
3. Project Settings > Script properties: add `ADMIN_KEY` (the admin password) and `NOTIFY_EMAIL`.
4. Deploy > New deployment > Web app. Execute as: Me. Who has access: Anyone. Copy the Web app URL.
5. Put that URL in `_src/data/site.json` as `forms_endpoint`, run `python3 _src/build.py`, commit.

Preview the admin page with sample data: https://retreats.ge/admin/?demo
