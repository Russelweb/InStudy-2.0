"""
API routes for saved assets (flashcards, quizzes, summaries, study plans)
"""

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from api.routes.auth import get_authenticated_user
from models.auth_models import User
from database.assets_db import assets_db
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

class SaveAssetRequest(BaseModel):
    course_id: str
    asset_type: str  # 'flashcards', 'quiz', 'summary', 'study_plan'
    title: str
    data: Dict[str, Any]
    metadata: Optional[Dict[str, Any]] = None

class UpdateAssetRequest(BaseModel):
    title: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    metadata: Optional[Dict[str, Any]] = None

@router.post("/save")
async def save_asset(
    request: SaveAssetRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Save a new asset"""
    try:
        user_id = str(current_user.id)
        
        asset_id = assets_db.save_asset(
            user_id=user_id,
            course_id=request.course_id,
            asset_type=request.asset_type,
            title=request.title,
            data=request.data,
            metadata=request.metadata
        )
        
        return {
            "success": True,
            "asset_id": asset_id,
            "message": "Asset saved successfully"
        }
    except Exception as e:
        logger.error(f"Error saving asset: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/list")
async def list_assets(
    asset_type: Optional[str] = None,
    course_id: Optional[str] = None,
    current_user: User = Depends(get_authenticated_user)
):
    """List all saved assets for the current user"""
    try:
        user_id = str(current_user.id)
        assets = assets_db.list_assets(user_id, asset_type, course_id)
        
        return {
            "success": True,
            "assets": assets,
            "count": len(assets)
        }
    except Exception as e:
        logger.error(f"Error listing assets: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/get/{asset_id}")
async def get_asset(
    asset_id: int,
    current_user: User = Depends(get_authenticated_user)
):
    """Get a specific saved asset"""
    try:
        user_id = str(current_user.id)
        asset = assets_db.get_asset(asset_id, user_id)
        
        if not asset:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        return {
            "success": True,
            "asset": asset
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting asset: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/update/{asset_id}")
async def update_asset(
    asset_id: int,
    request: UpdateAssetRequest,
    current_user: User = Depends(get_authenticated_user)
):
    """Update an existing asset"""
    try:
        user_id = str(current_user.id)
        
        success = assets_db.update_asset(
            asset_id=asset_id,
            user_id=user_id,
            title=request.title,
            data=request.data,
            metadata=request.metadata
        )
        
        if not success:
            raise HTTPException(status_code=404, detail="Asset not found or update failed")
        
        return {
            "success": True,
            "message": "Asset updated successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating asset: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/delete/{asset_id}")
async def delete_asset(
    asset_id: int,
    current_user: User = Depends(get_authenticated_user)
):
    """Delete a saved asset"""
    try:
        user_id = str(current_user.id)
        
        success = assets_db.delete_asset(asset_id, user_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Asset not found")
        
        return {
            "success": True,
            "message": "Asset deleted successfully"
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting asset: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/stats")
async def get_asset_stats(
    current_user: User = Depends(get_authenticated_user)
):
    """Get asset statistics for the current user"""
    try:
        user_id = str(current_user.id)
        stats = assets_db.get_stats(user_id)
        
        return {
            "success": True,
            "stats": stats
        }
    except Exception as e:
        logger.error(f"Error getting asset stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))
