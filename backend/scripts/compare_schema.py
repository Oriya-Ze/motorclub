"""Compare a live PostgreSQL schema against SQLAlchemy Base.metadata."""

from __future__ import annotations

import asyncio
import json
import sys
from collections import defaultdict

from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings
from app.models import Base

import app.models  # noqa: F401


def _normalize_type(type_str: str) -> str:
    normalized = (
        type_str.lower()
        .replace("character varying", "varchar")
        .replace("timestamp with time zone", "timestamptz")
        .replace("timestamp without time zone", "timestamp")
    )
    if normalized == "timestamp":
        return "timestamptz"
    if normalized in {"array", "_varchar", "_text"}:
        return "array"
    if normalized.endswith("[]"):
        return normalized
    if normalized == "double precision":
        return "float"
    return normalized


def _metadata_snapshot() -> dict:
    from sqlalchemy.dialects import postgresql as pg

    dialect = pg.dialect()
    snapshot: dict = {"tables": {}, "summary": defaultdict(int)}

    for table in Base.metadata.sorted_tables:
        table_name = table.name
        columns = {}
        for column in table.columns:
            compiled = _normalize_type(str(column.type.compile(dialect=dialect)))
            columns[column.name] = {
                "type": compiled,
                "nullable": column.nullable,
                "primary_key": column.primary_key,
            }
        pk = [col.name for col in table.primary_key.columns]
        fks = []
        for fk in table.foreign_key_constraints:
            fks.append(
                {
                    "columns": [c.name for c in fk.columns],
                    "referred_table": fk.elements[0].column.table.name,
                    "referred_columns": [e.column.name for e in fk.elements],
                    "ondelete": fk.ondelete,
                }
            )
        uniques = []
        for constraint in table.constraints:
            if constraint.__class__.__name__ == "UniqueConstraint":
                uniques.append(sorted([c.name for c in constraint.columns]))
        indexes = []
        for index in table.indexes:
            indexes.append(
                {
                    "name": index.name,
                    "columns": [c.name for c in index.columns],
                    "unique": index.unique,
                }
            )

        snapshot["tables"][table_name] = {
            "columns": columns,
            "primary_key": pk,
            "foreign_keys": sorted(fks, key=lambda x: tuple(x["columns"])),
            "unique_constraints": sorted(uniques),
            "indexes": sorted(indexes, key=lambda x: x["name"] or ""),
        }
        snapshot["summary"]["tables"] += 1
        snapshot["summary"]["columns"] += len(columns)
        snapshot["summary"]["foreign_keys"] += len(fks)
        snapshot["summary"]["unique_constraints"] += len(uniques)
        snapshot["summary"]["indexes"] += len(indexes)

    return snapshot


async def _database_snapshot() -> dict:
    engine = create_async_engine(settings.database_url)

    async with engine.connect() as conn:
        def reflect(connection):
            inspector = inspect(connection)
            snapshot = {"tables": {}, "summary": defaultdict(int)}

            for table_name in sorted(inspector.get_table_names()):
                if table_name == "alembic_version":
                    continue

                columns = {}
                pk_cols = inspector.get_pk_constraint(table_name).get("constrained_columns") or []
                for col in inspector.get_columns(table_name):
                    columns[col["name"]] = {
                        "type": _normalize_type(str(col["type"])),
                        "nullable": col["nullable"],
                        "primary_key": col["name"] in pk_cols,
                    }

                pk = pk_cols

                fks = []
                for fk in inspector.get_foreign_keys(table_name):
                    fks.append(
                        {
                            "columns": fk["constrained_columns"],
                            "referred_table": fk["referred_table"],
                            "referred_columns": fk["referred_columns"],
                            "ondelete": fk.get("options", {}).get("ondelete") or fk.get("ondelete"),
                        }
                    )

                uniques = [sorted(u["column_names"]) for u in inspector.get_unique_constraints(table_name)]
                indexes = []
                for idx in inspector.get_indexes(table_name):
                    indexes.append(
                        {
                            "name": idx["name"],
                            "columns": idx["column_names"],
                            "unique": idx["unique"],
                        }
                    )

                snapshot["tables"][table_name] = {
                    "columns": columns,
                    "primary_key": pk,
                    "foreign_keys": sorted(fks, key=lambda x: tuple(x["columns"])),
                    "unique_constraints": sorted(uniques),
                    "indexes": sorted(indexes, key=lambda x: x["name"] or ""),
                }
                snapshot["summary"]["tables"] += 1
                snapshot["summary"]["columns"] += len(columns)
                snapshot["summary"]["foreign_keys"] += len(fks)
                snapshot["summary"]["unique_constraints"] += len(uniques)
                snapshot["summary"]["indexes"] += len(indexes)

            return snapshot

        snapshot = await conn.run_sync(reflect)

    await engine.dispose()
    return snapshot


