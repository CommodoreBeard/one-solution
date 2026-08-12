"""
Feasibility experiment for the "One Solution" idea.

Question nobody in the research process answered:
  For a real user-supplied silhouette, does a dissection into k pieces with
  EXACTLY ONE solution usually exist, and can we find it in browser-time?

Method:
  1. Take a target shape (a set of grid cells).
  2. Randomly dissect it into k connected polyomino pieces.
  3. Count how many distinct ways that piece multiset re-packs the target,
     allowing all 8 orientations (a wooden piece can be flipped over),
     and quotienting by the target's own symmetry group.
  4. Repeat. Measure the hit rate and the time.

Counting notes:
  - Identical (congruent) pieces are interchangeable, so we search over piece
    TYPES with counts. Combined with always filling the lowest uncovered cell,
    each distinct partition is generated exactly once.
  - Solutions related by a symmetry of the target are the same puzzle, so we
    canonicalise each partition under the target's stabiliser group.
"""

import random
import sys
import time
from collections import Counter

SOLUTION_CAP = 60  # abort enumeration past this many; such a dissection is useless anyway


# ---------------------------------------------------------------- shapes

SHAPES = {
    # A dog-ish silhouette (the red team's own headline example)
    "dog": """
....##....
...####...
..######..
.########.
.########.
.########.
..##..##..
..##..##..
""",
    # Two initials, "JH", the classic personalised gift
    "initials_JH": """
..####..#....#
.....#..#....#
.....#..######
.....#..#....#
.#...#..#....#
.#####..#....#
""",
    # A heart
    "heart": """
.##..##.
########
########
.######.
..####..
...##...
""",
    # A state-like irregular blob
    "blob": """
..####....
.#######..
##########
##########
.########.
..######..
...###....
""",
    # A cat silhouette
    "cat": """
.#....#.
.######.
########
########
.######.
.#.##.#.
""",
    # Control: a plain rectangle, highly symmetric (the hard case)
    "rect_6x8": """
########
########
########
########
########
########
""",
    # Control: a square
    "square_7x7": """
#######
#######
#######
#######
#######
#######
#######
""",
}


def parse(art):
    cells = set()
    for r, line in enumerate(art.strip("\n").split("\n")):
        for c, ch in enumerate(line):
            if ch == "#":
                cells.add((r, c))
    return frozenset(cells)


# ------------------------------------------------------- transforms

def point_map(rot, flip):
    """A single dihedral operation acting on ONE point, so correspondence survives."""
    def f(pt):
        r, c = pt
        if flip:
            c = -c
        for _ in range(rot):
            r, c = c, -r
        return (r, c)
    return f


DIHEDRAL = [(rot, flip) for flip in (False, True) for rot in range(4)]


def apply_shifted(f, cells):
    """Map every cell through f, then translate so the image touches the origin."""
    img = [f(p) for p in cells]
    mr = min(p[0] for p in img)
    mc = min(p[1] for p in img)
    return [(r - mr, c - mc) for (r, c) in img]


def transforms(cells):
    """All 8 dihedral images of a cell set, each normalised to the origin."""
    cs = list(cells)
    return [frozenset(apply_shifted(point_map(rot, flip), cs)) for rot, flip in DIHEDRAL]


def canonical(cells):
    return min(tuple(sorted(t)) for t in transforms(cells))


def stabiliser(target):
    """The dihedral operations that map the target onto itself, as (rot, flip) pairs."""
    cs = sorted(target)
    mr = min(r for r, _ in cs)
    mc = min(c for _, c in cs)
    norm = frozenset((r - mr, c - mc) for r, c in cs)
    group = []
    for rot, flip in DIHEDRAL:
        f = point_map(rot, flip)
        if frozenset(apply_shifted(f, cs)) == norm:
            group.append((rot, flip))
    return group, norm


# ------------------------------------------------------- dissection

def dissect(target, k, rng):
    """Grow k connected pieces from random seeds until every cell is claimed."""
    cells = list(target)
    seeds = rng.sample(cells, k)
    owner = {s: i for i, s in enumerate(seeds)}
    frontier = [set() for _ in range(k)]
    for i, s in enumerate(seeds):
        for n in neighbours(s):
            if n in target and n not in owner:
                frontier[i].add(n)
    sizes = [1] * k
    unclaimed = len(target) - k

    while unclaimed:
        # grow the smallest piece that still has room, to keep sizes even
        order = sorted(range(k), key=lambda i: (sizes[i], rng.random()))
        grew = False
        for i in order:
            frontier[i] = {c for c in frontier[i] if c not in owner}
            if not frontier[i]:
                continue
            cell = rng.choice(sorted(frontier[i]))
            owner[cell] = i
            sizes[i] += 1
            unclaimed -= 1
            for n in neighbours(cell):
                if n in target and n not in owner:
                    frontier[i].add(n)
            grew = True
            break
        if not grew:
            return None  # stranded cells; retry

    pieces = [frozenset(c for c, o in owner.items() if o == i) for i in range(k)]
    if any(not p for p in pieces):
        return None
    return pieces


def neighbours(cell):
    r, c = cell
    return ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1))


# ------------------------------------------------------- exact cover

