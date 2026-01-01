# ethio_bot.py
import os
import re
import json
import logging
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
import asyncio
from decimal import Decimal

from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters,
    ContextTypes
)
from telegram.constants import ParseMode
import aiohttp

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Ethiopian Bank Patterns
ETHIOPIAN_BANK_PATTERNS = {
    'cbe': {
        'name': 'Commercial Bank of Ethiopia',
        'patterns': [
            r'CBE.*?Account:\s*(\d+).*?Amount:\s*ETB\s*([\d,]+\.?\d*).*?Balance:\s*ETB\s*([\d,]+\.?\d*)',
            r'Commercial Bank.*?Acct:\s*(\d+).*?Amt:\s*ETB\s*([\d,]+\.?\d*).*?Bal:\s*ETB\s*([\d,]+\.?\d*)',
            r'Dear Customer.*?(\d+)\.\s*ETB\s*([\d,]+\.?\d*)\s*credited.*?from\s*(.+?)\.\s*Avail',
            r'You have received ETB\s*([\d,]+\.?\d*).*?from\s*(.+?)\.\s*Acc\.\s*(\d+)'
        ],
        'keywords': ['CBE', 'Commercial Bank']
    },
    'awash': {
        'name': 'Awash Bank',
        'patterns': [
            r'Awash Bank.*?Account:\s*(\d+).*?Amount:\s*ETB\s*([\d,]+\.?\d*).*?Balance:\s*ETB\s*([\d,]+\.?\d*)',
            r'AWASH.*?Acct:\s*(\d+).*?ETB\s*([\d,]+\.?\d*)\s*credited.*?Ref:\s*(\w+)'
        ],
        'keywords': ['Awash', 'AWASH']
    },
    'dashen': {
        'name': 'Dashen Bank',
        'patterns': [
            r'Dashen Bank.*?Account:\s*(\d+).*?Amount:\s*ETB\s*([\d,]+\.?\d*).*?Balance:\s*ETB\s*([\d,]+\.?\d*)',
            r'DASHEN.*?Acct\s*(\d+).*?Amt\s*ETB\s*([\d,]+\.?\d*).*?From\s*(.+?)\.'
        ],
        'keywords': ['Dashen', 'DASHEN']
    },
    'abyssinia': {
        'name': 'Bank of Abyssinia',
        'patterns': [
            r'Bank of Abyssinia.*?Account:\s*(\d+).*?Amount:\s*ETB\s*([\d,]+\.?\d*).*?Balance:\s*ETB\s*([\d,]+\.?\d*)',
            r'ABYSSINIA.*?Acct:\s*(\d+).*?ETB\s*([\d,]+\.?\d*)\s*received.*?Ref:\s*(\w+)'
        ],
        'keywords': ['Abyssinia', 'ABYSSINIA']
    },
    'nib': {
        'name': 'NIB International Bank',
        'patterns': [
            r'NIB.*?Account:\s*(\d+).*?Amount:\s*ETB\s*([\d,]+\.?\d*).*?Balance:\s*ETB\s*([\d,]+\.?\d*)',
            r'NIB.*?Acct:\s*(\d+).*?ETB\s*([\d,]+\.?\d*)\s*credited'
        ],
        'keywords': ['NIB']
    },
    'telebirr': {
        'name': 'Telebirr',
        'patterns': [
            r'Telebirr.*?(\+251\d{9}).*?ETB\s*([\d,]+\.?\d*).*?from\s*(.+?)\.',
            r'Telebirr.*?received\s*ETB\s*([\d,]+\.?\d*).*?from\s*(\+251\d{9}).*?Transaction\s*ID:\s*(\w+)',
            r'Dear Customer.*?(\+251\d{9}).*?ETB\s*([\d,]+\.?\d*)\s*received.*?from\s*(.+?)\.',
            r'You have received ETB\s*([\d,]+\.?\d*)\s*from\s*(\+251\d{9}).*?New balance:\s*ETB\s*([\d,]+\.?\d*)'
        ],
        'keywords': ['Telebirr', 'telebirr']
    },
    'cbe_birr': {
        'name': 'CBE Birr',
        'patterns': [
            r'CBE Birr.*?(\+251\d{9}).*?ETB\s*([\d,]+\.?\d*).*?from\s*(.+?)\.',
            r'CBE Birr.*?received\s*ETB\s*([\d,]+\.?\d*).*?from\s*(\+251\d{9})'
        ],
        'keywords': ['CBE Birr', 'CBE birr']
    },
    'hello_cash': {
        'name': 'HelloCash',
        'patterns': [
            r'HelloCash.*?(\+251\d{9}).*?ETB\s*([\d,]+\.?\d*).*?from\s*(.+?)\.',
            r'HelloCash.*?You have received ETB\s*([\d,]+\.?\d*).*?from\s*(\+251\d{9})'
        ],
        'keywords': ['HelloCash', 'Hellocash']
    }
}

