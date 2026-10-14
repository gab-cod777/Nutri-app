"""Analise de foto de prato: deteccao de alimentos + estimativa de porcao.

Saida no formato do contrato `mealAnalysisModelOutputSchema` de
`packages/core/src/schemas/ai.ts` - a API Node valida tudo com Zod de novo.

Limitacoes conhecidas (e por que o app pede confirmacao):
 - O classificador reconhece O QUE ha no prato, mas uma foto sem referencia
   de escala nao permite medir gramas. A porcao vem da porcao tipica de cada
   alimento na tabela, com faixa larga (min/max) e confianca reduzida - o app
   abre o ajuste de porcao e o usuario confirma.
 - Pratos com varios itens: classificamos a imagem inteira e recortes (grade
   2x2 + centro) e juntamos os rotulos mais fortes. Funciona para prato
   feito; nao separa ingredientes misturados (ex.: arroz com legumes).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Sequence

import numpy as np
from PIL import Image

from .alimentos import Alimento
from .classificador import Classificador

# Rotulos de "nao e comida". Se a massa de probabilidade deles domina, rejeitamos.
NAO_COMIDA: list[tuple[str, str]] = [
    ("a photo of a keyboard", "um teclado"),
    ("a photo of a person", "uma pessoa"),
    ("a photo of a dog or a cat", "um animal"),
    ("a photo of a document with text", "um documento"),
    ("a screenshot of a phone screen", "uma captura de tela"),
    ("a photo of an empty plate", "um prato vazio"),
    ("a photo of a car", "um carro"),
    ("a photo of a room", "um ambiente"),
]

LIMIAR_COMIDA = 0.5  # massa minima de probabilidade nos rotulos de comida
LIMIAR_ITEM_RECORTE = 0.25  # prob. minima (entre comidas) para um recorte contar
LIMIAR_ITEM_INTEIRA = 0.15  # idem, na imagem inteira
MAX_ITENS = 5
# A confianca do item e reduzida porque a PORCAO e estimada por tabela, nao medida.
# 0.6 x 0.95 = 0.57: sempre abaixo do limiar de 0.6 do core (ANALYSIS_THRESHOLDS),
# entao o app SEMPRE abre o ajuste de porcao - foto nao mede gramas.
FATOR_INCERTEZA_PORCAO = 0.6


def rotulos(alimentos: Sequence[Alimento]) -> list[str]:
    return [f"a photo of {a.clip_prompt}" for a in alimentos] + [r for r, _ in NAO_COMIDA]


@dataclass(frozen=True)
class Qualidade:
    nivel: str  # good | fair | poor
    brilho: float
    nitidez: float


def avaliar_qualidade(img: Image.Image) -> Qualidade:
    """Brilho medio e nitidez (variancia do Laplaciano) numa versao reduzida."""
    cinza = np.asarray(img.convert("L").resize((256, 256)), dtype=np.float32)
    brilho = float(cinza.mean())
    lap = (
        -4 * cinza[1:-1, 1:-1]
        + cinza[:-2, 1:-1]
        + cinza[2:, 1:-1]
        + cinza[1:-1, :-2]
        + cinza[1:-1, 2:]
    )
    nitidez = float(lap.var())
    if brilho < 35 or brilho > 230 or nitidez < 40:
        nivel = "poor"
    elif brilho < 60 or nitidez < 120:
        nivel = "fair"
    else:
        nivel = "good"
    return Qualidade(nivel=nivel, brilho=brilho, nitidez=nitidez)


def recortes(img: Image.Image) -> list[Image.Image]:
    """Imagem inteira + quadrantes + centro. A primeira e sempre a inteira."""
    w, h = img.size
    caixas = [
        (0, 0, w // 2, h // 2),
        (w // 2, 0, w, h // 2),
        (0, h // 2, w // 2, h),
        (w // 2, h // 2, w, h),
        (w // 4, h // 4, 3 * w // 4, 3 * h // 4),
    ]
    return [img] + [img.crop(c) for c in caixas]


def risco_calorias_ocultas(itens: Sequence[Alimento]) -> str:
    preparos = {a.preparation_method for a in itens}
    if preparos & {"fried", "deep_fried", "breaded_fried"} or any(
        a.category in {"fat_oil", "prepared_dish"} for a in itens
    ):
        return "high"
    if preparos & {"sauteed", "stewed"}:
        return "medium"
    return "low"


def analisar(img: Image.Image, alimentos: Sequence[Alimento], classificador: Classificador) -> dict[str, Any]:
    img = img.convert("RGB")
    qualidade = avaliar_qualidade(img)
    n_food = len(alimentos)

    probs = classificador.probabilidades(recortes(img))  # (6, n_food + n_nao_comida)
    inteira = probs[0]
    massa_comida = float(inteira[:n_food].sum())

    if massa_comida < LIMIAR_COMIDA:
        idx = int(np.argmax(inteira[n_food:]))
        return {
            "isFood": False,
            "rejectionReason": f"A foto parece mostrar {NAO_COMIDA[idx][1]}, nao uma refeicao.",
            "mealType": None,
            "description": None,
            "imageQuality": qualidade.nivel,
            "hiddenCalorieRisk": "low",
            "foods": [],
        }

    # Distribuicao so entre comidas, por recorte.
    comida = probs[:, :n_food]
    comida = comida / np.clip(comida.sum(axis=1, keepdims=True), 1e-9, None)

    pontuacao: dict[int, float] = {}
    top_inteira = np.argsort(-comida[0])[:3]
    for i in top_inteira:
        if comida[0, i] >= LIMIAR_ITEM_INTEIRA or i == top_inteira[0]:
            pontuacao[int(i)] = max(pontuacao.get(int(i), 0.0), float(comida[0, i]))
    for linha in comida[1:]:
        i = int(np.argmax(linha))
        if linha[i] >= LIMIAR_ITEM_RECORTE:
            pontuacao[i] = max(pontuacao.get(i, 0.0), float(linha[i]))

    escolhidos = sorted(pontuacao.items(), key=lambda kv: -kv[1])[:MAX_ITENS]
    itens = [alimentos[i] for i, _ in escolhidos]
    penalidade_qualidade = {"good": 1.0, "fair": 0.85, "poor": 0.6}[qualidade.nivel]

    foods = []
    for (i, score), a in zip(escolhidos, itens):
        confianca = min(0.95, score) * FATOR_INCERTEZA_PORCAO * penalidade_qualidade
        foods.append(
            {
                "name": a.name.lower(),
                "canonicalName": a.canonical_name,
                "category": a.category,
                "preparationMethod": a.preparation_method,
                "estimatedGrams": a.default_grams,
                "minGrams": min(a.min_grams, a.default_grams),
                "maxGrams": max(a.max_grams, a.default_grams),
                "per100g": a.per100g,
                "confidence": round(float(confianca), 2),
                "notes": "Porcao estimada pela porcao tipica; ajuste se necessario.",
            }
        )

    return {
        "isFood": True,
        "rejectionReason": None,
        "mealType": None,  # a API decide pelo horario local do usuario
        "description": ", ".join(a.name.lower() for a in itens[:3]),
        "imageQuality": qualidade.nivel,
        "hiddenCalorieRisk": risco_calorias_ocultas(itens),
        "foods": foods,
    }
