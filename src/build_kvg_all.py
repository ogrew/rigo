"""kvg_all.json を作る（rigo 用）。
KanjiVG の全ての基本字形（variant 接尾辞なし）を木にする。座標は 0..109 を 10 倍した整数、1画 16 点。
  tree[ch] = {e, bb, own:[stroke...], ty:[type...], kids:[node...], pos, orig, p, ap}
    ap: 文脈内の画 i に対応する、素の字形（tree[e]）の画の番号（own→kids の順で数えたもの）。最適割当で求める。
  order: 読み情報のある字を 学年 → 画数 の順に並べたもの（常用 → 人名用 → その他）
  grade[ch], info[ch] = {on, kun, m, n}
"""
import json, re, sys, unicodedata
from pathlib import Path
import numpy as np
from svgelements import Path as SPath
from scipy.optimize import linear_sum_assignment

ROOT = Path(__file__).parent.parent
KVG = ROOT / "data/kanjivg/kanji"
NS = "{http://kanjivg.tagaini.net}"
NPT = 16
import xml.etree.ElementTree as ET


def sample(d):
    p = SPath(d)
    L = p.length(error=1e-3)
    if L == 0:
        q = p.point(0)
        return [[round(q.x * 10), round(q.y * 10)]] * NPT
    return [[round(p.point(i / (NPT - 1)).x * 10), round(p.point(i / (NPT - 1)).y * 10)] for i in range(NPT)]


def load(ch):
    p = KVG / f"{ord(ch):05x}.svg"
    if not p.exists():
        return None
    root = ET.parse(p).getroot()
    g = root.find(".//{http://www.w3.org/2000/svg}g[@id='kvg:%05x']" % ord(ch))
    if g is None:
        return None

    def walk(el):
        n = {"e": el.get(NS + "element") or "", "own": [], "ty": [], "kids": []}
        pos, orig, part = el.get(NS + "position"), el.get(NS + "original"), el.get(NS + "part")
        if pos: n["pos"] = pos
        if orig: n["orig"] = orig
        if part: n["p"] = int(part)
        for c in el:
            tag = c.tag.split("}")[1]
            if tag == "path":
                n["own"].append(sample(c.get("d")))
                n["ty"].append(c.get(NS + "type") or "")
            elif tag == "g":
                n["kids"].append(walk(c))
        return n

    return walk(g)


def strokes(n):
    o = list(n["own"])
    for k in n["kids"]:
        o += strokes(k)
    return o


def set_bb(n):
    pts = [q for s in strokes(n) for q in s]
    if pts:
        xs = [q[0] for q in pts]; ys = [q[1] for q in pts]
        n["bb"] = [min(xs), min(ys), max(xs), max(ys)]
    for k in n["kids"]:
        set_bb(k)


def normalize(polys):
    pts = np.array([q for s in polys for q in s], dtype=float)
    mn = pts.min(0); sz = max((pts.max(0) - mn).max(), 1e-6)
    return [(np.array(s, dtype=float) - mn) / sz for s in polys]


def assign(A, B):
    a, b = normalize(A), normalize(B)
    C = np.array([[np.linalg.norm(x - y, axis=1).sum() for y in b] for x in a])
    r, c = linear_sum_assignment(C)
    perm = [0] * len(A)
    for i, j in zip(r, c):
        perm[i] = int(j)
    return perm


def main():
    chars = []
    for p in sorted(KVG.glob("*.svg")):
        if re.fullmatch(r"[0-9a-f]{5}\.svg", p.name):
            chars.append(chr(int(p.stem, 16)))
    print("kanjivg base files:", len(chars), file=sys.stderr)
    trees = {}
    for i, ch in enumerate(chars):
        t = load(ch)
        if t is None:
            continue
        set_bb(t)
        if "bb" not in t:
            continue
        trees[ch] = t
        if i % 500 == 0:
            print(i, file=sys.stderr)
    print("trees:", len(trees), file=sys.stderr)
    # ap: 文脈内の部品 ↔ 素の字形の画の対応
    std = {ch: strokes(t) for ch, t in trees.items()}
    n_ap = 0

    def rec(n):
        nonlocal n_ap
        for k in n["kids"]:
            e = k["e"]
            if e and e in std and len(std[e]) == len(strokes(k)) and len(std[e]) > 1:
                perm = assign(strokes(k), std[e])
                if perm != list(range(len(perm))):
                    k["ap"] = perm
                    n_ap += 1
            rec(k)

    for ch, t in trees.items():
        rec(t)
    print("ap:", n_ap, file=sys.stderr)
    # info / order / grade
    K = json.load(open(ROOT / "data/kanji.json", encoding="utf-8"))
    info, grade = {}, {}
    for ch, v in K.items():
        info[ch] = {"on": v.get("readings_on") or [], "kun": v.get("readings_kun") or [], "m": v.get("meanings") or [], "n": v.get("strokes")}
        if v.get("grade"):
            grade[ch] = v["grade"]
    order = [ch for ch in trees if ch in K]
    order.sort(key=lambda c: (grade.get(c, 99), K[c].get("strokes") or 99, ord(c)))
    # index: 字 → 含まれる部品名
    index = {}
    for ch, t in trees.items():
        names = set()

        def walk(n):
            if n["e"] and n is not t:
                names.add(n["e"])
            for k in n["kids"]:
                walk(k)

        walk(t)
        index[ch] = sorted(names)
    out = {"order": order, "grade": grade, "index": index, "tree": trees, "info": info}
    dst = ROOT / "out/drift/kvg_all.json"
    json.dump(out, open(dst, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
    print("wrote", dst, dst.stat().st_size // 1024, "KB", file=sys.stderr)


if __name__ == "__main__":
    main()
