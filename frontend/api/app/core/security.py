from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.database import get_db
from app.domain.models import Profile

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Profile:
    """
    Decodes the Supabase JWT from the Authorization header,
    verifies it against the Supabase JWT secret, and retrieves/syncs the user Profile.
    """
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        # For development ease, check if using mock jwt secret and a mock token
        if settings.ENVIRONMENT == "development" and token.startswith("mock-token-"):
            # Format: mock-token-role-userid
            parts = token.split("-", 3)
            role = parts[2] if len(parts) > 2 else "user"
            uid = parts[3] if len(parts) > 3 else "mock-user-uuid"
            email = f"{role}@cda.com"
        else:
            # Decode using Supabase JWT Secret
            payload = jwt.decode(
                token, 
                settings.SUPABASE_JWT_SECRET, 
                algorithms=["HS256"], 
                options={"verify_aud": False}
            )
            uid: str = payload.get("sub")
            email: str = payload.get("email")
            role: str = "user"  # default
            
            # Optionally extract role from app_metadata or user_metadata if present
            app_metadata = payload.get("app_metadata", {})
            if "role" in app_metadata:
                role = app_metadata["role"]
            elif "user_metadata" in payload:
                role = payload.get("user_metadata", {}).get("role", "user")

        if uid is None or email is None:
            raise credentials_exception
            
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Token verification failed: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Find or create profile in our db to support sync
    stmt = select(Profile).filter_by(id=uid)
    result = await db.execute(stmt)
    profile = result.scalar_one_or_none()

    if not profile:
        # Auto-create profile in application DB on first access
        profile = Profile(
            id=uid,
            email=email,
            full_name=email.split("@")[0].capitalize(),
            role=role
        )
        db.add(profile)
        await db.commit()
        await db.refresh(profile)

    return profile


class RoleChecker:
    """RBAC Guard middleware for checking allowed roles."""
    def __init__(self, allowed_roles: list[str]):
        self.allowed_roles = allowed_roles

    def __call__(self, current_user: Profile = Depends(get_current_user)) -> Profile:
        if current_user.role not in self.allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Operation not permitted. Required roles: {self.allowed_roles}. Current role: {current_user.role}"
            )
        return current_user

# Predefined guards
require_admin = RoleChecker(["admin"])
require_user = RoleChecker(["user", "admin"])
