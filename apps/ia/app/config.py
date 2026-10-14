"""Configuracao do servico de IA, lida do ambiente na subida."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

DADOS_DIR = Path(__file__).parent / "dados"


@dataclass(frozen=True)
class Config:
    # Segredo compartilhado com a API Node. O servico NAO deve ser exposto a internet:
    # so a API fala com ele, e toda requisicao precisa deste token.
    internal_token: str
    model_name: str
    max_image_bytes: int
    alimentos_path: Path


def load_config() -> Config:
    token = os.environ.get("IA_INTERNAL_TOKEN", "")
    if len(token) < 24:
        raise RuntimeError("IA_INTERNAL_TOKEN ausente ou curto demais (minimo 24 caracteres).")
    return Config(
        internal_token=token,
        model_name=os.environ.get("IA_MODEL_NAME", "openai/clip-vit-base-patch32"),
        max_image_bytes=int(os.environ.get("IA_MAX_IMAGE_BYTES", str(5 * 1024 * 1024))),
        alimentos_path=Path(os.environ.get("IA_ALIMENTOS_PATH", str(DADOS_DIR / "alimentos.json"))),
    )
