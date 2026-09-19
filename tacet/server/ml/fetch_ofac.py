#!/usr/bin/env python3
"""Extract REAL sanctioned cryptocurrency addresses from the US Treasury OFAC
SDN list (authoritative, public, updated by the US government).

Produces server/ml/corpus-ofac/sanctioned_wallets.json:
  [{ address, chain, entity, program, ent_num, source, fetchedAt }]

These are real wallets publicly attributed to designated malicious actors
(ransomware, darknet markets, sanctions evaders) — legitimate input for a
defensive threat-intelligence tool.
"""
import csv
import io
import json
import re
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = "https://sanctionslistservice.ofac.treas.gov/api/PublicationPreview/exports/SDN.CSV"
OUT_DIR = Path(__file__).resolve().parent / "corpus-ofac"
OUT_FILE = OUT_DIR / "sanctioned_wallets.json"

# e.g. "Digital Currency Address - XBT 12QtD5BFwRsdNsAZY76UVE1xyCGNTojH9h"
ADDR_RE = re.compile(r"Digital Currency Address\s*-\s*([A-Z0-9]+)\s+([A-Za-z0-9]{20,110})")


def fetch_csv() -> str:
    req = urllib.request.Request(URL, headers={"User-Agent": "Mozilla/5.0 TACET-defensive-research"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        raw = resp.read()
    print(f"downloaded SDN.CSV: {len(raw)/1e6:.2f} MB")
    return raw.decode("utf-8", errors="ignore")


def main():
    OUT_DIR.mkdir(exist_ok=True)
    text = fetch_csv()
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    print(f"SDN rows: {len(rows)}")

    # header row detection: SDN.CSV is usually headerless with fixed columns
    # ent_num, SDN_Name, SDN_Type, Program, Title, Call_Sign, Vess_type,
    # Tonnage, GRT, Vess_flag, Vess_owner, Remarks
    found = {}
    for row in rows:
        if len(row) < 12:
            continue
        ent_num, name, sdn_type, program = row[0], row[1], row[2], row[3]
        remarks = ",".join(row[11:]) if len(row) > 11 else ""
        if "Digital Currency Address" not in remarks:
            continue
        for m in ADDR_RE.finditer(remarks):
            chain, address = m.group(1).upper(), m.group(2)
            key = (chain, address)
            if key in found:
                continue
            found[key] = {
                "address": address,
                "chain": chain,
                "entity": name.strip(),
                "program": program.strip(),
                "entNum": ent_num.strip(),
                "sdnType": sdn_type.strip(),
                "source": "US Treasury OFAC SDN list",
                "sourceUrl": URL,
                "fetchedAt": datetime.now(timezone.utc).isoformat(),
            }

    wallets = list(found.values())
    # sanity: validate BTC base58/bech32 shape
    btc = [w for w in wallets if w["chain"] == "BTC"]
    print(f"extracted {len(wallets)} sanctioned addresses ({len(btc)} BTC)")
    by_chain = {}
    for w in wallets:
        by_chain[w["chain"]] = by_chain.get(w["chain"], 0) + 1
    print("chains:", by_chain)
    for w in btc[:8]:
        print(f"  BTC {w['address']}  <-  {w['entity'][:52]}")

    with open(OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(wallets, f, indent=1)
    print("wrote", OUT_FILE)


if __name__ == "__main__":
    main()