def _diff(expected: dict, actual: dict) -> list[str]:
    issues: list[str] = []

    expected_tables = set(expected["tables"])
    actual_tables = set(actual["tables"])

    for missing in sorted(expected_tables - actual_tables):
        issues.append(f"MISSING TABLE in database: {missing}")
    for extra in sorted(actual_tables - expected_tables):
        issues.append(f"EXTRA TABLE in database: {extra}")

    for table in sorted(expected_tables & actual_tables):
        exp = expected["tables"][table]
        act = actual["tables"][table]

        exp_cols = set(exp["columns"])
        act_cols = set(act["columns"])
        for col in sorted(exp_cols - act_cols):
            issues.append(f"{table}: MISSING COLUMN {col}")
        for col in sorted(act_cols - exp_cols):
            issues.append(f"{table}: EXTRA COLUMN {col}")

        for col in sorted(exp_cols & act_cols):
            ec, ac = exp["columns"][col], act["columns"][col]
            et, at = ec["type"].lower(), ac["type"].lower()
            if ec["nullable"] != ac["nullable"]:
                issues.append(f"{table}.{col}: nullable expected={ec['nullable']} actual={ac['nullable']}")
            if ec["primary_key"] != ac["primary_key"]:
                issues.append(f"{table}.{col}: primary_key expected={ec['primary_key']} actual={ac['primary_key']}")
            if et != at:
                if {et, at} <= {"text[]", "varchar[]", "array"}:
                    pass
                elif "varchar[]" in {et, at} and "array" in {et, at}:
                    pass
                elif et.replace(" ", "") == at.replace(" ", ""):
                    pass
                else:
                    issues.append(f"{table}.{col}: type expected={ec['type']} actual={ac['type']}")

        if exp["primary_key"] != act["primary_key"]:
            issues.append(f"{table}: primary_key expected={exp['primary_key']} actual={act['primary_key']}")

        def _normalize_fks(fks: list[dict]) -> list[tuple]:
            normalized = []
            for fk in fks:
                normalized.append(
                    (
                        tuple(fk["columns"]),
                        fk["referred_table"],
                        tuple(fk["referred_columns"]),
                        (fk.get("ondelete") or "NO ACTION").upper(),
                    )
                )
            return sorted(normalized)

        if _normalize_fks(exp["foreign_keys"]) != _normalize_fks(act["foreign_keys"]):
            issues.append(f"{table}: foreign_keys differ expected={exp['foreign_keys']} actual={act['foreign_keys']}")

        exp_uniques = {tuple(u) for u in exp["unique_constraints"]}
        act_uniques = {tuple(u) for u in act["unique_constraints"]}
        exp_unique_indexes = {tuple(i["columns"]) for i in exp["indexes"] if i["unique"]}
        act_unique_indexes = {tuple(i["columns"]) for i in act["indexes"] if i["unique"]}
        if exp_uniques != act_uniques and exp_unique_indexes != act_unique_indexes:
            issues.append(
                f"{table}: unique constraints/indexes differ expected_uniques={exp['unique_constraints']} "
                f"actual_uniques={act['unique_constraints']} expected_unique_indexes={sorted(exp_unique_indexes)} "
                f"actual_unique_indexes={sorted(act_unique_indexes)}"
            )

        exp_idx = {(tuple(i["columns"]), i["unique"]) for i in exp["indexes"]}
        act_idx = {(tuple(i["columns"]), i["unique"]) for i in act["indexes"]}
        if exp_idx != act_idx:
            issues.append(f"{table}: indexes differ expected={exp['indexes']} actual={act['indexes']}")

    return issues


async def main() -> int:
    expected = _metadata_snapshot()
    actual = await _database_snapshot()
    issues = _diff(expected, actual)

    print("=== SUMMARY ===")
    print("Expected (models):", dict(expected["summary"]))
    print("Actual (database):", dict(actual["summary"]))
    print()
    if issues:
        print(f"=== DIFFERENCES ({len(issues)}) ===")
        for issue in issues:
            print(issue)
    else:
        print("=== NO SCHEMA DIFFERENCES DETECTED ===")

    return 1 if issues else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
