import os
import time
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

# Import the pipeline runner and the configured targets
from main import run_pipeline, targets

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("Scheduler")

def job():
    logger.info("Executing scheduled pipeline run...")
    try:
        run_pipeline(targets)
        logger.info("Scheduled pipeline run completed successfully.")
    except Exception as e:
        logger.error(f"Error during scheduled pipeline run: {e}")

if __name__ == '__main__':
    logger.info("Initializing Brand Sentiment Monitor Scheduler...")
    
    # Optional immediately trigger on startup
    if os.getenv("RUN_ON_STARTUP", "true").lower() == "true":
        logger.info("Executing initial startup run...")
        job()
    
    scheduler = BackgroundScheduler()
    
    # Automatically scrape, analyze logic, save to DB, and send alerts every 6 hours
    scheduler.add_job(
        job,
        trigger=IntervalTrigger(hours=6),
        id='sentiment_pipeline_job',
        name='Run sentiment analysis pipeline',
        replace_existing=True
    )
    
    scheduler.start()
    logger.info("Scheduler started. Next run is in 6 hours. Press Ctrl+C to exit.")
    
    try:
        # Keep the main thread alive to let the background scheduler run
        while True:
            time.sleep(2)
    except (KeyboardInterrupt, SystemExit):
        scheduler.shutdown()
        logger.info("Scheduler shut down safely.")
