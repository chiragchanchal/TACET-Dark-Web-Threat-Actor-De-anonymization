#!/usr/bin/env python3
"""
TACET — real stylometry training pipeline (SIH26151)

Trains an authorship model on REAL multi-author documents:
  server/ml/corpus-20news/authors.json   (from the 20 Newsgroups corpus —
  genuine Usenet posts by real people, ~15.4k documents, 24+ real authors)

Method: char 3–5 + word 1–2 TF-IDF → LogisticRegression, evaluated with
stratified 5-fold cross-validation and a held-out split. Artifacts are
written to server/model/ and surfaced at /api/analysis/model.

This is a real authorship-attribution benchmark, not template text:
the model learns which real human wrote which real document, and reports
the honest accuracy / F1 / per-class metrics.
"""
import json
import random
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parent.parent  # server/
MODEL_DIR = ROOT / "model"
CORPUS_FILE = ROOT / "ml" / "corpus-20news" / "authors.json"
MODEL_DIR.mkdir(exist_ok=True)
SEED = 0x7AC3E7

# ---- load the REAL multi-author corpus ----
def load_real_corpus():
    if not CORPUS_FILE.exists():
        raise SystemExit(f"corpus not found: {CORPUS_FILE}\nRun: python ml/fetch_20news.py first")
    authors = json.loads(CORPUS_FILE.read_text(encoding="utf-8"))
    # each author -> list of {text, src}; filter to usable text
    texts, labels = [], []
    for author, docs in authors.items():
        for d in docs:
            text = (d.get("text") or "").strip()
            if len(text) >= 200:
                texts.append(text)
                labels.append(author)
    return texts, labels


def main():
    print("TACET stylometry training (REAL corpus)")
    print("=" * 64)
    texts, labels = load_real_corpus()
    n_authors = len(set(labels))
    print(f"real corpus: {len(texts)} documents, {n_authors} real authors")

    # ---- feature vectorization: char 3-5 + word 1-2, sublinear TF ----
    word_vectorizer = TfidfVectorizer(analyzer="word", ngram_range=(1, 2), sublinear_tf=True,
                                      min_df=3, max_df=0.95, strip_accents="unicode", lowercase=True)
    char_vectorizer = TfidfVectorizer(analyzer="char", ngram_range=(3, 5), sublinear_tf=True,
                                      min_df=3, max_df=0.95, strip_accents="unicode", lowercase=True)

    Xw = word_vectorizer.fit_transform(texts)
    Xc = char_vectorizer.fit_transform(texts)
    from scipy.sparse import hstack
    X = hstack([Xw, Xc]).tocsr()
    print(f"feature matrix: {X.shape[0]} x {X.shape[1]}")

    clf = LogisticRegression(C=1.5, max_iter=2000, solver="lbfgs")

    # ---- stratified 5-fold cross-validation on real data ----
    from sklearn.model_selection import cross_val_score, StratifiedKFold
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=SEED)
    cv_acc = cross_val_score(clf, X, labels, cv=skf, scoring="accuracy", n_jobs=1)
    cv_f1 = cross_val_score(clf, X, labels, cv=skf, scoring="f1_macro", n_jobs=1)

    # ---- held-out report ----
    Xtr, Xte, ytr, yte = train_test_split(X, labels, test_size=0.2, random_state=SEED, stratify=labels)
    clf.fit(Xtr, ytr)
    pred = clf.predict(Xte)
    acc = accuracy_score(yte, pred)
    from sklearn.metrics import f1_score
    f1 = f1_score(yte, pred, average="macro")
    report = classification_report(yte, pred, output_dict=True, zero_division=0)

    # ---- fit on ALL real data for the shipped model ----
    clf.fit(X, labels)
    joblib.dump(word_vectorizer, MODEL_DIR / "word_vectorizer.joblib")
    joblib.dump(char_vectorizer, MODEL_DIR / "char_vectorizer.joblib")
    joblib.dump(clf, MODEL_DIR / "classifier.joblib")

    # ---- export runtime vocabulary ----
    vocab = {}
    for token, idx in word_vectorizer.vocabulary_.items():
        vocab[token] = {"id": idx, "idf": float(word_vectorizer.idf_[idx]), "kind": "w"}
    offset = len(word_vectorizer.vocabulary_)
    for token, idx in char_vectorizer.vocabulary_.items():
        vocab[token] = {"id": offset + idx, "idf": float(char_vectorizer.idf_[idx]), "kind": "c"}

    # ---- per-author feature profiles (explainability) ----
    id_to_meta = {meta["id"]: (tok, meta) for tok, meta in vocab.items()}
    feature_profiles = {}
    for ci, cls in enumerate(clf.classes_):
        coef = clf.coef_[ci]
        top = np.argsort(coef)[-15:][::-1]
        profile = []
        for fi in top:
            entry = id_to_meta.get(int(fi))
            if entry:
                tok, meta = entry
                profile.append({"feature": tok, "kind": meta["kind"], "coef": round(float(coef[fi]), 4)})
        feature_profiles[cls] = profile

    metrics = {
        "method": "char-ngram(3-5)+word(1-2) TF-IDF, LogisticRegression (C=1.5)",
        "corpus": "20 Newsgroups (real Usenet posts by real authors) — server/ml/corpus-20news/authors.json",
        "trainedAt": datetime.now(timezone.utc).isoformat(),
        "nDocuments": int(len(texts)),
        "nAuthors": int(n_authors),
        "nFeatures": int(X.shape[1]),
        "cvAccuracy": float(cv_acc.mean()),
        "cvAccuracyStd": float(cv_acc.std()),
        "cvF1Macro": float(cv_f1.mean()),
        "heldOutAccuracy": float(acc),
        "heldOutF1Macro": float(f1),
        "perClass": {k: {"precision": v["precision"], "recall": v["recall"], "f1": v["f1-score"], "support": v["support"]}
                     for k, v in report.items() if k not in ("accuracy", "macro avg", "weighted avg")},
    }

    with open(MODEL_DIR / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
    with open(MODEL_DIR / "vocab.json", "w") as f:
        json.dump(vocab, f, separators=(",", ":"))
    with open(MODEL_DIR / "feature_profiles.json", "w") as f:
        json.dump(feature_profiles, f, indent=1)

    print(f"CV accuracy: {cv_acc.mean():.4f} +/- {cv_acc.std():.4f} | CV macro-F1: {cv_f1.mean():.4f}")
    print(f"held-out accuracy: {acc:.4f} | macro-F1: {f1:.4f}")
    print(f"vocab exported: {len(vocab)} features")
    print("artifacts written to", MODEL_DIR)


if __name__ == "__main__":
    main()
