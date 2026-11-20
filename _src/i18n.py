"""Turns a rendered English page into its Georgian version.

The English text stays in the templates. _src/i18n/ka.json maps each English
string to its Georgian translation. A page is translated by matching whole
pieces of text (an element's text, a text node, or an attribute) against it.
"""
import json
import re
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString, Tag

HERE = Path(__file__).resolve().parent

INLINE = {"a", "strong", "em", "b", "i", "span", "small", "br"}
SKIP = {"script", "style", "svg", "noscript", "template"}
ATTRS = ("alt", "aria-label", "placeholder", "title", "data-label")
META = {"description", "og:title", "og:description", "twitter:title", "twitter:description"}

# Georgian for words that are links or bold inside a translated sentence. Matching
# goes to the end of the Georgian word, so case endings are covered.
FRAGMENTS = {
    "privacy policy": "კონფიდენციალურობის პოლიტიკ",
    "Instagram": "ინსტაგრამ",
    "Retreats page": "რეტრიტების გვერდ",
    "Yoga & Pilates": "იოგა და პილატესი",
    "Comfortable places": "კომფორტული გარემო",
    "Led by a doctor": "ექიმის ხელმძღვანელობით",
}
# Placeholders in translations and the element that fills them
PLACEHOLDERS = {"{name}": "data-first-name"}


def norm(s):
    return " ".join(s.split())


def load():
    rows = json.loads((HERE / "i18n" / "ka.json").read_text())
    return {norm(r["en"]): r["ka"] for r in rows if r.get("ka")}


class Translator:
    def __init__(self):
        self.d = load()
        self.missing = set()

    def t(self, s):
        return self.d.get(norm(s))

    # -- elements -------------------------------------------------------
    def element(self, el):
        if el.name in SKIP:
            return
        self.attrs(el)
        kids = [c for c in el.children if isinstance(c, Tag)]
        whole = None
        for text in self.texts(el):
            whole = self.t(text)
            if whole is not None:
                break
        if whole is not None and all(k.name in INLINE for k in kids):
            if not kids:
                el.string = whole
                return
            if self.mixed(el, whole):
                return
        for c in list(el.children):
            if isinstance(c, Tag):
                self.element(c)
            elif isinstance(c, NavigableString) and type(c) is NavigableString:
                raw = str(c)
                if norm(raw):
                    k = self.t(raw)
                    if k is not None:
                        lead = " " if raw[:1].isspace() else ""
                        trail = " " if raw[-1:].isspace() else ""
                        c.replace_with(lead + k + trail)
                    elif re.search("[A-Za-z]{3}", raw):
                        self.missing.add(norm(raw))

    def texts(self, el):
        """The element's text, with and without spaces at tags, and with placeholders."""
        out = []
        for sep in ("", " "):
            out.append(norm(el.get_text(sep)))
        parts = []
        for c in el.descendants:
            if isinstance(c, Tag):
                for ph, attr in PLACEHOLDERS.items():
                    if c.has_attr(attr):
                        parts.append(ph)
            elif type(c) is NavigableString:
                parts.append(str(c))
        out.append(norm("".join(parts)))
        return [t for t in out if t]

    def mixed(self, el, ka):
        """Sentence with links, bold words or a placeholder inside it."""
        kids = [c for c in el.children if isinstance(c, Tag) and c.name != "br"]
        parts = []  # (start, end, tag)
        for k in kids:
            for ph, attr in PLACEHOLDERS.items():
                if k.has_attr(attr) and ph in ka:
                    i = ka.index(ph)
                    parts.append((i, i + len(ph), k, None))
                    break
            else:
                eng = norm(k.get_text())
                frag = FRAGMENTS.get(eng)
                if eng and "@" in eng and eng in ka:
                    frag = eng
                if not frag or frag not in ka:
                    return False
                i = ka.index(frag)
                j = i + len(frag)
                while j < len(ka) and (ka[j].isalnum() or "ა" <= ka[j] <= "ჿ"):
                    j += 1
                parts.append((i, j, k, ka[i:j]))
        parts.sort(key=lambda p: p[0])
        el.clear()
        pos = 0
        for i, j, tag, label in parts:
            if i < pos:
                return False
            if ka[pos:i]:
                el.append(ka[pos:i])
            if label is not None:
                tag.string = label
            el.append(tag)
            pos = j
        if ka[pos:]:
            el.append(ka[pos:])
        return True

    def attrs(self, el):
        for a in ATTRS:
            if el.has_attr(a):
                k = self.t(el[a])
                if k is not None:
                    el[a] = k
        if el.name == "meta" and (el.get("name") in META or el.get("property") in META):
            k = self.t(el.get("content", ""))
            if k is not None:
                el["content"] = k
        if el.has_attr("data-caption"):
            el["data-caption"] = self.caption(el["data-caption"])

    def caption(self, cap):
        # "Title, Organisation, Year": translate the longest known pieces
        parts = [p.strip() for p in cap.split(",")]
        out, i = [], 0
        while i < len(parts):
            for j in range(len(parts), i, -1):
                k = self.t(", ".join(parts[i:j]))
                if k is not None:
                    out.append(k)
                    i = j
                    break
            else:
                out.append(parts[i])
                i += 1
        return ", ".join(out)

    def page(self, html):
        soup = BeautifulSoup(html, "html.parser")
        if soup.title and soup.title.string:
            k = self.t(soup.title.string)
            if k is not None:
                soup.title.string = k
        for m in soup.find_all("meta"):
            self.attrs(m)
        if soup.body:
            self.element(soup.body)
        return str(soup)
