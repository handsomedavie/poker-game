from typing import Dict, List


users_db: Dict[str, dict] = {}
_guest_counter = 0


async def get_user(user_id: int, start_balance: int, display_name: str) -> dict:
    global _guest_counter
    key: str

    if user_id:
        key = str(user_id)
    else:
        _guest_counter += 1
        key = f"guest_{_guest_counter}"

    if key not in users_db:
        users_db[key] = {
            "user_id": key,
            "display_name": display_name,
            "balance": start_balance,
        }

    return users_db[key]


async def top_balances(limit: int = 10) -> List[dict]:
    return sorted(users_db.values(), key=lambda x: x["balance"], reverse=True)[:limit]


async def set_display_name(user_id: int, name: str) -> bool:
    key = str(user_id)
    if key in users_db:
        users_db[key]["display_name"] = name
        return True
    return False
