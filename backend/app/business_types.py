"""Business type constants for workshops vs car services."""

WORKSHOP_BUSINESS_TYPES: frozenset[str] = frozenset(
    {
        "garage",
        "mechanic",
        "body_shop",
        "tires",
        "electric",
    }
)

SERVICE_BUSINESS_TYPES: frozenset[str] = frozenset(
    {
        "towing",
        "detailing",
        "insurance",
        "rental",
        "parts",
        "other",
    }
)

ALL_BUSINESS_TYPES: frozenset[str] = WORKSHOP_BUSINESS_TYPES | SERVICE_BUSINESS_TYPES


def is_valid_business_type(value: str) -> bool:
    return value in ALL_BUSINESS_TYPES
