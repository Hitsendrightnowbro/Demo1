import os
from dotenv import load_dotenv
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update
from telegram.ext import Application, CommandHandler, ContextTypes
from pytz import timezone

load_dotenv()
BOT_TOKEN = os.getenv('VITE_TELEGRAM_BOT_TOKEN')
MINI_APP_URL = os.getenv('MINI_APP_URL')
COMMUNITY_URL = os.getenv('COMMUNITY_URL')

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    keyboard = [
        [
            InlineKeyboardButton("Claim 🎉", web_app={'url': MINI_APP_URL})
        ],
        [
            InlineKeyboardButton("Join Community 👥", url=COMMUNITY_URL)
        ]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)


    with open('banner.jpg', 'rb') as photo:
        await update.message.reply_photo(
            photo=photo,
            caption="Hey!!👋 Welcome to the SOLANA Roulette bot!\n\nIt's time to spin the wheel and try your luck to win between 0.1 and 10 SOL or USDC 250\n\nEvery user gets one free spin 🌀\n\nLet's get started! Click the SPIN! button below to claim your free spin 👇\n\nGood luck 💪\nYou've got this! 👏",
            reply_markup=reply_markup
        )

def main() -> None:
    application = Application.builder().token(BOT_TOKEN).build()
    application.job_queue.scheduler.configure(timezone=timezone('UTC'))

    application.add_handler(CommandHandler("start", start))

    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()