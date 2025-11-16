import random
from dataclasses import dataclass
from typing import List, Tuple

RANKS = "23456789TJQKA"
SUITS = "cdhs"  # clubs, diamonds, hearts, spades

@dataclass
class HoldemHandResult:
    player_cards: List[str]
    board: List[str]
    hand_name: str


def _card_value(card: str) -> Tuple[int, int]:
    r, s = card[0], card[1]
    return RANKS.index(r), SUITS.index(s)


def new_deck() -> List[str]:
    deck = [r + s for r in RANKS for s in SUITS]
    random.shuffle(deck)
    return deck


def evaluate_7cards(cards: List[str]) -> Tuple[int, List[int]]:
    """Очень упрощённый оценщик 7 карт.
    Возвращает (ранг_комбинации, вспомогательные значения для сравнения).
    Ранги: 0 - high card, 1 - pair, 2 - two pair, 3 - trips, 4 - straight,
           5 - flush, 6 - full house, 7 - quads, 8 - straight flush
    Для тренажёра достаточно названия руки, поэтому логика упрощена.
    """
    ranks = [RANKS.index(c[0]) for c in cards]
    ranks.sort(reverse=True)
    is_flush = len({c[1] for c in cards}) == 1

    # straight detection (с учётом A-5)
    uniq = sorted(set(ranks), reverse=True)
    if len(uniq) >= 5:
        straight_high = None
        for i in range(len(uniq) - 4):
            window = uniq[i:i+5]
            if window[0] - window[4] == 4:
                straight_high = window[0]
                break
        # A-5
        if straight_high is None and set(uniq) >= {12, 3, 2, 1, 0}:  # A,5,4,3,2
            straight_high = 3
    else:
        straight_high = None

    if is_flush and straight_high is not None:
        return 8, [straight_high]

    # counts
    from collections import Counter
    cnt = Counter(ranks)
    groups = sorted(cnt.items(), key=lambda x: (-x[1], -x[0]))
    counts = [c for r, c in groups]
    order = [r for r, c in groups]

    if counts[0] == 4:
        return 7, [order[0], order[1]]
    if counts[0] == 3 and counts[1] >= 2:
        return 6, [order[0], order[1]]
    if is_flush:
        return 5, ranks
    if straight_high is not None:
        return 4, [straight_high]
    if counts[0] == 3:
        kickers = [r for r in ranks if r != order[0]][:2]
        return 3, [order[0]] + kickers
    if counts[0] == 2 and counts[1] == 2:
        remaining = [r for r in ranks if r not in (order[0], order[1])]
        return 2, [max(order[0], order[1]), min(order[0], order[1]), remaining[0]]
    if counts[0] == 2:
        kickers = [r for r in ranks if r != order[0]][:3]
        return 1, [order[0]] + kickers
    return 0, ranks


HAND_NAMES = {
    8: "Стрит‑флеш",
    7: "Каре",
    6: "Фул‑хаус",
    5: "Флеш",
    4: "Стрит",
    3: "Сет",
    2: "Две пары",
    1: "Пара",
    0: "Старшая карта",
}


def deal_training_hand() -> HoldemHandResult:
    """Раздать тренировочную раздачу: 2 карты игроку + борд 5 карт."""
    deck = new_deck()
    player = deck[:2]
    board = deck[2:7]
    rank, _ = evaluate_7cards(player + board)
    hand_name = HAND_NAMES.get(rank, "Старшая карта")
    return HoldemHandResult(player_cards=player, board=board, hand_name=hand_name)
