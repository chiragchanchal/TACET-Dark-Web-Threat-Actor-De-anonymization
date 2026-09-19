#!/usr/bin/env python3
"""Normalize + validate the OFAC wallet list for ingestion:
- map XBT -> BTC (Bitcoin), USDT->ERC20-USDT etc. kept as-is
- filter to structurally valid BTC addresses (Base58Check / bech32)
- output server/ml/corpus-ofac/sanctioned_wallets_valid.json
"""
import hashlib
import json
import re
from pathlib import Path

SRC = Path(__file__).resolve().parent / "corpus-ofac" / "sanctioned_wallets.json"
OUT = Path(__file__).resolve().parent / "corpus-ofac" / "sanctioned_wallets_valid.json"

BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"
BECH32_RE = re.compile(r"^(bc1)[a-z0-9]{39,87}$")


def b58decode(s):
    n = 0
    for ch in s:
        try:
            n = n * 58 + BASE58.index(ch)
        except ValueError:
            return None
    return n.to_bytes((n.bit_length() + 7) // 8 or 1, "big")


def valid_btc(addr):
    if BECH32_RE.match(addr):
        return True
    if not re.match(r"^[13][1-9A-HJ-NP-Za-km-z]{25,34}$", addr):
        return False
    raw = b58decode(addr)
    if raw is None or len(raw) != 25:
        return False
    body, checksum = raw[:-4], raw[-4:]
    h = hashlib.sha256(hashlib.sha256(body).digest()).digest()
    return h[:4] == checksum


def main():
    wallets = json.loads(SRC.read_text(encoding="utf-8"))
    out = []
    for w in wallets:
        chain = w["chain"]
        if chain == "XBT":
            chain = "BTC"
        w = {**w, "chain": chain}
        if chain == "BTC" and not valid_btc(w["address"]):
            continue
        out.append(w)

    btc = [w for w in out if w["chain"] == "BTC"]
    print(f"valid wallets: {len(out)} total, {len(btc)} BTC")
    # show the biggest names
    seen = set()
    for w in btc:
        key = w["entity"]
        if key in seen:
            continue
        seen.add(key)
        print(f"  {w['address'][:22]}…  {w['entity'][:50]}  [{w['program'][:30]}]")
        if len(seen) >= 15:
            break
    OUT.write_text(json.dumps(out, indent=1), encoding="utf-8")
    print("wrote", OUT)


if __name__ == "__main__":
    main()
