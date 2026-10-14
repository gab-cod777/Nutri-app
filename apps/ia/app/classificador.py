"""Classificador de imagem.

`Classificador` e a porta: recebe imagens e uma lista fixa de rotulos e devolve
a probabilidade de cada rotulo por imagem. A implementacao real usa CLIP em
modo zero-shot - nao foi treinado em comida brasileira especificamente, mas
compara a imagem com descricoes em texto ("a photo of white rice"), o que
permite usar os rotulos da NOSSA tabela sem treinar um modelo.

Os testes usam um classificador falso; o modelo real so e carregado em
producao/desenvolvimento.
"""

from __future__ import annotations

from typing import Protocol, Sequence

import numpy as np
from PIL import Image


class Classificador(Protocol):
    nome: str

    def probabilidades(self, imagens: Sequence[Image.Image]) -> np.ndarray:
        """Matriz (n_imagens, n_rotulos) com softmax sobre todos os rotulos."""
        ...


class ClipClassificador:
    def __init__(self, model_name: str, rotulos: Sequence[str]) -> None:
        import torch
        from transformers import CLIPModel, CLIPProcessor

        self._torch = torch
        self.nome = model_name
        self._model = CLIPModel.from_pretrained(model_name).eval()
        self._processor = CLIPProcessor.from_pretrained(model_name)
        # Embeddings de texto sao fixos: calculados uma vez na subida.
        with torch.no_grad():
            tokens = self._processor(text=list(rotulos), return_tensors="pt", padding=True)
            texto = _features(self._model.get_text_features(**tokens))
            self._texto = texto / texto.norm(dim=-1, keepdim=True)
        self._escala = self._model.logit_scale.exp()

    def probabilidades(self, imagens: Sequence[Image.Image]) -> np.ndarray:
        torch = self._torch
        with torch.no_grad():
            pixels = self._processor(images=list(imagens), return_tensors="pt")
            img = _features(self._model.get_image_features(**pixels))
            img = img / img.norm(dim=-1, keepdim=True)
            logits = self._escala * img @ self._texto.T
            return logits.softmax(dim=-1).cpu().numpy()


def _features(saida):  # type: ignore[no-untyped-def]
    """transformers < 5 devolve o tensor; >= 5 devolve um objeto com `pooler_output` ja projetado."""
    return saida if hasattr(saida, "norm") else saida.pooler_output
