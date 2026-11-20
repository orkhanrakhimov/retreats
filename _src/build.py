#!/usr/bin/env python3
"""Builds the retreats.ge static site.

Run from the repo root:
    python3 _src/build.py          # uses the retreats saved in _src/data/retreats.json
    python3 _src/build.py --live   # first downloads published retreats from the Google Sheet

Templates live in _src/templates, content in _src/data. Output goes to the repo root.
GitHub Actions runs the --live build on every push and every 15 minutes, so retreats
added in the admin panel appear on the site without anyone touching the code.
"""
import hashlib
import json
import re
import sys
import urllib.request
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup, escape

sys.path.insert(0, str(Path(__file__).resolve().parent))
from i18n import Translator  # noqa: E402

SRC = Path(__file__).resolve().parent
ROOT = SRC.parent

PAGES = {
    "index.html": "index.html",
    "about.html": "about/index.html",
    "retreats.html": "retreats/index.html",
    "online.html": "online/index.html",
    "corporate.html": "corporate/index.html",
    "contact.html": "contact/index.html",
    "privacy.html": "privacy/index.html",
    "admin.html": "admin/index.html",
    "404.html": "404.html",
    "redirect-private.html": "private/index.html",
}
NOT_IN_SITEMAP = {"404.html", "admin/index.html", "private/index.html", "ka/404.html"}
# Pages that get a Georgian version under /ka/
NO_TRANSLATION = {"admin.html", "redirect-private.html"}
# Strings used by main.js, sent to Georgian pages
JS_STRINGS = ["Please tick the box to agree.", "Please check your email address.", "Please fill in the highlighted fields.",
              "Something went wrong. Please try again, or email {email}.", "Link copied", "Copy link", "Copy this link:",
              "Play video", "Pause video", "Sending…"]
EXTRA_KA = {"Sending…": "იგზავნება…"}
LIST_FIELDS = ("included", "not_included", "gallery")


def placeholder(value):
    """Wrap [bracketed] text in a span so unfinished content is easy to spot."""
    if value is None or value == "":
        return Markup('<span class="fill">[To fill in]</span>')
    text = str(escape(value))
    return Markup(re.sub(r"\[([^\]]+)\]", r'<span class="fill">[\1]</span>', text))


def paragraphs(value):
    """Plain text with blank lines -> <p> paragraphs."""
    parts = [p.strip() for p in re.split(r"\n\s*\n", str(value or "")) if p.strip()]
    return Markup("".join("<p>" + str(escape(p)).replace("\n", "<br>") + "</p>" for p in parts))


def fetch_live(site):
    url = site.get("forms_endpoint")
    if not url:
        raise RuntimeError("forms_endpoint is not set")
    with urllib.request.urlopen(url + "?action=retreats", timeout=60) as r:
        data = json.loads(r.read().decode("utf-8"))
    if not data.get("ok"):
        raise RuntimeError(data.get("error", "bad response"))
    return data["retreats"]


def normalise(r):
    r = {k: ("" if v is None else v) for k, v in r.items()}
    for f in LIST_FIELDS:
        v = r.get(f, "")
        if isinstance(v, str):
            r[f] = [x.strip() for x in v.splitlines() if x.strip()]
    r["slug"] = re.sub(r"[^a-z0-9-]", "", str(r.get("slug", "")).lower()) or "retreat"
    r["start_date"] = str(r.get("start_date", ""))[:10]
    return r


def main():
    site = json.loads((SRC / "data/site.json").read_text())
    credentials = json.loads((SRC / "data/credentials.json").read_text())
    cache = SRC / "data/retreats.json"

    if "--live" in sys.argv:
        try:
            retreats = fetch_live(site)
            cache.write_text(json.dumps(retreats, ensure_ascii=False, indent=2))
            print(f"Fetched {len(retreats)} published retreat(s) from the sheet")
        except Exception as e:  # keep the site up even if Google is unreachable
            print("Could not fetch retreats, using saved copy:", e)
            retreats = json.loads(cache.read_text())
    else:
        retreats = json.loads(cache.read_text())

    retreats = [normalise(r) for r in retreats if r.get("status") in ("open", "soon")]
    retreats.sort(key=lambda r: (r["status"] != "open", r["start_date"] or "9999"))

    env = Environment(
        loader=FileSystemLoader(SRC / "templates"),
        autoescape=select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["ph"] = placeholder
    env.filters["paras"] = paragraphs
    # Plain string, so Jinja escapes it safely inside HTML attributes.
    env.filters["json"] = lambda v: json.dumps(v, ensure_ascii=False)

    # Version stamp for CSS/JS links, so browsers fetch the new files after every change.
    h = hashlib.sha1()
    for f in sorted((ROOT / "assets").rglob("*.*")):
        if f.suffix in (".css", ".js"):
            h.update(f.read_bytes())
    env.globals["v"] = h.hexdigest()[:8]

    common = dict(site=site, retreats=retreats, credentials=credentials,
                  next_retreat=retreats[0] if retreats else None)

    tr = Translator()
    tr.d.update(EXTRA_KA)
    i18n_js = {k: tr.d[k] for k in JS_STRINGS if k in tr.d}

    def write(out, html):
        dest = ROOT / out
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(html)

    def georgian(html):
        html = tr.page(html)
        # Internal links stay on the Georgian side
        return re.sub(r'href="/(?!ka/|assets/|admin/|ka"|")', 'href="/ka/', html).replace('href="/"', 'href="/ka/"').replace("/ka/__en__/", "/")

    written = []
    for tpl, out in PAGES.items():
        path = "/" + out.replace("index.html", "")
        alt = tpl not in NO_TRANSLATION and tpl != "404.html"
        tmpl = env.get_template(f"pages/{tpl}")
        write(out, tmpl.render(**common, path=path, lang="en", pre="", alternates=alt))
        written.append(out)
        if tpl not in NO_TRANSLATION:
            ka = tmpl.render(**common, path=path, lang="ka", pre="/ka", alternates=alt, i18n_js=i18n_js)
            write("ka/" + out, georgian(ka))
            written.append("ka/" + out)

    # One page per published retreat; remove pages of retreats that are no longer published
    keep = {r["slug"] for r in retreats}
    for base in (ROOT / "retreats", ROOT / "ka" / "retreats"):
        for d in base.iterdir():
            if d.is_dir() and d.name not in keep:
                for f in d.iterdir():
                    f.unlink()
                d.rmdir()
    tmpl = env.get_template("pages/retreat.html")
    for r in retreats:
        path = f"/retreats/{r['slug']}/"
        write(path[1:] + "index.html", tmpl.render(**common, r=r, path=path, lang="en", pre="", alternates=True))
        ka = tmpl.render(**common, r=r, path=path, lang="ka", pre="/ka", alternates=True, i18n_js=i18n_js)
        write("ka" + path + "index.html", georgian(ka))
        written += [path[1:] + "index.html", "ka" + path + "index.html"]

    if tr.missing:
        print("Not translated:", "; ".join(sorted(tr.missing))[:2000])

    urls = [site["url"] + "/" + w.replace("index.html", "") for w in written if w not in NOT_IN_SITEMAP]
    (ROOT / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n")
    (ROOT / "robots.txt").write_text(f"User-agent: *\nDisallow: /admin/\nSitemap: {site['url']}/sitemap.xml\n")

    print("Built:", ", ".join(written))


if __name__ == "__main__":
    main()
