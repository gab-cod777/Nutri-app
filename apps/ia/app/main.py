"""Servico de IA do NutriSnap: POST /analisar recebe a foto do prato e devolve os alimentos e macros.

Uso exclusivo da API Node (rede interna + token). Execucao:
    npm run dev:ia   (na raiz do repositorio; ver scripts/ia.mjs)
"""

from __future__ import annotations

import hmac
import io
import time
from contextlib import asynccontextmanager
from typing import Annotated, Any, Callable

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError

from .alimentos import Alimento, carregar_alimentos
from .analise import analisar, rotulos
from .classificador import Classificador, ClipClassificador
from .config import Config, load_config

VERSAO = "visao-clip@1"
FORMATOS = {"JPEG", "PNG", "WEBP"}
# Protecao contra "bomba de descompressao": imagem pequena em bytes, gigante em pixels.
Image.MAX_IMAGE_PIXELS = 40_000_000

ClassificadorFactory = Callable[[Config, list[Alimento]], Classificador]


def _clip_factory(config: Config, alimentos: list[Alimento]) -> Classificador:
    return ClipClassificador(config.model_name, rotulos(alimentos))


def create_app(config: Config | None = None, classificador_factory: ClassificadorFactory = _clip_factory) -> FastAPI:
    estado: dict[str, Any] = {}

    @asynccontextmanager
    async def lifespan(_: FastAPI):
        cfg = config or load_config()
        alimentos = carregar_alimentos(cfg.alimentos_path)
        estado.update(config=cfg, alimentos=alimentos, classificador=classificador_factory(cfg, alimentos))
        yield
        estado.clear()

    app = FastAPI(title="NutriSnap IA", version=VERSAO, lifespan=lifespan, docs_url=None, redoc_url=None)

    def erro(status: int, code: str, message: str) -> HTTPException:
        return HTTPException(status_code=status, detail={"code": code, "message": message})

    @app.exception_handler(HTTPException)
    async def http_error(_, exc: HTTPException):  # type: ignore[no-untyped-def]
        detail = exc.detail if isinstance(exc.detail, dict) else {"code": "error", "message": str(exc.detail)}
        return JSONResponse(status_code=exc.status_code, content={"error": detail})

    @app.get("/health")
    def health() -> dict[str, Any]:
        return {"status": "ok", "modelo": estado["classificador"].nome, "versao": VERSAO}

    @app.post("/analisar")
    def analisar_foto(
        foto: Annotated[UploadFile, File()],
        x_internal_token: Annotated[str, Header()] = "",
        dica: Annotated[str | None, Form(max_length=200)] = None,
    ) -> dict[str, Any]:
        cfg: Config = estado["config"]
        if not hmac.compare_digest(x_internal_token.encode(), cfg.internal_token.encode()):
            raise erro(401, "unauthorized", "Token interno invalido.")

        dados = foto.file.read(cfg.max_image_bytes + 1)
        if len(dados) > cfg.max_image_bytes:
            raise erro(413, "photo_too_large", "Foto maior que o limite.")
        try:
            img = Image.open(io.BytesIO(dados))
            if img.format not in FORMATOS:
                raise erro(422, "unsupported_image", "Formato nao suportado (use JPEG, PNG ou WebP).")
            img.load()
        except (UnidentifiedImageError, Image.DecompressionBombError, OSError):
            raise erro(422, "unsupported_image", "Arquivo nao e uma imagem valida.")

        inicio = time.perf_counter()
        # `dica` (texto do usuario) e aceita pelo contrato, mas o modelo de visao atual nao a usa.
        resultado = analisar(img, estado["alimentos"], estado["classificador"])
        return {
            "resultado": resultado,
            "modelo": estado["classificador"].nome,
            "versao": VERSAO,
            "processamentoMs": int((time.perf_counter() - inicio) * 1000),
        }

    return app


app = create_app()
