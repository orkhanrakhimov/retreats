# retreats.ge

Website for Anastasia Mzhavia's women's wellness retreats in Georgia. Live at https://retreats.ge (GitHub Pages).

## How it's built

- `_src/data/site.json`: contact details (WhatsApp, Instagram, email), deposit %, currency
- `_src/data/retreats.json`: every retreat: name, dates, venue, rooms and prices, what's included. `"status": "open"` gets its own page and booking; `"soon"` shows as "Coming soon".
- `_src/templates/`: page templates
- `assets/`: styles and scripts

After changing anything in `_src`, rebuild and commit:

```
python3 _src/build.py
```

Anything in square brackets, like `[Price]`, is a placeholder still to fill in. It shows highlighted on the site.

## Still to connect

- Real photos and video (each grey box is labelled with the photo it needs)
- WhatsApp number in `site.json` (booking and contact forms then send there; until then they open email)
- Online deposit payments (TBC / Bank of Georgia)
- Email sign-up service for the newsletter forms
- Georgian language version
