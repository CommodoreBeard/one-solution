"""The cheap half of the self-test: symmetry quotient + duplicate-piece handling.

These are the two things that were BROKEN in the first run and that every
statistic depends on. The pentomino literature benchmark runs separately.
"""

from dissect import parse, canonical, stabiliser, count_solutions, orbit_count, SHAPES

fails = 0


def check(name, got, want):
    global fails
    ok = got == want
    if not ok:
        fails += 1
    print(f"  {'PASS' if ok else 'FAIL'}  {name}: got {got}, want {want}")


print("A. Symmetry groups")
for name, want in [("square_7x7", 8), ("rect_6x8", 4), ("heart", 2), ("cat", 2),
                   ("blob", 1), ("dog", 2), ("initials_JH", 1)]:
    g, _ = stabiliser(parse(SHAPES[name]))
    check(f"|G| {name}", len(g), want)

print("\nB. Piece identity under flips (a wooden piece can be turned over)")
L1 = frozenset({(0, 0), (1, 0), (1, 1)})
L2 = frozenset({(0, 1), (1, 0), (1, 1)})
check("L-tromino == mirror", canonical(L1) == canonical(L2), True)
S = frozenset({(0, 1), (0, 2), (1, 0), (1, 1)})
Z = frozenset({(0, 0), (0, 1), (1, 1), (1, 2)})
check("S == Z tetromino", canonical(S) == canonical(Z), True)
check("L != I tromino", canonical(L1) == canonical(frozenset({(0, 0), (0, 1), (0, 2)})), False)

print("\nC. Symmetry quotient fires (this is what was broken)")
# 2x3 rectangle, |G|=4, cut into two L-trominoes. The two raw partitions are
# mirror images of each other, i.e. the SAME puzzle. Orbits must be 1.
target = frozenset((r, c) for r in range(2) for c in range(3))
g, _ = stabiliser(target)
Ltrom = frozenset({(0, 0), (1, 0), (1, 1)})
sols = count_solutions([Ltrom], [2], target, cap=10**9)
check("2x3 |G|", len(g), 4)
print(f"       2x3 into two L-trominoes: {len(sols)} raw partitions")
check("2x3 two L-trominoes -> orbits", orbit_count(sols, g, target), 1)

print("\nD. Duplicate congruent pieces are not double counted")
# 2x2 into two dominoes: both-horizontal and both-vertical are the two raw
# partitions, related by a 90 degree rotation -> one orbit.
target = frozenset((r, c) for r in range(2) for c in range(2))
g, _ = stabiliser(target)
dom = frozenset({(0, 0), (0, 1)})
sols = count_solutions([dom], [2], target, cap=10**9)
check("2x2 two dominoes raw", len(sols), 2)
check("2x2 two dominoes orbits", orbit_count(sols, g, target), 1)

# 1x4 bar into two dominoes: exactly one partition, |G|=2, one orbit.
target = frozenset((0, c) for c in range(4))
g, _ = stabiliser(target)
sols = count_solutions([dom], [2], target, cap=10**9)
check("1x4 two dominoes raw", len(sols), 1)
check("1x4 two dominoes orbits", orbit_count(sols, g, target), 1)

print("\nE. Asymmetric target: orbits must equal raw count (|G| = 1)")
target = parse(SHAPES["blob"])
g, _ = stabiliser(target)
check("blob |G|", len(g), 1)
# Any dissection of an asymmetric target has orbit count == raw count.
import random
from collections import Counter
from dissect import dissect
rng = random.Random(7)
ok = True
for _ in range(15):
    pieces = dissect(target, 6, rng)
    if pieces is None:
        continue
    counter = Counter(canonical(p) for p in pieces)
    types = [frozenset(t) for t in counter]
    sols = count_solutions(types, list(counter.values()), target, cap=200)
    if orbit_count(sols, g, target) != len(sols):
        ok = False
        break
check("orbits == raw when |G|=1", ok, True)

print("\nF. Small pentomino benchmark (literature: 3x20 has 2 solutions)")
PENT = {
    "F": {(0, 1), (0, 2), (1, 0), (1, 1), (2, 1)},
    "I": {(0, 0), (1, 0), (2, 0), (3, 0), (4, 0)},
    "L": {(0, 0), (1, 0), (2, 0), (3, 0), (3, 1)},
    "N": {(0, 1), (1, 1), (2, 0), (2, 1), (3, 0)},
    "P": {(0, 0), (0, 1), (1, 0), (1, 1), (2, 0)},
    "T": {(0, 0), (0, 1), (0, 2), (1, 1), (2, 1)},
    "U": {(0, 0), (0, 2), (1, 0), (1, 1), (1, 2)},
    "V": {(0, 0), (1, 0), (2, 0), (2, 1), (2, 2)},
    "W": {(0, 0), (1, 0), (1, 1), (2, 1), (2, 2)},
    "X": {(0, 1), (1, 0), (1, 1), (1, 2), (2, 1)},
    "Y": {(0, 1), (1, 0), (1, 1), (2, 1), (3, 1)},
    "Z": {(0, 0), (0, 1), (1, 1), (2, 1), (2, 2)},
}
types = [frozenset(v) for v in PENT.values()]
target = frozenset((r, c) for r in range(3) for c in range(20))
g, _ = stabiliser(target)
import time
t0 = time.time()
sols = count_solutions(types, [1] * 12, target, cap=10**9)
orb = orbit_count(sols, g, target)
print(f"       ({time.time()-t0:.1f}s, {len(sols)} raw, |G|={len(g)})")
check("pentominoes in 3x20", orb, 2)

print(f"\n{'ALL PASSED' if fails == 0 else str(fails) + ' FAILED'}")
