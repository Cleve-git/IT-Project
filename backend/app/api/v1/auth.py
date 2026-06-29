from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.core.database import get_db
from app.core.security import get_current_user
from app.domain.models import Profile
from app.api.schemas import ProfileResponse, ProfileCreate

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.get("/me", response_model=ProfileResponse)
async def get_me(current_user: Profile = Depends(get_current_user)):
    """Retrieve the current logged-in user profile with role configuration."""
    return current_user

@router.post("/sync", response_model=ProfileResponse)
async def sync_profile(profile_data: ProfileCreate, db: AsyncSession = Depends(get_db)):
    """
    Synchronizes user attributes from Supabase Auth into our PostgreSQL profiles table.
    Defaults role to 'user' if not existing, or 'admin' for seed-level accounts.
    """
    stmt = select(Profile).filter_by(id=profile_data.id)
    result = await db.execute(stmt)
    existing_profile = result.scalar_one_or_none()

    if existing_profile:
        # Update email if changed
        existing_profile.email = profile_data.email
        if profile_data.full_name:
            existing_profile.full_name = profile_data.full_name
        await db.commit()
        await db.refresh(existing_profile)
        return existing_profile

    # New profile creation
    role = "user"
    # Auto-escalate the first seed user or specific emails to admin for convenience
    if profile_data.email.endswith("admin@cda.com"):
        role = "admin"

    new_profile = Profile(
        id=profile_data.id,
        email=profile_data.email,
        full_name=profile_data.full_name or profile_data.email.split("@")[0].capitalize(),
        role=role
    )
    db.add(new_profile)
    await db.commit()
    await db.refresh(new_profile)
    return new_profile