class EthioBankTransferBot:
    def __init__(self, token: str, web_app_url: str, api_endpoint: str):
        self.token = token
        self.web_app_url = web_app_url
        self.api_endpoint = api_endpoint
        self.application = Application.builder().token(token).build()
        
        self.setup_handlers()
    
    def setup_handlers(self):
        """Setup all bot handlers"""
        self.application.add_handler(CommandHandler("start", self.start_command))
        self.application.add_handler(CommandHandler("help", self.help_command))
        self.application.add_handler(CommandHandler("dashboard", self.dashboard_command))
        self.application.add_handler(CommandHandler("add_account", self.add_account_command))
        self.application.add_handler(CommandHandler("accounts", self.list_accounts_command))
        self.application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, self.handle_message))
        self.application.add_handler(MessageHandler(filters.FORWARDED, self.handle_forwarded_message))
        self.application.add_handler(CallbackQueryHandler(self.button_callback))
    
    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Send welcome message when /start is issued"""
        user = update.effective_user
        welcome_message = (
            f"ሰላም *{user.first_name}*! 👋\n\n"
            "የባንክ ትራንስፈር ቼከር ቦት እንኳን በደህና መጡ! 🏦\n\n"
            "📋 *እንዴት መጠቀም እንደሚቻል:*\n"
            "1. የባንክ ወይም ቴሌብር ማሳወቂያ መልዕክት ወደዚህ ቦት ይመልሱ\n"
            "2. ቦት የትራንስፈር ዝርዝሮችን በራስ-ሰር ያወጣል\n"
            "3. በሚኒ አፕ ዳሽቦርድ ውስጥ በቀጥታ ማሳየት ያያሉ\n\n"
            "📱 *ትዕዛዞች:*\n"
            "/dashboard - ዳሽቦርድ ክፈት\n"
            "/add_account - የባንክ አካውንት ጨምር\n"
            "/accounts - የአካውንቶች ዝርዝር\n"
            "/help - እርዳታ\n\n"
            "✅ *የሚደገፉ ባንኮች:*\n"
            "🏦 CBE, Awash, Dashen, Abyssinia, NIB\n"
            "📱 Telebirr, CBE Birr, HelloCash"
        )
        
        keyboard = [
            [
                InlineKeyboardButton("📊 ዳሽቦርድ ክፈት", web_app={'url': self.web_app_url}),
                InlineKeyboardButton("📤 መልዕክት ላክ", callback_data='forward_help')
            ],
            [
                InlineKeyboardButton("🏦 አካውንት ጨምር", callback_data='add_account'),
                InlineKeyboardButton("❓ እርዳታ", callback_data='help')
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            welcome_message,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=reply_markup
        )
    
    async def handle_forwarded_message(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Process forwarded Ethiopian bank and telebirr notifications"""
        user = update.effective_user
        message = update.message
        
        if not message.text:
            await update.message.reply_text(
                "❌ እባክዎ ምስል ወይም ሰነድ ሳይሆን የጽሁፍ መልዕክት ይላኩ።"
            )
            return
        
        # Clean and normalize Amharic text
        cleaned_text = self.clean_amharic_text(message.text)
        
        # Extract transfer details
        transfer_data = self.parse_ethiopian_bank_message(cleaned_text)
        
        if not transfer_data:
            # Try to parse as generic Ethiopian bank message
            transfer_data = self.parse_generic_ethiopian_message(cleaned_text)
        
        if not transfer_data:
            await update.message.reply_text(
                "❌ የባንክ ትራንስፈር ዝርዝሮችን መወሰድ አልተቻለም። እባክዎ የሚከተሉትን ያረጋግጡ:\n"
                "1. የባንክ ወይም ቴሌብር እውነተኛ ማሳወቂያ መልዕክት ነው የላኩት\n"
                "2. መልዕክቱ መጠን እና የአካውንት ዝርዝሮችን ይዟል\n"
                "3. ለሚደገፉ ባንኮች /help ይመልከቱ"
            )
            return
        
        # Add metadata
        transfer_data.update({
            'user_id': user.id,
            'user_name': user.full_name,
            'telegram_username': user.username,
            'message_id': message.message_id,
            'timestamp': datetime.now().isoformat(),
            'status': 'pending_verification',
            'currency': 'ETB'
        })
        
        # Save to database
        await self.save_transfer_record(transfer_data)
        
        # Prepare response in Amharic and English
        response_message = (
            "✅ *የትራንስፈር ዝርዝሮች ተወስደዋል*\n\n"
            f"🏦 *ባንክ:* {transfer_data['bank_name']}\n"
            f"💰 *መጠን:* ETB {transfer_data['amount']:,.2f}\n"
        )
        
        if transfer_data.get('account_number'):
            response_message += f"📝 *የአካውንት ቁጥር:* {transfer_data['account_number']}\n"
        elif transfer_data.get('phone_number'):
            response_message += f"📱 *ስልክ ቁጥር:* {transfer_data['phone_number']}\n"
        
        response_message += (
            f"📄 *መግለጫ:* {transfer_data['description']}\n"
            f"📅 *ቀን:* {transfer_data['date']}\n"
            f"🆔 *ማጣቀሻ:* {transfer_data['reference']}\n\n"
            "📊 *በዳሽቦርድ ውስጥ ይመልከቱ:* /dashboard\n"
            "ሁኔታ: ⏳ ማረጋገጫ በመጠባበቅ ላይ"
        )
        
        keyboard = [
            [
                InlineKeyboardButton("✅ አረጋግጥ", callback_data=f"verify_{transfer_data['reference']}"),
                InlineKeyboardButton("❌ አላግባት ምልክት አድርግ", callback_data=f"fraud_{transfer_data['reference']}")
            ],
            [
                InlineKeyboardButton("📊 ዳሽቦርድ ክፈት", web_app={'url': self.web_app_url}),
                InlineKeyboardButton("🏦 አካውንት ጨምር", callback_data='add_account')
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            response_message,
            parse_mode=ParseMode.MARKDOWN,
            reply_markup=reply_markup
        )
    
    def clean_amharic_text(self, text: str) -> str:
        """Clean and normalize Amharic text"""
        # Remove extra spaces and newlines
        text = ' '.join(text.split())
        
        # Normalize Ethiopian currency notations
        text = text.replace('ብር', 'ETB')
        text = text.replace('ብር.', 'ETB')
        text = text.replace(' ብር', ' ETB')
        
        return text
    
    def parse_ethiopian_bank_message(self, text: str) -> Optional[Dict[str, Any]]:
        """Extract transfer details from Ethiopian bank messages"""
        text = text.replace('\n', ' ').strip()
        
        for bank_key, config in ETHIOPIAN_BANK_PATTERNS.items():
            # Check if any keyword exists
            if any(keyword.lower() in text.lower() for keyword in config['keywords']):
                for pattern in config['patterns']:
                    match = re.search(pattern, text, re.IGNORECASE)
                    if match:
                        return self.extract_details_from_match(match, config['name'], text, bank_key)
        
        return None
    
    def parse_generic_ethiopian_message(self, text: str) -> Optional[Dict[str, Any]]:
        """Parse generic Ethiopian transfer messages"""
        # Generic patterns for Ethiopian transfers
        generic_patterns = [
            # Pattern 1: Amount from account
            r'ETB\s*([\d,]+\.?\d*).*?from.*?(\d{13,}).*?on\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})',
            # Pattern 2: Received amount from phone
            r'received\s*ETB\s*([\d,]+\.?\d*).*?from\s*(\+251\d{9})',
            # Pattern 3: Amount credited to account
            r'Account\s*(\d+).*?credited.*?ETB\s*([\d,]+\.?\d*)',
            # Pattern 4: Simple amount pattern
            r'ETB\s*([\d,]+\.?\d*).*?(?:credited|received|transferred)'
        ]
        
        for pattern in generic_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                result = {
                    'bank_name': 'Unknown Ethiopian Bank',
                    'amount': float(match.group(1).replace(',', '')),
                    'description': 'Transfer',
                    'reference': f"ETB{datetime.now().strftime('%Y%m%d%H%M%S')}",
                    'date': datetime.now().strftime('%Y-%m-%d'),
                    'raw_message': text
                }
                
                # Try to extract account or phone number
                if len(match.groups()) >= 2 and match.group(2):
                    if match.group(2).startswith('+251') or len(match.group(2)) == 10:
                        result['phone_number'] = match.group(2)
                    else:
                        result['account_number'] = match.group(2)
                
                # Try to extract date
                date_match = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', text)
                if date_match:
                    result['date'] = date_match.group(1)
                
                return result
        
        return None
    
    def extract_details_from_match(self, match, bank_name: str, text: str, bank_key: str) -> Dict[str, Any]:
        """Extract details from regex match"""
        result = {
            'bank_name': bank_name,
            'raw_message': text,
            'source': 'telegram_forward'
        }
        
        # Extract amount (always try to find ETB amount)
        amount_match = re.search(r'ETB\s*([\d,]+\.?\d*)', text)
        if amount_match:
            result['amount'] = float(amount_match.group(1).replace(',', ''))
        
        # Extract account number (for banks)
        if bank_key != 'telebirr' and bank_key != 'cbe_birr' and bank_key != 'hello_cash':
            acct_match = re.search(r'Account[:\s]*(\d{13,})|Acct[:\s]*(\d{13,})', text)
            if acct_match:
                result['account_number'] = acct_match.group(1) or acct_match.group(2)
        
        # Extract phone number (for mobile money)
        if bank_key in ['telebirr', 'cbe_birr', 'hello_cash']:
            phone_match = re.search(r'(\+251\d{9})|(09\d{8})', text)
            if phone_match:
                result['phone_number'] = phone_match.group(1) or phone_match.group(2)
        
        # Extract reference number
        ref_match = re.search(r'Ref[:\s]*(\w+)|Reference[:\s]*(\w+)|Transaction\s*ID[:\s]*(\w+)', text)
        if ref_match:
            result['reference'] = ref_match.group(1) or ref_match.group(2) or ref_match.group(3)
        else:
            result['reference'] = f"ET{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Extract date
        date_match = re.search(r'(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})', text)
        if date_match:
            result['date'] = date_match.group(1)
        else:
            result['date'] = datetime.now().strftime('%Y-%m-%d')
        
        # Extract description/sender
        if bank_key == 'telebirr':
            sender_match = re.search(r'from\s*(.+?)(?:\.|\s+Transaction|\s+New)', text)
            if sender_match:
                result['description'] = f"From {sender_match.group(1).strip()}"
            else:
                result['description'] = 'Telebirr Transfer'
        else:
            desc_match = re.search(r'from\s*(.+?)(?:\.|\s+Avail|\s+Bal)', text)
            if desc_match:
                result['description'] = f"From {desc_match.group(1).strip()}"
            else:
                result['description'] = 'Bank Transfer'
        
        # Extract balance if available
        balance_match = re.search(r'Balance[:\s]*ETB\s*([\d,]+\.?\d*)|Bal[:\s]*ETB\s*([\d,]+\.?\d*)', text)
        if balance_match:
            result['balance'] = float((balance_match.group(1) or balance_match.group(2)).replace(',', ''))
        
        return result
    
    async def save_transfer_record(self, transfer_data: Dict[str, Any]):
        """Save transfer record to database"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.api_endpoint}/api/transfers",
                    json=transfer_data,
                    headers={'Content-Type': 'application/json'}
                ) as response:
                    if response.status == 200:
                        logger.info(f"Transfer saved: {transfer_data['reference']}")
                        await self.notify_mini_app(transfer_data)
                    else:
                        logger.error(f"Failed to save transfer: {response.status}")
        except Exception as e:
            logger.error(f"Error saving transfer: {e}")
    
    async def notify_mini_app(self, transfer_data: Dict[str, Any]):
        """Send real-time update to Mini App"""
        # Implement WebSocket notification
        pass
    
    async def add_account_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Add bank account to user's profile"""
        keyboard = [
            [
                InlineKeyboardButton("🏦 CBE", callback_data="add_cbe"),
                InlineKeyboardButton("🏦 Awash", callback_data="add_awash")
            ],
            [
                InlineKeyboardButton("🏦 Dashen", callback_data="add_dashen"),
                InlineKeyboardButton("🏦 Abyssinia", callback_data="add_abyssinia")
            ],
            [
                InlineKeyboardButton("📱 Telebirr", callback_data="add_telebirr"),
                InlineKeyboardButton("📱 CBE Birr", callback_data="add_cbe_birr")
            ],
            [
                InlineKeyboardButton("❌ ይቅር", callback_data="cancel")
            ]
        ]
        reply_markup = InlineKeyboardMarkup(keyboard)
        
        await update.message.reply_text(
            "የትኛውን የባንክ አካውንት መጨመር ይፈልጋሉ?",
            reply_markup=reply_markup
        )
    
    async def list_accounts_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """List user's registered accounts"""
        user_id = update.effective_user.id
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(
                    f"{self.api_endpoint}/api/accounts/{user_id}"
                ) as response:
                    if response.status == 200:
                        accounts = await response.json()
                        
                        if not accounts:
                            await update.message.reply_text("📭 እስካሁን ምንም አካውንት አልጨመርክም። /add_account በመጠቀም አካውንት ይጨምሩ።")
                            return
                        
                        accounts_text = "📋 *የአካውንቶችዎ ዝርዝር:*\n\n"
                        for account in accounts:
                            accounts_text += (
                                f"🏦 *{account['bank_name']}*\n"
                                f"🔢 *አካውንት:* {account['account_number']}\n"
                                f"📛 *ስም:* {account.get('account_name', 'N/A')}\n"
                                f"📅 *ቀን:* {account.get('added_date', 'N/A')}\n"
                                f"────────────\n"
                            )
                        
                        await update.message.reply_text(
                            accounts_text,
                            parse_mode=ParseMode.MARKDOWN
                        )
        except Exception as e:
            logger.error(f"Error listing accounts: {e}")
            await update.message.reply_text("❌ አካውንቶችን ለማሳየት ስህተት ተፈጥሯል።")
    
    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Send help message in Amharic"""
        help_text = (
            "📋 *የኢትዮጵያ ባንክ ትራንስፈር ቼከር ቦት እርዳታ*\n\n"
            "🏦 *የሚደገፉ ባንኮች:*\n"
            "• Commercial Bank of Ethiopia (CBE)\n"
            "• Awash Bank\n"
            "• Dashen Bank\n"
            "• Bank of Abyssinia\n"
            "• NIB International Bank\n"
            "• Telebirr (የሞባይል ገንዘብ)\n"
            "• CBE Birr\n"
            "• HelloCash\n\n"
            "📱 *እንዴት መጠቀም እንደሚቻል:*\n"
            "1. የባንክ ወይም ቴሌብር ስልክ ማሳወቂያ ወደዚህ ቦት ይመልሱ\n"
            "2. ቦት የትራንስፈር ዝርዝሮችን በራስ-ሰር ያወጣል\n"
            "3. በሚኒ አፕ ዳሽቦርድ ውስጥ በቀጥታ ያዩታል\n\n"
            "📋 *የአገልግሎት ምሳሌ:*\n"
            "```\n"
            "Dear Customer, \n"
            "Account: 1000123456789 \n"
            "Amount: ETB 5,000.00 credited \n"
            "From: JOHN DOE \n"
            "Balance: ETB 25,000.00 \n"
            "Date: 12/12/2023 \n"
            "- CBE\n"
            "```\n\n"
            "⚠️ *ማስታወሻ:* የባንክ ፓስዎርድ አያጋሩም! እውነተኛ የባንክ ማሳወቂያ ብቻ ይላኩ።"
        )
        
        await update.message.reply_text(
            help_text,
            parse_mode=ParseMode.MARKDOWN
        )
    
    async def button_callback(self, update: Update, context: ContextTypes.DEFAULT_TYPE):
        """Handle button callbacks"""
        query = update.callback_query
        await query.answer()
        
        data = query.data
        
        if data.startswith('verify_'):
            ref = data.replace('verify_', '')
            await self.update_transfer_status(ref, 'verified')
            await query.edit_message_text(
                f"✅ ትራንስፈር {ref} እንደተጠበቀ ምልክት ተደርጎበታል",
                reply_markup=None
            )
        
        elif data.startswith('fraud_'):
            ref = data.replace('fraud_', '')
            await self.update_transfer_status(ref, 'fraud')
            await query.edit_message_text(
                f"🚨 ትራንስፈር {ref} እንደ አላግባት ምልክት ተደርጎበታል",
                reply_markup=None
            )
        
        elif data.startswith('add_'):
            bank_type = data.replace('add_', '')
            await self.handle_add_account(query, bank_type)
    
    async def handle_add_account(self, query, bank_type: str):
        """Handle adding new account"""
        bank_names = {
            'cbe': 'Commercial Bank of Ethiopia',
            'awash': 'Awash Bank',
            'dashen': 'Dashen Bank',
            'abyssinia': 'Bank of Abyssinia',
            'telebirr': 'Telebirr',
            'cbe_birr': 'CBE Birr'
        }
        
        bank_name = bank_names.get(bank_type, bank_type)
        
        await query.edit_message_text(
            f"🏦 {bank_name}\n\n"
            f"እባክዎ የ{bank_name} አካውንት ቁጥርዎን ይላኩ።\n"
            f"ቅጽ: 13 አሃዝ ቁጥር (ለባንክ) ወይም ስልክ ቁጥር (ለሞባይል ገንዘብ)",
            reply_markup=None
        )
    
    async def update_transfer_status(self, reference: str, status: str):
        """Update transfer status in database"""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.patch(
                    f"{self.api_endpoint}/api/transfers/{reference}",
                    json={'status': status}
                ) as response:
                    if response.status == 200:
                        logger.info(f"Updated {reference} to {status}")
        except Exception as e:
            logger.error(f"Error updating status: {e}")
    
    def run(self):
        """Run the bot"""
        self.application.run_polling(allowed_updates=Update.ALL_TYPES)

# Configuration
BOT_TOKEN = os.getenv('ETHIO_BOT_TOKEN', '8582008450:AAG9lWeH4aN2aKnvbMMgtq7f3b9CZKnK2Ok')
WEB_APP_URL = os.getenv('WEB_APP_URL', 'https://pssbingo.vercel.app/')
API_ENDPOINT = os.getenv('API_ENDPOINT', 'https://pssbingo.vercel.app/')

if __name__ == '__main__':
    bot = EthioBankTransferBot(BOT_TOKEN, WEB_APP_URL, API_ENDPOINT)
    bot.run()