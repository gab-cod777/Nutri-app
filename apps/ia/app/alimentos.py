"""Tabela de alimentos compartilhada com a API (apps/ia/app/dados/alimentos.json)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Alimento:
    canonical_name: str
    name: str
    category: str
    preparation_method: str
    per100g: dict[str, float]
    default_grams: float
    min_grams: float
    max_grams: float
    clip_prompt: str


def carregar_alimentos(path: Path) -> list[Alimento]:
    data = json.loads(path.read_text(encoding="utf-8"))
    alimentos = [
        Alimento(
            canonical_name=f["canonicalName"],
            name=f["name"],
            category=f["category"],
            preparation_method=f["preparationMethod"],
            per100g=dict(f["per100g"]),
            default_grams=float(f["portion"]["defaultGrams"]),
            min_grams=float(f["portion"]["minGrams"]),
            max_grams=float(f["portion"]["maxGrams"]),
            clip_prompt=f["clipPrompt"],
        )
        for f in data["foods"]
    ]
    if not alimentos:
        raise RuntimeError(f"Tabela de alimentos vazia: {path}")
    return alimentos
