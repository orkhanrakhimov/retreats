#!/usr/bin/env python3
"""Builds the retreats.ge static site.

Run from the repo root:  python3 _src/build.py
Templates live in _src/templates, content in _src/data.
Output is written to the repo root, which GitHub Pages serves as-is.
Anything in square brackets, like [Price], is a placeholder still to fill in.
"""
import json
import re
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape
from markupsafe import Markup, escape

SRC = Path(__file__).resolve().parent
ROOT = SRC.parent

PAGES = {
    "index.html": "index.html",
    "about.html": "about/index.html",
    "404.html": "404.html",
    "retreats.html": "retreats/index.html",
    "corporate.html": "corporate/index.html",
    "online.html": "online/index.html",
    "redirect-private.html": "private/index.html",
    "contact.html": "contact/index.html",
    "admin.html": "admin/index.html",
}


def placeholder(value):
    """Wrap [bracketed] text in a span so unfinished content is easy to spot."""
    if value is None or value == "":
        return Markup('<span class="fill">[To fill in]</span>')
    text = str(escape(value))
    return Markup(re.sub(r"\[([^\]]+)\]", r'<span class="fill">[\1]</span>', text))


def price(value, currency):
    if value in (None, ""):
        return Markup('<span class="fill">[Price]</span>')
    return f"{currency}{int(value):,}".replace(",", " ")


def main():
    site = json.loads((SRC / "data/site.json").read_text())
    retreats = json.loads((SRC / "data/retreats.json").read_text())
    credentials = json.loads((SRC / "data/credentials.json").read_text())
    open_retreats = [r for r in retreats if r["status"] == "open"]

    env = Environment(
        loader=FileSystemLoader(SRC / "templates"),
        autoescape=select_autoescape(["html"]),
        trim_blocks=True,
        lstrip_blocks=True,
    )
    env.filters["ph"] = placeholder
    env.filters["price"] = lambda v: price(v, site["currency"])
    env.filters["from_price"] = lambda r: price(
        min([x["price"] for x in r.get("rooms", []) if x.get("price") is not None], default=None),
        site["currency"])
    # Plain string, so Jinja escapes it safely inside HTML attributes.
    env.filters["json"] = lambda v: json.dumps(v, ensure_ascii=False)

    common = dict(site=site, retreats=retreats, credentials=credentials, open_retreats=open_retreats,
                  next_retreat=open_retreats[0] if open_retreats else None)

    written = []
    for tpl, out in PAGES.items():
        html = env.get_template(f"pages/{tpl}").render(**common, path="/" + out.replace("index.html", ""))
        dest = ROOT / out
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(html)
        written.append(out)

    for r in open_retreats:
        out = f"retreats/{r['slug']}/index.html"
        html = env.get_template("pages/retreat.html").render(**common, r=r, path=f"/retreats/{r['slug']}/")
        dest = ROOT / out
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_text(html)
        written.append(out)

    print("Built:", ", ".join(written))


if __name__ == "__main__":
    main()
