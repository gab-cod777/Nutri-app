import io
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.alimentos import carregar_alimentos
from app.analise import NAO_COMIDA, avaliar_qualidade
from app.config import DADOS_DIR, Config
from app.main import create_app

TOKEN = "token-interno-de-teste-com-tamanho"
ALIMENTOS = carregar_alimentos(DADOS_DIR / "alimentos.json")
IDX = {a.canonical_name: i for i, a in enumerate(ALIMENTOS)}
N_ROTULOS = len(ALIMENTOS) + len(NAO_COMIDA)


class FakeClassificador:
    """Devolve sempre a mesma distribuicao para todos os recortes."""

    nome = "fake-clip"

    def __init__(self, pesos: dict[int, float]):
        linha = np.full(N_ROTULOS, 1e-4)
        for i, p in pesos.items():
            linha[i] = p
        self.linha = linha / linha.sum()

    def probabilidades(self, imagens):
        return np.tile(self.linha, (len(imagens), 1))


def client_com(pesos: dict[int, float], max_bytes: int = 5 * 1024 * 1024) -> TestClient:
    config = Config(
        internal_token=TOKEN,
        model_name="fake",
        max_image_bytes=max_bytes,
        alimentos_path=DADOS_DIR / "alimentos.json",
    )
    app = create_app(config, lambda cfg, alimentos: FakeClassificador(pesos))
    return TestClient(app)


def foto(fmt: str = "JPEG", tamanho: int = 256) -> bytes:
    # Ruido texturizado: nitido e com brilho medio -> qualidade "good".
    rng = np.random.default_rng(1)
    arr = (rng.random((tamanho, tamanho, 3)) * 160 + 50).astype("uint8")
    buf = io.BytesIO()
    Image.fromarray(arr).save(buf, format=fmt)
    return buf.getvalue()


def enviar(client: TestClient, dados: bytes, token: str = TOKEN):
    return client.post(
        "/analisar",
        files={"foto": ("prato.jpg", dados, "image/jpeg")},
        headers={"x-internal-token": token},
    )


def test_prato_com_varios_itens_devolve_contrato_completo():
    pesos = {IDX["white_rice_cooked"]: 0.45, IDX["pinto_beans_cooked"]: 0.3, IDX["chicken_breast_grilled"]: 0.2}
    with client_com(pesos) as client:
        r = enviar(client, foto())
    assert r.status_code == 200
    body = r.json()
    assert body["modelo"] == "fake-clip"
    res = body["resultado"]
    assert res["isFood"] is True
    nomes = [f["canonicalName"] for f in res["foods"]]
    assert nomes[:3] == ["white_rice_cooked", "pinto_beans_cooked", "chicken_breast_grilled"]
    arroz = res["foods"][0]
    assert arroz["per100g"] == {"calories": 128, "protein": 2.5, "carbs": 28.1, "fat": 0.2, "fiber": 1.6}
    assert arroz["minGrams"] <= arroz["estimatedGrams"] <= arroz["maxGrams"]
    # Porcao vem de tabela: confianca sempre abaixo do limiar de confirmacao do core (0.6).
    assert all(0 <= f["confidence"] < 0.6 for f in res["foods"])
    assert res["mealType"] is None


def test_foto_sem_comida_e_rejeitada_com_motivo():
    teclado = len(ALIMENTOS)  # primeiro rotulo de "nao comida"
    with client_com({teclado: 0.9}) as client:
        r = enviar(client, foto())
    res = r.json()["resultado"]
    assert res["isFood"] is False
    assert res["foods"] == []
    assert "teclado" in res["rejectionReason"]


def test_frito_marca_risco_alto_de_calorias_ocultas():
    with client_com({IDX["french_fries"]: 0.9}) as client:
        res = enviar(client, foto()).json()["resultado"]
    assert res["hiddenCalorieRisk"] == "high"


@pytest.mark.parametrize("token", ["", "errado"])
def test_exige_token_interno(token):
    with client_com({0: 1.0}) as client:
        r = enviar(client, foto(), token=token)
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthorized"


def test_rejeita_arquivo_que_nao_e_imagem():
    with client_com({0: 1.0}) as client:
        r = enviar(client, b"isto nao e uma imagem")
    assert r.status_code == 422
    assert r.json()["error"]["code"] == "unsupported_image"


def test_rejeita_formato_nao_suportado():
    buf = io.BytesIO()
    Image.new("RGB", (64, 64)).save(buf, format="GIF")
    with client_com({0: 1.0}) as client:
        r = enviar(client, buf.getvalue())
    assert r.status_code == 422


def test_rejeita_foto_grande_demais():
    with client_com({0: 1.0}, max_bytes=1000) as client:
        r = enviar(client, foto("PNG"))
    assert r.status_code == 413


def test_aceita_png_e_webp():
    with client_com({IDX["banana_raw"]: 0.9}) as client:
        for fmt in ("PNG", "WEBP"):
            assert enviar(client, foto(fmt)).status_code == 200


def test_qualidade_escura_ou_borrada_e_ruim():
    escura = Image.new("RGB", (256, 256), (10, 10, 10))
    assert avaliar_qualidade(escura).nivel == "poor"
    lisa = Image.new("RGB", (256, 256), (128, 128, 128))  # sem detalhe = sem nitidez
    assert avaliar_qualidade(lisa).nivel == "poor"


def test_health():
    with client_com({0: 1.0}) as client:
        r = client.get("/health")
    assert r.json()["status"] == "ok"


def test_tabela_respeita_faixas_do_contrato():
    """Mesmos limites de nutritionPer100Schema / detectedFoodSchema do core."""
    for a in ALIMENTOS:
        p = a.per100g
        assert 0 <= p["calories"] <= 900, a.canonical_name
        for k in ("protein", "carbs", "fat"):
            assert 0 <= p[k] <= 100, a.canonical_name
        assert 0 <= p["fiber"] <= 80
        assert 1 <= a.min_grams <= a.default_grams <= a.max_grams <= 3000, a.canonical_name
        # Atwater: kcal declaradas proximas de 4P + 4C + 9G (tolerancia larga: fibra, alcool, arredondamento).
        atwater = 4 * p["protein"] + 4 * p["carbs"] + 9 * p["fat"]
        assert abs(atwater - p["calories"]) <= max(25, 0.2 * p["calories"]), a.canonical_name
