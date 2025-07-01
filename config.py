# config.py
import os
from datetime import timedelta

class Config:
    # Server Configuration
    IS_MASTER = True  # Set to False for Worker Server B
    SERVER_NAME = "Server A (Master)" if IS_MASTER else "Server B (Worker)"
    
    # Flask Settings
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'video-converter-secret-key-2024'
    DEBUG = False
    HOST = '0.0.0.0'
    PORT = 5000 if IS_MASTER else 5001
    
    # Database Configuration
    DATABASE_PATH = 'video_converter.db'
    SQLALCHEMY_DATABASE_URI = f'sqlite:///{DATABASE_PATH}'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Storage Configuration
    UPLOAD_FOLDER = 'uploads'
    ORIGINAL_FOLDER = os.path.join(UPLOAD_FOLDER, 'original')
    CONVERTED_FOLDER = os.path.join(UPLOAD_FOLDER, 'converted')
    MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500MB max file size
    
    # Cache & Cleanup Settings
    DEFAULT_CACHE_HOURS = 24  # Files expire after 24 hours
    CLEANUP_INTERVAL_MINUTES = 60  # Run cleanup every hour
    
    # Server Communication
    MASTER_SERVER_URL = 'http://localhost:5000'
    WORKER_SERVER_URL = 'http://localhost:5001'
    API_TIMEOUT = 30  # seconds
    
    # FFmpeg Configuration
    FFMPEG_PATH = 'ffmpeg'  # System PATH or full path to ffmpeg
    DEFAULT_QUALITY = 'medium'  # low, medium, high
    
    # Supported Formats
    AUDIO_FORMATS = ['mp3', 'wav', 'mp4']
    VIDEO_FORMATS = ['mp4', 'avi', 'mpeg', 'mov', 'flv', 'webm', 'mkv']
    
    # Admin Configuration
    ADMIN_USERNAME = 'admin'
    ADMIN_PASSWORD = 'converter2024'  # Change in production
    
    # Security
    ALLOWED_EXTENSIONS = AUDIO_FORMATS + VIDEO_FORMATS
    
    @staticmethod
    def init_app(app):
        # Create upload directories if they don't exist
        os.makedirs(Config.ORIGINAL_FOLDER, exist_ok=True)
        os.makedirs(Config.CONVERTED_FOLDER, exist_ok=True)
        
    @staticmethod
    def is_allowed_file(filename):
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS
    
    @staticmethod
    def get_file_type(filename):
        if not filename or '.' not in filename:
            return None
        ext = filename.rsplit('.', 1)[1].lower()
        if ext in Config.AUDIO_FORMATS:
            return 'audio'
        elif ext in Config.VIDEO_FORMATS:
            return 'video'
        return None

# Development/Production Config Classes
class DevelopmentConfig(Config):
    DEBUG = True

class ProductionConfig(Config):
    DEBUG = False
    # Override settings for production
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD') or 'change-me-in-production'

# Config selection
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'default': DevelopmentConfig
}