def build_placements(piece_types, target, index):
    """For each piece type, every bitmask placement that lies inside the target."""
    rows = max(r for r, _ in target) + 1
    cols = max(c for _, c in target) + 1
    all_placements = []
    for shape in piece_types:
        seen = set()
        masks = []
        for t in transforms(shape):
            if t in seen:
                continue
            seen.add(t)
            h = max(r for r, _ in t) + 1
            w = max(c for _, c in t) + 1
            for dr in range(rows - h + 1):
                for dc in range(cols - w + 1):
                    placed = [(r + dr, c + dc) for (r, c) in t]
                    if all(p in target for p in placed):
                        m = 0
                        for p in placed:
                            m |= 1 << index[p]
                        masks.append((m, frozenset(placed)))
        all_placements.append(masks)
    return all_placements


def count_solutions(piece_types, counts, target, cap=SOLUTION_CAP):
    """Enumerate distinct partitions of the target into the given piece multiset."""
    cells = sorted(target)
    index = {c: i for i, c in enumerate(cells)}
    n = len(cells)
    full = (1 << n) - 1
    placements = build_placements(piece_types, target, index)

    # bucket placements by their lowest covered cell, so the search is O(1) to filter
    by_low = [[[] for _ in range(n)] for _ in piece_types]
    for ti, masks in enumerate(placements):
        for m, cellset in masks:
            by_low[ti][(m & -m).bit_length() - 1].append((m, cellset))

    solutions = []
    remaining = list(counts)

    def rec(covered, chosen):
        if len(solutions) >= cap:
            return
        if covered == full:
            solutions.append(frozenset(chosen))
            return
        low = ((~covered) & full)
        low_i = (low & -low).bit_length() - 1
        for ti in range(len(piece_types)):
            if remaining[ti] == 0:
                continue
            remaining[ti] -= 1
            for m, cellset in by_low[ti][low_i]:
                if m & covered:
                    continue
                chosen.append(cellset)
                rec(covered | m, chosen)
                chosen.pop()
                if len(solutions) >= cap:
                    remaining[ti] += 1
                    return
            remaining[ti] += 1

    rec(0, [])
    return solutions


def orbit_count(solutions, group, target):
    """Collapse solutions that are images of one another under the target's symmetry.

    The offset is computed once from the TARGET, not per piece, so the pieces of a
    partition move together and stay a partition of the same target.
    """
    cells = sorted(target)
    seen = set()
    for sol in solutions:
        images = []
        for rot, flip in group:
            f = point_map(rot, flip)
            img_all = [f(p) for p in cells]
            mr = min(p[0] for p in img_all)
            mc = min(p[1] for p in img_all)
            img = frozenset(
                frozenset((f(p)[0] - mr, f(p)[1] - mc) for p in piece) for piece in sol
            )
            images.append(tuple(sorted(tuple(sorted(pc)) for pc in img)))
        seen.add(min(images))
    return len(seen)


# ------------------------------------------------------- experiment

def run(name, art, k, trials, rng):
    target = parse(art)
    group, _ = stabiliser(target)
    results = []
    t0 = time.time()
    attempts = 0
    unique_found_at = None

    while len(results) < trials:
        attempts += 1
        if attempts > trials * 12:
            break
        pieces = dissect(target, k, rng)
        if pieces is None:
            continue
        canon = [canonical(p) for p in pieces]
        counter = Counter(tuple(c) for c in canon)
        piece_types = [frozenset(t) for t in counter.keys()]
        counts = list(counter.values())

        s0 = time.time()
        sols = count_solutions(piece_types, counts, target)
        elapsed = time.time() - s0
        n_orbits = orbit_count(sols, group, target) if len(sols) < SOLUTION_CAP else None
        results.append((n_orbits, len(sols), elapsed, len(set(canon)) != len(canon)))
        if n_orbits == 1 and unique_found_at is None:
            unique_found_at = len(results)

    uniq = sum(1 for r in results if r[0] == 1)
    capped = sum(1 for r in results if r[0] is None)
    times = [r[2] for r in results]
    dupes = sum(1 for r in results if r[3])
    solved = [r[0] for r in results if r[0] is not None]
    print(
        f"{name:14s} cells={len(target):3d} k={k:2d} |G|={len(group)} | "
        f"unique {uniq:3d}/{len(results):3d} ({100*uniq/max(1,len(results)):5.1f}%) | "
        f"capped(>={SOLUTION_CAP}) {capped:3d} | "
        f"median solns {sorted(solved)[len(solved)//2] if solved else '-':>4} | "
        f"mean {sum(times)/max(1,len(times)):6.3f}s max {max(times) if times else 0:6.3f}s | "
        f"1st unique at try {unique_found_at if unique_found_at else '-'} | "
        f"had dup pieces {dupes}"
    )
    return uniq, len(results), sum(times)


if __name__ == "__main__":
    seed = int(sys.argv[1]) if len(sys.argv) > 1 else 12345
    trials = int(sys.argv[2]) if len(sys.argv) > 2 else 40
    rng = random.Random(seed)
    print(f"seed={seed} trials={trials} solution cap={SOLUTION_CAP}")
    print("(unique = exactly one solution, counting piece flips, up to the target's symmetry)\n")
    total_u = total_n = 0.0
    total_t = 0.0
    for name in ("dog", "initials_JH", "heart", "blob", "cat", "rect_6x8", "square_7x7"):
        art = SHAPES[name]
        target = parse(art)
        for k in (4, 5, 6, 7, 8, 9):
            if len(target) / k < 3:
                continue
            u, n, t = run(name, art, k, trials, rng)
            total_u += u
            total_n += n
            total_t += t
        print()
    print(f"OVERALL: {total_u:.0f}/{total_n:.0f} random dissections unique "
          f"({100*total_u/max(1,total_n):.1f}%), {total_t:.1f}s of search total")
