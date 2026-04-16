
content = """
@router.post("/groq-key")
async def update_groq_key(
    request: GroqKeyRequest,
    current_user: User = Depends(get_authenticated_user)
):
    \"\"\"Update current user's Groq API key\"\"\"
    success = auth_service.update_groq_key(current_user.id, request.groq_api_key)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update Groq API key")
    return {"message": "Groq API key updated successfully"}

@router.get("/groq-key")
async def get_groq_key(
    current_user: User = Depends(get_authenticated_user)
):
    \"\"\"Get current user's Groq API key (decrypted)\"\"\"
    key = auth_service.get_groq_key(current_user.id)
    if not key:
        raise HTTPException(status_code=404, detail="Groq API key not found")
    return {"groq_api_key": key}
"""

with open("backend/api/routes/auth.py", "a") as f:
    f.write(content)
