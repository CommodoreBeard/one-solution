"""Differential test: compare the fast counter against a naive, independently
written enumerator over many random cases.

The naive version deliberately shares no logic with count_solutions: it places
pieces in every order, collects each resulting partition into a set, and lets
the set deduplicate. Slow, obviously correct, and a completely different code
path. If the two disagree on any case, the fast counter is wrong.
"""

import random
from collections import Counter

from dissect import (
    parse, canonical, transforms, stabiliser, dissect, count_solutions,
    orbit_count, SHAPES,
)


def naive_partitions(piece_types, counts, target):
    """Every partition of target into the given multiset of piece shapes."""
    placements = []
    for shape in piece_types:
        opts = set()
        for t in transforms(shape):
            h = max(r for r, _ in t) + 1
            w = max(c for _, c in t) + 1
            rows = max(r for r, _ in target) + 1
            cols = max(c for _, c in target) + 1
            for dr in range(rows - h + 1):
                for dc in range(cols - w + 1):
                    placed = frozenset((r + dr, c + dc) for (r, c) in t)
                    if placed <= target:
                        opts.add(placed)
        placements.append(sorted(opts, key=lambda s: sorted(s)))

    found = set()

    def rec(remaining_cells, remaining_counts, chosen):
        if not remaining_cells:
            found.add(frozenset(chosen))
            return
        for ti in range(len(piece_types)):
            if remaining_counts[ti] == 0:
                continue
            for p in placements[ti]:
                if not p <= remaining_cells:
                    continue
                remaining_counts[ti] -= 1
                chosen.append(p)
                rec(remaining_cells - p, remaining_counts, chosen)
                chosen.pop()
                remaining_counts[ti] += 1

    rec(frozenset(target), list(counts), [])
    return found


def small_targets(rng, n):
    """Random small connected blobs, plus small rectangles."""
    out = []
    for rows, cols in [(2, 3), (2, 4), (3, 3), (3, 4), (2, 5), (4, 4)]:
        out.append(frozenset((r, c) for r in range(rows) for c in range(cols)))
    while len(out) < n:
        rows, cols = rng.randint(3, 4), rng.randint(3, 5)
        cells = {(rng.randrange(rows), rng.randrange(cols))}
        want = rng.randint(8, min(12, rows * cols))
        while len(cells) < want:
            r, c = rng.choice(sorted(cells))
            nb = [(r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)]
            nb = [p for p in nb if 0 <= p[0] < rows and 0 <= p[1] < cols]
            cells.add(rng.choice(nb))
        out.append(frozenset(cells))
    return out


def main():
    rng = random.Random(99)
    targets = small_targets(rng, 24)
    cases = 0
    mismatches = 0
    for target in targets:
        for k in (2, 3, 4):
            if len(target) < k * 2:
                continue
            for _ in range(6):
                pieces = dissect(target, k, rng)
                if pieces is None:
                    continue
                counter = Counter(canonical(p) for p in pieces)
                types = [frozenset(t) for t in counter]
                counts = list(counter.values())

                fast = count_solutions(types, counts, target, cap=10 ** 9)
                slow = naive_partitions(types, counts, target)
                cases += 1
                if set(fast) != slow:
                    mismatches += 1
                    print(f"MISMATCH target={sorted(target)} k={k} "
                          f"fast={len(fast)} slow={len(slow)}")
                    if mismatches > 3:
                        return cases, mismatches
    return cases, mismatches


if __name__ == "__main__":
    cases, mismatches = main()
    print(f"\nDifferential test: {cases} random cases, {mismatches} mismatches")
    print("PASS" if mismatches == 0 else "FAIL")

    # Second, independent check on the symmetry quotient: for every case, the
    # number of orbits times the group order must be at least the raw count,
    # and orbits must never exceed raw.
    rng = random.Random(4242)
    bad = 0
    checked = 0
    for name in ("blob", "cat", "heart", "rect_6x8", "square_7x7", "dog"):
        target = parse(SHAPES[name])
        group, _ = stabiliser(target)
        for _ in range(25):
            pieces = dissect(target, 6, rng)
            if pieces is None:
                continue
            counter = Counter(canonical(p) for p in pieces)
            sols = count_solutions([frozenset(t) for t in counter],
                                   list(counter.values()), target, cap=400)
            orb = orbit_count(sols, group, target)
            checked += 1
            if not (1 <= orb <= len(sols) <= orb * len(group)):
                bad += 1
                print(f"BAD ORBIT {name}: raw={len(sols)} orbits={orb} |G|={len(group)}")
    print(f"Orbit bounds: {checked} cases, {bad} violations")
    print("PASS" if bad == 0 else "FAIL")
