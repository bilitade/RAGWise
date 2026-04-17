from app.db.models import User, UserRole


class SearchMode:
    similarity = "similarity"
    splade = "splade"
    advanced = "advanced"


def user_can_use_search_mode(user: User | None, mode: str) -> bool:
    """normal: similarity only; pro/admin: all modes."""
    if mode == SearchMode.similarity:
        return True
    if user is None:
        return False
    return user.role in (UserRole.pro, UserRole.admin)


def user_can_use_advanced_split(user: User | None) -> bool:
    if user is None:
        return False
    return user.role in (UserRole.pro, UserRole.admin)
