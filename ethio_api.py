# ethio_api.py
from fastapi import FastAPI, WebSocket, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator
from typing import List, Dict, Any, Optional, Union
from datetime import datetime, date
from enum import Enum
import json
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os

app = FastAPI(title="Ethiopian Bank Transfer API")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://https://pssbingo.vercel.app/")
client = AsyncIOMotorClient(MONGODB_URL)
db = client.ethio_transfers

# Collections
transfers_collection = db.transfers
accounts_collection = db.accounts
users_collection = db.users

# Enums
class BankType(str, Enum):
    CBE = "cbe"
    AWASH = "awash"
    DASHEN = "dashen"
    ABYSSINIA = "abyssinia"
    NIB = "nib"
    TELEBIRR = "telebirr"
    CBE_BIRR = "cbe_birr"
    HELLO_CASH = "hello_cash"

class TransferStatus(str, Enum):
    PENDING = "pending_verification"
    VERIFIED = "verified"
    FRAUD = "fraud"
    CANCELLED = "cancelled"

# Models
class TransferCreate(BaseModel):
    user_id: int
    user_name: str
    telegram_username: Optional[str]
    bank_name: str
    amount: float
    currency: str = "ETB"
    description: str
    reference: str
    date: str
    status: TransferStatus = TransferStatus.PENDING
    account_number: Optional[str]
    phone_number: Optional[str]
    balance: Optional[float]
    raw_message: Optional[str]
    
    @validator('amount')
    def validate_amount(cls, v):
        if v <= 0:
            raise ValueError("Amount must be positive")
        return v

class AccountCreate(BaseModel):
    user_id: int
    bank_type: BankType
    account_number: str
    account_name: str
    phone_number: Optional[str]
    is_primary: bool = False

class StatsResponse(BaseModel):
    total_transfers: int
    total_amount_etb: float
    verified_amount: float
    pending_count: int
    verified_count: int
    fraud_count: int
    today_transfers: int
    today_amount: float

# WebSocket manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: str):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        if user_id in self.active_connections:
            self.active_connections[user_id].remove(websocket)
    
    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except:
                    pass

manager = ConnectionManager()

# Routes
@app.post("/api/transfers")
async def create_transfer(transfer: TransferCreate):
    """Create new transfer record"""
    transfer_dict = transfer.dict()
    transfer_dict["created_at"] = datetime.now()
    transfer_dict["updated_at"] = datetime.now()
    
    # Check for duplicate reference
    existing = await transfers_collection.find_one({"reference": transfer.reference})
    if existing:
        raise HTTPException(status_code=400, detail="Transfer with this reference already exists")
    
    result = await transfers_collection.insert_one(transfer_dict)
    transfer_id = str(result.inserted_id)
    
    # Send real-time update
    notification = {
        "type": "new_transfer",
        "transfer_id": transfer_id,
        "data": {**transfer_dict, "_id": transfer_id},
        "timestamp": datetime.now().isoformat()
    }
    await manager.send_personal_message(notification, str(transfer.user_id))
    
    return {"message": "Transfer recorded successfully", "id": transfer_id}

@app.get("/api/transfers")
async def get_transfers(
    user_id: int = Query(...),
    status: Optional[TransferStatus] = None,
    bank_name: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 50,
    skip: int = 0
):
    """Get transfers with filters"""
    query = {"user_id": user_id}
    
    if status:
        query["status"] = status
    if bank_name:
        query["bank_name"] = {"$regex": bank_name, "$options": "i"}
    if start_date and end_date:
        query["date"] = {"$gte": start_date, "$lte": end_date}
    
    # Get total count
    total = await transfers_collection.count_documents(query)
    
    # Get transfers
    cursor = transfers_collection.find(query).sort("created_at", -1).skip(skip).limit(limit)
    transfers = []
    async for transfer in cursor:
        transfer["_id"] = str(transfer["_id"])
        transfers.append(transfer)
    
    return {
        "transfers": transfers,
        "total": total,
        "skip": skip,
        "limit": limit
    }

