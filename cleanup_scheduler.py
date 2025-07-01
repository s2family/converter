# cleanup_scheduler.py
import schedule
import time
import os
import sqlite3
from datetime import datetime
import requests
import logging
from config import Config

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('cleanup.log'),
        logging.StreamHandler()
    ]
)

class CleanupManager:
    def __init__(self):
        self.db_path = Config.DATABASE_PATH
        self.logger = logging.getLogger(__name__)
        
    def get_expired_files(self):
        """Get list of expired files from database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            current_time = datetime.utcnow().isoformat()
            cursor.execute("""
                SELECT id, original_path, converted_path, server_location, original_filename
                FROM conversion_job 
                WHERE expires_at < ? AND status != 'processing'
            """, (current_time,))
            
            expired_files = cursor.fetchall()
            conn.close()
            
            return expired_files
            
        except Exception as e:
            self.logger.error(f"Error getting expired files: {str(e)}")
            return []
    
    def delete_physical_file(self, file_path):
        """Delete physical file from disk"""
        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
                self.logger.info(f"Deleted file: {file_path}")
                return True
        except Exception as e:
            self.logger.error(f"Error deleting file {file_path}: {str(e)}")
        return False
    
    def delete_database_record(self, job_id):
        """Delete job record from database"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute("DELETE FROM conversion_job WHERE id = ?", (job_id,))
            conn.commit()
            conn.close()
            
            self.logger.info(f"Deleted database record: {job_id}")
            return True
            
        except Exception as e:
            self.logger.error(f"Error deleting database record {job_id}: {str(e)}")
            return False
    
    def notify_other_server(self, job_id, server_location):
        """Notify other server to cleanup files"""
        try:
            if Config.IS_MASTER and server_location == 'server_b':
                # Master notifying Worker
                url = f"{Config.WORKER_SERVER_URL}/api/cleanup/{job_id}"
            elif not Config.IS_MASTER and server_location == 'server_a':
                # Worker notifying Master
                url = f"{Config.MASTER_SERVER_URL}/api/cleanup/{job_id}"
            else:
                # Same server, no need to notify
                return True
            
            response = requests.delete(url, timeout=Config.API_TIMEOUT)
            if response.status_code == 200:
                self.logger.info(f"Notified other server for cleanup: {job_id}")
                return True
            else:
                self.logger.warning(f"Failed to notify other server: {response.status_code}")
                
        except requests.exceptions.RequestException as e:
            self.logger.error(f"Error notifying other server: {str(e)}")
        
        return False
    
    def cleanup_expired_files(self):
        """Main cleanup function"""
        self.logger.info("Starting cleanup process...")
        
        expired_files = self.get_expired_files()
        if not expired_files:
            self.logger.info("No expired files found")
            return
        
        cleaned_count = 0
        error_count = 0
        
        for file_info in expired_files:
            job_id, original_path, converted_path, server_location, filename = file_info
            
            try:
                self.logger.info(f"Cleaning up job {job_id}: {filename}")
                
                # Delete physical files
                original_deleted = self.delete_physical_file(original_path)
                converted_deleted = self.delete_physical_file(converted_path)
                
                # Delete database record
                db_deleted = self.delete_database_record(job_id)
                
                # Notify other server if needed
                other_server_notified = self.notify_other_server(job_id, server_location)
                
                if db_deleted:
                    cleaned_count += 1
                    self.logger.info(f"Successfully cleaned up job {job_id}")
                else:
                    error_count += 1
                    
            except Exception as e:
                error_count += 1
                self.logger.error(f"Error cleaning up job {job_id}: {str(e)}")
        
        self.logger.info(f"Cleanup completed. Cleaned: {cleaned_count}, Errors: {error_count}")
    
    def get_storage_stats(self):
        """Get storage statistics"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Get total files and size
            cursor.execute("SELECT COUNT(*), SUM(file_size) FROM conversion_job")
            total_files, total_size = cursor.fetchone()
            
            # Get files by status
            cursor.execute("""
                SELECT status, COUNT(*), SUM(file_size) 
                FROM conversion_job 
                GROUP BY status
            """)
            status_stats = cursor.fetchall()
            
            # Get expired files count
            current_time = datetime.utcnow().isoformat()
            cursor.execute("SELECT COUNT(*) FROM conversion_job WHERE expires_at < ?", (current_time,))
            expired_count = cursor.fetchone()[0]
            
            conn.close()
            
            stats = {
                'total_files': total_files or 0,
                'total_size': total_size or 0,
                'expired_count': expired_count,
                'status_breakdown': dict((status, {'count': count, 'size': size}) 
                                       for status, count, size in status_stats)
            }
            
            self.logger.info(f"Storage stats: {stats}")
            return stats
            
        except Exception as e:
            self.logger.error(f"Error getting storage stats: {str(e)}")
            return {}
    
    def emergency_cleanup(self, max_age_hours=48):
        """Emergency cleanup for very old files"""
        try:
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            # Calculate cutoff time
            cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)
            cutoff_str = cutoff_time.isoformat()
            
            cursor.execute("""
                SELECT id, original_path, converted_path, server_location, original_filename
                FROM conversion_job 
                WHERE created_at < ?
            """, (cutoff_str,))
            
            old_files = cursor.fetchall()
            conn.close()
            
            if old_files:
                self.logger.warning(f"Emergency cleanup: Found {len(old_files)} old files")
                
                for file_info in old_files:
                    job_id, original_path, converted_path, server_location, filename = file_info
                    self.logger.warning(f"Emergency cleanup job {job_id}: {filename}")
                    
                    # Use same cleanup process
                    self.delete_physical_file(original_path)
                    self.delete_physical_file(converted_path)
                    self.delete_database_record(job_id)
                    self.notify_other_server(job_id, server_location)
                    
        except Exception as e:
            self.logger.error(f"Error in emergency cleanup: {str(e)}")

def run_cleanup():
    """Function to run cleanup - called by scheduler"""
    cleanup_manager = CleanupManager()
    cleanup_manager.cleanup_expired_files()

def run_storage_check():
    """Function to log storage statistics"""
    cleanup_manager = CleanupManager()
    cleanup_manager.get_storage_stats()

def run_emergency_cleanup():
    """Function to run emergency cleanup - called weekly"""
    cleanup_manager = CleanupManager()
    cleanup_manager.emergency_cleanup()

if __name__ == "__main__":
    cleanup_manager = CleanupManager()
    
    # Schedule regular cleanup every hour
    schedule.every().hour.do(run_cleanup)
    
    # Schedule storage stats check every 4 hours
    schedule.every(4).hours.do(run_storage_check)
    
    # Schedule emergency cleanup weekly
    schedule.every().sunday.at("02:00").do(run_emergency_cleanup)
    
    # Log startup
    logging.info(f"Cleanup scheduler started on {Config.SERVER_NAME}")
    logging.info(f"Regular cleanup: every {Config.CLEANUP_INTERVAL_MINUTES} minutes")
    logging.info(f"Default cache time: {Config.DEFAULT_CACHE_HOURS} hours")
    
    # Run initial cleanup
    logging.info("Running initial cleanup...")
    run_cleanup()
    run_storage_check()
    
    # Keep running
    try:
        while True:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
    except KeyboardInterrupt:
        logging.info("Cleanup scheduler stopped")
