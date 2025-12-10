"""
Telegram Bot for Poker Mini App
Opens the poker lobby as a Telegram Mini App
"""

import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import ApplicationBuilder, CommandHandler, CallbackQueryHandler, ContextTypes

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Logging setup
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Configuration
BOT_TOKEN = os.environ.get("TELEGRAM_TOKEN", "")
BOT_USERNAME = os.environ.get("BOT_USERNAME", "pokerhouse77bot")
# Use mobile.html for better compatibility with mobile Telegram WebView
# Cache headers are set in Netlify _headers file to prevent caching
WEBAPP_URL = os.environ.get("WEBAPP_URL", "https://dapper-heliotrope-03aa40.netlify.app/mobile.html")

# Banner image for welcome messages (AI-style poker themed)
# Beautiful AI poker girl image
BANNER_IMAGE_URL = "https://i.postimg.cc/6QWDD5PV/photo-2025-12-09-15-03-53.jpg"


def get_main_keyboard() -> InlineKeyboardMarkup:
    """Build main menu keyboard with Mini App button"""
    keyboard = [
        [
            InlineKeyboardButton(
                "🃏 ИГРАТЬ СЕЙЧАС 🎰", 
                web_app=WebAppInfo(url=WEBAPP_URL)
            )
        ]
    ]
    return InlineKeyboardMarkup(keyboard)


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /start command"""
    user = update.effective_user
    name = user.first_name if user else "Player"
    # Check for deep link (lobby invite)
    args = context.args
    if args and args[0].startswith("lobby_"):
        lobby_code = args[0].replace("lobby_", "")
        # Use mobile.html with lobby parameter
        base_url = WEBAPP_URL.replace("/mobile.html", "")
        lobby_url = f"{base_url}/mobile.html?lobby={lobby_code}"
        
        keyboard = [[
            InlineKeyboardButton(
                "🎯 Присоединиться к игре", 
                web_app=WebAppInfo(url=lobby_url)
            )
        ]]
        
        invite_caption = (
            f"🎰 *POKER HOUSE* — Приглашение в игру!\n\n"
            f"👋 Привет, *{name}*!\n\n"
            f"🃏 Тебя пригласили за *приватный покерный стол*\n\n"
            f"🔑 Код лобби: `{lobby_code}`\n\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "💰 *Реальные ставки • Быстрая игра*\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━"
        )
        
        # Send photo with invite
        await update.message.reply_photo(
            photo=BANNER_IMAGE_URL,
            caption=invite_caption,
            parse_mode="Markdown",
            reply_markup=InlineKeyboardMarkup(keyboard)
        )
        return
    
    # Beautiful welcome banner with image for regular start
    welcome_caption = (
        f"🎰 *POKER HOUSE*\n\n"
        f"👋 Добро пожаловать, *{name}*!\n\n"
        "🃏 *Texas Hold'em Poker* — играй с друзьями\n"
        "прямо в Telegram без регистрации и VPN!"
    )
    
    # Send photo banner with welcome message
    await update.message.reply_photo(
        photo=BANNER_IMAGE_URL,
        caption=welcome_caption,
        parse_mode="Markdown",
        reply_markup=get_main_keyboard()
    )


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle /help command"""
    await update.message.reply_text(
        "🎰 *Poker House Help*\n\n"
        "*Commands:*\n"
        "/start - Open the game\n"
        "/help - Show this message\n\n"
        "*How to Play:*\n"
        "1. Tap 'Play Poker' to open the app\n"
        "2. Create a private lobby or join a public table\n"
        "3. Invite friends via Telegram\n"
        "4. Play Texas Hold'em and win!\n\n"
        "*Game Modes:*\n"
        "🏆 Tournament - Multi-table tournaments\n"
        "🎯 Bounty Hunter - Knockout format\n"
        "⚡ Sit & Go - Quick games",
        parse_mode="Markdown",
        reply_markup=get_main_keyboard()
    )


async def button_callback(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    """Handle button callbacks"""
    query = update.callback_query
    await query.answer()
    
    if query.data == "leaderboard":
        await query.message.reply_text(
            "🏆 *Top Players*\n\n"
            "Coming soon!\n"
            "Play more games to climb the leaderboard.",
            parse_mode="Markdown"
        )
    
    elif query.data == "help":
        await query.message.reply_text(
            "🎰 *Poker House Help*\n\n"
            "Tap 'Play Poker' to open the Mini App and start playing!\n\n"
            "Create private lobbies, invite friends, or join public tournaments.",
            parse_mode="Markdown",
            reply_markup=get_main_keyboard()
        )


def main():
    """Run the bot"""
    if not BOT_TOKEN:
        logger.error("TELEGRAM_TOKEN not set!")
        return
    
    logger.info(f"Starting bot @{BOT_USERNAME}")
    logger.info(f"WebApp URL: {WEBAPP_URL}")
    
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    
    # Register handlers
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    app.add_handler(CallbackQueryHandler(button_callback))
    
    # Run bot
    logger.info("Bot is running...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