@app.get("/api/transfers/stats/{user_id}")
async def get_transfer_stats(user_id: int):
    """Get comprehensive statistics"""
    today = datetime.now().strftime("%Y-%m-%d")
    
    # Today's transfers
    today_query = {"user_id": user_id, "date": today}
    today_transfers = await transfers_collection.count_documents(today_query)
    
    # Today's amount
    today_amount_cursor = transfers_collection.aggregate([
        {"$match": today_query},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ])
    today_amount = 0
    async for result in today_amount_cursor:
        today_amount = result["total"]
    
    # Status breakdown
    pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": "$status",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"}
        }}
    ]
    
    status_stats = {}
    total_amount = 0
    verified_amount = 0
    
    async for result in transfers_collection.aggregate(pipeline):
        status = result["_id"]
        status_stats[status] = {
            "count": result["count"],
            "total_amount": result["total_amount"]
        }
        total_amount += result["total_amount"]
        if status == "verified":
            verified_amount = result["total_amount"]
    
    # Bank distribution
    bank_pipeline = [
        {"$match": {"user_id": user_id}},
        {"$group": {
            "_id": "$bank_name",
            "count": {"$sum": 1},
            "total_amount": {"$sum": "$amount"}
        }},
        {"$sort": {"total_amount": -1}},
        {"$limit": 5}
    ]
    
    bank_stats = []
    async for result in transfers_collection.aggregate(bank_pipeline):
        bank_stats.append({
            "bank_name": result["_id"],
            "count": result["count"],
            "total_amount": result["total_amount"]
        })
    
    total_transfers = await transfers_collection.count_documents({"user_id": user_id})
    
    return StatsResponse(
        total_transfers=total_transfers,
        total_amount_etb=total_amount,
        verified_amount=verified_amount,
        pending_count=status_stats.get("pending_verification", {}).get("count", 0),
        verified_count=status_stats.get("verified", {}).get("count", 0),
        fraud_count=status_stats.get("fraud", {}).get("count", 0),
        today_transfers=today_transfers,
        today_amount=today_amount
    )

@app.post("/api/accounts")
async def create_account(account: AccountCreate):
    """Add bank/mobile money account"""
    account_dict = account.dict()
    account_dict["created_at"] = datetime.now()
    
    # If setting as primary, update other accounts
    if account.is_primary:
        await accounts_collection.update_many(
            {"user_id": account.user_id},
            {"$set": {"is_primary": False}}
        )
    
    result = await accounts_collection.insert_one(account_dict)
    
    return {"message": "Account added successfully", "id": str(result.inserted_id)}

@app.get("/api/accounts/{user_id}")
async def get_user_accounts(user_id: int):
    """Get user's registered accounts"""
    accounts = []
    async for account in accounts_collection.find({"user_id": user_id}).sort("is_primary", -1):
        account["_id"] = str(account["_id"])
        accounts.append(account)
    
    return accounts

@app.get("/api/telebirr/balance/{phone_number}")
async def get_telebirr_balance(phone_number: str, user_id: int):
    """Simulate Telebirr balance check (for demo)"""
    # In production, this would integrate with Telebirr API
    import random
    return {
        "phone_number": phone_number,
        "balance": random.uniform(100, 10000),
        "currency": "ETB",
        "last_updated": datetime.now().isoformat(),
        "note": "Demo data - Not real balance"
    }

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(websocket, user_id)
    try:
        while True:
            data = await websocket.receive_json()
            if data.get("type") == "ping":
                await websocket.send_json({"type": "pong", "timestamp": datetime.now().isoformat()})
    except Exception:
        manager.disconnect(websocket, user_id)

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "service": "Ethiopian Bank Transfer API",
        "timestamp": datetime.now().isoformat(),
        "database": "connected" if client else "disconnected"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)