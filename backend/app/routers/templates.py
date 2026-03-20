import json
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.models.template import Template
from app.schemas.template import TemplateResponse, TemplateCreate
from app.config import settings

router = APIRouter(prefix="/api/templates", tags=["templates"])


def load_meta_files() -> list[dict]:
    """Load template metadata from .meta.json files on disk."""
    templates_dir = Path(settings.TEMPLATES_DIR)
    metas = []
    if templates_dir.exists():
        for meta_file in templates_dir.glob("*.meta.json"):
            with open(meta_file, "r", encoding="utf-8") as f:
                metas.append(json.load(f))
    return metas


@router.get("/", response_model=list[TemplateResponse])
async def list_templates(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(Template).where(Template.is_active == True)
    if user.role != "admin":
        query = query.where(Template.department == user.department)
    result = await db.execute(query)
    return result.scalars().all()


@router.get("/{slug}", response_model=TemplateResponse)
async def get_template(slug: str, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Template).where(Template.slug == slug))
    tpl = result.scalar_one_or_none()
    if not tpl:
        raise HTTPException(status_code=404, detail="Шаблон не найден")
    if user.role != "admin" and tpl.department != user.department:
        raise HTTPException(status_code=403, detail="Нет доступа к этому шаблону")
    return tpl


@router.get("/meta/{slug}")
async def get_template_meta(slug: str, user: User = Depends(get_current_user)):
    meta_path = Path(settings.TEMPLATES_DIR) / f"{slug}.meta.json"
    if not meta_path.exists():
        raise HTTPException(status_code=404, detail="Метаданные шаблона не найдены")
    with open(meta_path, "r", encoding="utf-8") as f:
        return json.load(f)


@router.post("/", response_model=TemplateResponse, status_code=201)
async def create_template(
    body: TemplateCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role not in ("admin", "manager"):
        raise HTTPException(status_code=403, detail="Недостаточно прав")

    tpl = Template(
        slug=body.slug,
        title=body.title,
        description=body.description,
        department=body.department,
        model_name=body.model_name,
        fields=[f.model_dump() for f in body.fields],
        file_path=body.file_path,
    )
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl
