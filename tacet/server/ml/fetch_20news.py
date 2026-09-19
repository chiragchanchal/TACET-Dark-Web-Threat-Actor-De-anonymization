#!/usr/bin/env python3
"""Download the real 20 Newsgroups corpus (figshare mirror), parse it, and
extract real authors from the From: headers. Writes a compact JSON corpus
keyed by real author label for stylometry training."""
import json
import re
import tarfile
import time
import urllib.request
from pathlib import Path

URL = "https://ndownloader.figshare.com/files/5975967"
OUT_DIR = Path(__file__).resolve().parent / "corpus-20news"
TARBALL = OUT_DIR / "20news-bydate.tar.gz"
AUTHORS_FILE = OUT_DIR / "authors.json"

OUT_DIR.mkdir(exist_ok=True)

def fetch():
    if TARBALL.exists() and TARBALL.stat().st_size > 10_000_000:
        print("using cached tarball")
        return
    print("downloading 20news-bydate.tar.gz …")
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 TACET-research"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=120) as resp, open(TARBALL, "wb") as f:
        while True:
            chunk = resp.read(1 << 20)
            if not chunk:
                break
            f.write(chunk)
    print(f"downloaded {TARBALL.stat().st_size / 1e6:.1f} MB in {time.time()-t0:.1f}s")

FROM_RE = re.compile(r"^From:\s*(.+)$", re.MULTILINE)
def extract_author(text):
    m = FROM_RE.search(text)
    if not m:
        return None
    raw = m.group(1).strip()
    # "Name <email>" or "email" — take the email local part or the quoted name
    m2 = re.search(r"<([^>]+)>", raw)
    addr = (m2.group(1) if m2 else raw).strip()
    local = addr.split("@")[0].lower()
    # strip noise
    local = re.sub(r"[^a-z0-9._-]", "", local)
    if len(local) >= 4:
        return local
    return None

def clean_message(raw):
    """Strip RFC-822 headers, quoted reply lines and signature blocks so the
    model learns author style, not headers or other people's quoted text."""
    # 1) remove headers: everything before the first blank line
    parts = raw.split("\n\n", 1)
    body = parts[1] if len(parts) > 1 else ""
    if len(body) < 200:
        return ""
    lines = body.split("\n")
    out = []
    in_sig = False
    for line in lines:
        if line.rstrip() == "--":
            in_sig = True
            continue
        if in_sig:
            continue
        # quoted lines (old replies), attribution lines
        stripped = line.lstrip()
        if stripped.startswith(">") or stripped.startswith("In article") or stripped.startswith("In <"):
            continue
        out.append(line)
    cleaned = "\n".join(out).strip()
    # final min-length check on the cleaned style text
    return cleaned if len(cleaned) >= 200 else ""

def main():
    fetch()
    authors = {}
    with tarfile.open(TARBALL, "r:gz") as tf:
        names = [n for n in tf.getnames() if n.endswith((".txt", ".txt.gz", "")) and "/" in n]
        count = 0
        for name in names:
            try:
                member = tf.getmember(name)
            except KeyError:
                continue
            if not member.isfile():
                continue
            try:
                data = tf.extractfile(member).read().decode("utf-8", errors="ignore")
            except Exception:
                continue
            author = extract_author(data)
            body = clean_message(data)
            if author and body:
                authors.setdefault(author, []).append({"text": body[:6000], "src": name})
                count += 1
    # keep authors with enough documents for a stable fingerprint
    keep = {a: docs for a, docs in authors.items() if len(docs) >= 6}
    # cap each author and total authors for a tractable but real training run
    keep = {a: docs[:50] for a, docs in sorted(keep.items(), key=lambda kv: -len(kv[1]))[:20]}
    with open(AUTHORS_FILE, "w", encoding="utf-8") as f:
        json.dump(keep, f, indent=0)
    total = sum(len(v) for v in keep.values())
    print(f"parsed {count} docs, {len(keep)} real authors with >=4 docs, {total} docs kept")
    for a, docs in list(keep.items())[:10]:
        print(f"  {a}: {len(docs)} docs")

if __name__ == "__main__":
    main()
