"""Canonical vehicle make names (Hebrew display + Hebrew/English aliases)."""

from __future__ import annotations

import re
import unicodedata

# Canonical Hebrew name -> search/display aliases.
MAKE_ALIASES: dict[str, tuple[str, ...]] = {
    "אודי": ("אודי", "אאודי", "audi"),
    "אופל": ("אופל", "opel", "vauxhall"),
    "איסוזו": ("איסוזו", "isuzu"),
    "אלפא רומיאו": ("אלפא רומיאו", "אלפא-רומיאו", "alfa romeo", "alfa"),
    "אם ג'י": ("אם ג'י", "mg", "morris garages"),
    "אסטון מרטין": ("אסטון מרטין", "aston martin"),
    "ב.מ.וו": ("ב.מ.וו", "במוו", "bmw"),
    "ביואיק": ("ביואיק", "buick"),
    "ג'יפ": ("ג'יפ", "jeep"),
    "דאצ'יה": ("דאצ'יה", "דאצ'יה", "dacia"),
    "דודג'": ("דודג'", "dodge"),
    "הונדה": ("הונדה", "honda"),
    "וולוו": ("וולוו", "volvo"),
    "טויוטה": ("טויוטה", "toyota"),
    "טסלה": ("טסלה", "tesla"),
    "יגואר": ("יגואר", "jaguar"),
    "יונדאי": ("יונדאי", "hyundai"),
    "לנד רובר": ("לנד רובר", "לנד-רובר", "land rover", "landrover", "range rover"),
    "לקסוס": ("לקסוס", "lexus"),
    "מזדה": ("מזדה", "מאזדה", "mazda"),
    "מיצובישי": ("מיצובישי", "mitsubishi"),
    "מרצדס": ("מרצדס", "מרצדס בנץ", "mercedes", "mercedes-benz", "mercedes benz", "benz"),
    "ניסאן": ("ניסאן", "nissan"),
    "סובארו": ("סובארו", "subaru"),
    "סוזוקי": ("סוזוקי", "suzuki"),
    "סיטרואן": ("סיטרואן", "citroen", "citroën"),
    "סקודה": ("סקודה", "skoda", "škoda"),
    "סאנגיונג": ("סאנגיונג", "ssangyong", "ssang yong", "kgm"),
    "פורד": ("פורד", "ford"),
    "פורשה": ("פורשה", "porsche"),
    "פיאט": ("פיאט", "fiat"),
    "פיג'ו": ("פיג'ו", "peugeot"),
    "פולקסווגן": ("פולקסווגן", "פולקסוואגן", "volkswagen", "vw", "volkswagon"),
    "קאדילק": ("קאדילק", "cadillac"),
    "קיה": ("קיה", "kia"),
    "קרייזלר": ("קרייזלר", "chrysler"),
    "רנו": ("רנו", "renault"),
    "שברולט": ("שברולט", "chevrolet", "chevy"),
    "BYD": ("byd", "ביווידי"),
}

_PUNCT_RE = re.compile(r"[\"'’`.\-_/]+")


def _fold(value: str) -> str:
    text = unicodedata.normalize("NFKC", value).strip().lower()
    text = text.replace("״", '"').replace("׳", "'")
    text = _PUNCT_RE.sub(" ", text)
    return " ".join(text.split())


_ALIAS_TO_CANONICAL: dict[str, str] = {}
for _canonical, _aliases in MAKE_ALIASES.items():
    _ALIAS_TO_CANONICAL[_fold(_canonical)] = _canonical
    for _alias in _aliases:
        _ALIAS_TO_CANONICAL[_fold(_alias)] = _canonical


def _fix_latin_with_hebrew_initial(value: str) -> str:
    """Repair mixed-script labels like 'יapanese' -> 'Japanese'."""
    stripped = value.strip()
    if len(stripped) < 2:
        return stripped
    if stripped[0] == "י" and stripped[1:].isascii() and stripped[1:].isalpha():
        return "J" + stripped[1:]
    return stripped


def canonical_make(name: str | None) -> str:
    raw = _fix_latin_with_hebrew_initial((name or "").strip())
    if not raw:
        return ""
    found = _ALIAS_TO_CANONICAL.get(_fold(raw))
    if found:
        return found
    first = raw.split()[0]
    found = _ALIAS_TO_CANONICAL.get(_fold(first))
    return found or raw


def make_match_names(name: str) -> list[str]:
    names = {name.strip()} if name and name.strip() else set()
    canonical = canonical_make(name)
    if canonical:
        names.add(canonical)
        names.update(MAKE_ALIASES.get(canonical, ()))
    return [item for item in names if item]


def make_search_terms(query: str) -> list[str]:
    """Expand a search string so Kia/קיה (and similar) hit the same vehicles."""
    q = query.strip()
    if not q:
        return []
    terms = {q}
    canonical = canonical_make(q)
    if canonical:
        terms.add(canonical)
        for alias in MAKE_ALIASES.get(canonical, ()):
            terms.add(alias)
    for token in q.split():
        token_canonical = canonical_make(token)
        if token_canonical and token_canonical in MAKE_ALIASES:
            terms.add(token_canonical)
            terms.update(MAKE_ALIASES[token_canonical])
    ordered: list[str] = []
    for item in (q, *sorted(terms, key=len, reverse=True)):
        if item and item not in ordered:
            ordered.append(item)
    return ordered
