"""Business type constants for workshops vs car services."""

WORKSHOP_BUSINESS_TYPES: frozenset[str] = frozenset(
    {
        "garage",
        "mechanic",
        "body_shop",
        "tires",
        "electric",
        "diagnostics",
        "exhausts",
        "glass",
        "upholstery",
        "wraps",
        "motorcycles",
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
        "car_wash",
        "batteries",
        "car_sales",
        "appraisal",
    }
)

ALL_BUSINESS_TYPES: frozenset[str] = WORKSHOP_BUSINESS_TYPES | SERVICE_BUSINESS_TYPES


def is_valid_business_type(value: str) -> bool:
    return value in ALL_BUSINESS_TYPES


# Whether the business is run by a self-employed person or by a company.
BUSINESS_ENTITIES: frozenset[str] = frozenset({"self_employed", "company"})


def chosen_business_types(values: list[str] | None, fallback: str | None = None) -> list[str]:
    """Distinct categories in the order chosen, the primary one first. Raises if empty or unknown."""
    from fastapi import HTTPException

    chosen: list[str] = []
    for value in values if values else ([fallback] if fallback else []):
        if value not in chosen:
            chosen.append(value)
    if not chosen or not all(is_valid_business_type(value) for value in chosen):
        raise HTTPException(status_code=400, detail="Invalid business category")
    return chosen


def check_business_entity(value: str | None) -> str | None:
    from fastapi import HTTPException

    if value is not None and value not in BUSINESS_ENTITIES:
        raise HTTPException(status_code=400, detail="Invalid business entity")
    return value
