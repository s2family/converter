# server.py - Simple Video Converter System
from flask import Flask, request, jsonify, send_file, session, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from werkzeug.utils import secure_filename
import os
import uuid
import subprocess
import threading
import time
from datetime import datetime, timedelta

# =============================================================================
# CONFIGURATION
# =============================================================================
class Config:
    SECRET_KEY = 'video-converter-secret-key-2024'
    DEBUG = True
    
    # Database
    SQLALCHEMY_DATABASE_URI = 'sqlite:///video_converter.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    # Storage
    UPLOAD_FOLDER = 'uploads'
    ORIGINAL_FOLDER = os.path.join(UPLOAD_FOLDER, 'original')
    CONVERTED_FOLDER = os.path.join(UPLOAD_FOLDER, 'converted')
    MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500MB
    
    # Formats
    AUDIO_FORMATS = ['mp3', 'wav', 'mp4']
    VIDEO_FORMATS = ['mp4', 'avi', 'mpeg', 'mov', 'flv', 'webm', 'mkv']
    ALLOWED_EXTENSIONS = AUDIO_FORMATS + VIDEO_FORMATS
    
    # Admin
    ADMIN_USERNAME = 'admin'
    ADMIN_PASSWORD = 'admin'
    
    # Cache
    DEFAULT_CACHE_HOURS = 24

# =============================================================================
# INITIALIZE FLASK
# =============================================================================
app = Flask(__name__)
app.config.from_object(Config)

# Create directories
os.makedirs(Config.ORIGINAL_FOLDER, exist_ok=True)
os.makedirs(Config.CONVERTED_FOLDER, exist_ok=True)

# Initialize database
db = SQLAlchemy(app)

# =============================================================================
# DATABASE MODEL
# =============================================================================
class ConversionJob(db.Model):
    id = db.Column(db.String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    original_filename = db.Column(db.String(255), nullable=False)
    original_format = db.Column(db.String(10), nullable=False)
    target_format = db.Column(db.String(10), nullable=False)
    file_type = db.Column(db.String(10), nullable=False)
    status = db.Column(db.String(20), default='pending')
    progress = db.Column(db.Integer, default=0)
    server_location = db.Column(db.String(20), default='server_a')  # ← SỬA: THÊM DEFAULT VALUE
    original_path = db.Column(db.String(500))
    converted_path = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)
    file_size = db.Column(db.Integer, default=0)
    error_message = db.Column(db.Text)

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================
def is_allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS

def get_file_type(filename):
    if not filename or '.' not in filename:
        return None
    ext = filename.rsplit('.', 1)[1].lower()
    if ext in Config.AUDIO_FORMATS:
        return 'audio'
    elif ext in Config.VIDEO_FORMATS:
        return 'video'
    return None

def convert_file_ffmpeg(input_path, output_path, target_format):
    """Simple FFmpeg conversion"""
    try:
        cmd = ['ffmpeg', '-i', input_path, '-y', output_path]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
        return result.returncode == 0, result.stderr
    except subprocess.TimeoutExpired:
        return False, "Conversion timeout"
    except FileNotFoundError:
        return False, "FFmpeg not found"
    except Exception as e:
        return False, str(e)

def start_conversion(job_id):
    """Background conversion process"""
    with app.app_context():
        try:
            job = ConversionJob.query.get(job_id)
            if not job:
                return
            
            # Update to processing
            job.status = 'processing'
            job.progress = 10
            db.session.commit()
            
            # Generate output path
            output_filename = f"{job_id}_converted.{job.target_format}"
            output_path = os.path.join(Config.CONVERTED_FOLDER, output_filename)
            
            # Convert file
            job.progress = 50
            db.session.commit()
            
            success, error = convert_file_ffmpeg(job.original_path, output_path, job.target_format)
            
            # Update final status
            if success and os.path.exists(output_path):
                job.status = 'completed'
                job.progress = 100
                job.converted_path = output_path
                job.error_message = None
            else:
                job.status = 'failed'
                job.error_message = error or 'Conversion failed'
            
            db.session.commit()
            
        except Exception as e:
            job = ConversionJob.query.get(job_id)
            if job:
                job.status = 'failed'
                job.error_message = str(e)
                db.session.commit()

# =============================================================================
# ROUTES
# =============================================================================

@app.route('/')
def index():
    """Homepage"""
    return """
    <!DOCTYPE html>
    <html>
    <head>
        <title>Video Converter</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                max-width: 800px; 
                margin: 0 auto; 
                padding: 20px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
                color: #333;
            }
            .container {
                background: white;
                border-radius: 20px;
                padding: 40px;
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            }
            .header { text-align: center; margin-bottom: 30px; }
            .header h1 { color: #667eea; margin-bottom: 10px; }
            .upload-form { 
                border: 2px dashed #667eea; 
                padding: 40px; 
                text-align: center; 
                margin: 20px 0; 
                border-radius: 15px;
                background: #f8f9ff;
            }
            .btn { 
                background: linear-gradient(45deg, #667eea, #764ba2); 
                color: white; 
                padding: 12px 30px; 
                border: none; 
                border-radius: 25px; 
                cursor: pointer; 
                font-size: 16px;
                font-weight: 600;
                transition: transform 0.3s ease;
            }
            .btn:hover { transform: translateY(-2px); }
            .format-grid { 
                display: grid; 
                grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); 
                gap: 15px; 
                margin: 20px 0; 
            }
            .format-option { 
                background: white;
                border: 2px solid #e0e6ed;
                border-radius: 10px;
                padding: 15px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            .format-option:hover {
                border-color: #667eea;
                transform: translateY(-2px);
                box-shadow: 0 5px 15px rgba(102, 126, 234, 0.2);
            }
            .format-option input[type="radio"] { display: none; }
            .format-option input[type="radio"]:checked + label {
                color: #667eea;
                font-weight: bold;
            }
            .format-option input[type="radio"]:checked ~ * {
                border-color: #667eea;
                background: linear-gradient(45deg, #667eea, #764ba2);
                color: white;
            }
            .admin-link {
                text-align: center;
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #eee;
            }
            .admin-link a {
                color: #667eea;
                text-decoration: none;
                font-weight: 500;
            }
            .error { color: #e74c3c; background: #fdf2f2; padding: 10px; border-radius: 5px; margin: 10px 0; }
            .success { color: #27ae60; background: #f2fdf2; padding: 10px; border-radius: 5px; margin: 10px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🎬 Video Converter</h1>
                <p>Convert your video and audio files quickly and securely!</p>
            </div>
            
            <div id="message"></div>
            
            <form id="upload-form" enctype="multipart/form-data">
                <div class="upload-form">
                    <h3>📁 Choose File to Convert</h3>
                    <input type="file" name="file" accept="video/*,audio/*" required style="margin: 20px 0;">
                    <br>
                    
                    <div>
                        <h4>🔄 Convert to:</h4>
                        <div class="format-grid">
                            <div class="format-option">
                                <input type="radio" name="target_format" value="mp4" id="mp4" required>
                                <label for="mp4">📹 MP4<br><small>Most compatible</small></label>
                            </div>
                            <div class="format-option">
                                <input type="radio" name="target_format" value="avi" id="avi">
                                <label for="avi">🎬 AVI<br><small>High quality</small></label>
                            </div>
                            <div class="format-option">
                                <input type="radio" name="target_format" value="mp3" id="mp3">
                                <label for="mp3">🎵 MP3<br><small>Audio only</small></label>
                            </div>
                            <div class="format-option">
                                <input type="radio" name="target_format" value="wav" id="wav">
                                <label for="wav">🎶 WAV<br><small>Uncompressed</small></label>
                            </div>
                        </div>
                    </div>
                    
                    <br>
                    <button type="submit" class="btn" id="convert-btn">
                        <span id="btn-text">🚀 Start Conversion</span>
                        <span id="btn-loading" style="display:none;">⏳ Uploading...</span>
                    </button>
                </div>
            </form>
            
            <div class="admin-link">
                <a href="/admin/login">🔐 Admin Panel</a> | 
                <a href="/test">🧪 Test Page</a>
            </div>
        </div>

        <script>
            document.getElementById('upload-form').addEventListener('submit', function(e) {
                e.preventDefault();
                
                const formData = new FormData(this);
                const btn = document.getElementById('convert-btn');
                const btnText = document.getElementById('btn-text');
                const btnLoading = document.getElementById('btn-loading');
                const messageDiv = document.getElementById('message');
                
                // Show loading
                btnText.style.display = 'none';
                btnLoading.style.display = 'inline';
                btn.disabled = true;
                
                fetch('/upload', {
                    method: 'POST',
                    body: formData
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        messageDiv.innerHTML = '<div class="success">✅ Upload successful! Redirecting...</div>';
                        setTimeout(() => {
                            window.location.href = data.redirect_url;
                        }, 1000);
                    } else {
                        throw new Error(data.error);
                    }
                })
                .catch(error => {
                    messageDiv.innerHTML = '<div class="error">❌ Error: ' + error.message + '</div>';
                    btnText.style.display = 'inline';
                    btnLoading.style.display = 'none';
                    btn.disabled = false;
                });
            });
            
            // Format selection styling
            document.querySelectorAll('.format-option').forEach(option => {
                option.addEventListener('click', function() {
                    const radio = this.querySelector('input[type="radio"]');
                    radio.checked = true;
                    
                    // Update styling
                    document.querySelectorAll('.format-option').forEach(opt => {
                        opt.style.borderColor = '#e0e6ed';
                        opt.style.background = 'white';
                        opt.style.color = '#333';
                    });
                    
                    this.style.borderColor = '#667eea';
                    this.style.background = 'linear-gradient(45deg, #667eea, #764ba2)';
                    this.style.color = 'white';
                });
            });
        </script>
    </body>
    </html>
    """

@app.route('/test')
def test():
    """Test page"""
    return f"""
    <h1>✅ Server Test Page</h1>
    <p><strong>Server Status:</strong> Running</p>
    <p><strong>Time:</strong> {datetime.now()}</p>
    <p><strong>Database:</strong> {'✅ Connected' if db else '❌ Error'}</p>
    <p><strong>Upload Folder:</strong> {'✅ Exists' if os.path.exists(Config.UPLOAD_FOLDER) else '❌ Missing'}</p>
    <p><strong>FFmpeg:</strong> {'✅ Available' if os.system('ffmpeg -version > nul 2>&1') == 0 else '❌ Not Found'}</p>
    
    <h3>Links:</h3>
    <ul>
        <li><a href="/">🏠 Home</a></li>
        <li><a href="/admin/login">🔐 Admin Login</a></li>
        <li><a href="/debug">🐛 Debug Info</a></li>
    </ul>
    
    <h3>Database Stats:</h3>
    <p>Total Jobs: {ConversionJob.query.count()}</p>
    """

@app.route('/debug')
def debug():
    """Debug information"""
    return f"""
    <h1>🐛 Debug Information</h1>
    <ul>
        <li><strong>Current Directory:</strong> {os.getcwd()}</li>
        <li><strong>Upload Folder:</strong> {Config.UPLOAD_FOLDER}</li>
        <li><strong>Original Folder:</strong> {Config.ORIGINAL_FOLDER}</li>
        <li><strong>Converted Folder:</strong> {Config.CONVERTED_FOLDER}</li>
        <li><strong>Max File Size:</strong> {Config.MAX_CONTENT_LENGTH / 1024 / 1024} MB</li>
        <li><strong>Allowed Extensions:</strong> {', '.join(Config.ALLOWED_EXTENSIONS)}</li>
    </ul>
    
    <h3>Folder Status:</h3>
    <ul>
        <li>Upload Folder Exists: {os.path.exists(Config.UPLOAD_FOLDER)}</li>
        <li>Original Folder Exists: {os.path.exists(Config.ORIGINAL_FOLDER)}</li>
        <li>Converted Folder Exists: {os.path.exists(Config.CONVERTED_FOLDER)}</li>
    </ul>
    
    <p><a href="/">← Back to Home</a></p>
    """

@app.route('/upload', methods=['POST'])
def upload_file():
    """Handle file upload"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file selected'}), 400
        
        file = request.files['file']
        target_format = request.form.get('target_format', '').lower()
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not is_allowed_file(file.filename):
            return jsonify({'error': 'File format not supported'}), 400
        
        if not target_format or target_format not in Config.ALLOWED_EXTENSIONS:
            return jsonify({'error': 'Invalid target format'}), 400
        
        # Generate job ID
        job_id = str(uuid.uuid4())
        filename = secure_filename(file.filename)
        original_format = filename.rsplit('.', 1)[1].lower()
        file_type = get_file_type(filename)
        
        # Save file
        file_path = os.path.join(Config.ORIGINAL_FOLDER, f"{job_id}_{filename}")
        file.save(file_path)
        file_size = os.path.getsize(file_path)
        
        # Create job record
        expires_at = datetime.utcnow() + timedelta(hours=Config.DEFAULT_CACHE_HOURS)
        job = ConversionJob(
            id=job_id,
            original_filename=filename,
            original_format=original_format,
            target_format=target_format,
            file_type=file_type,
            server_location='server_a',  # ← THÊM DÒNG NÀY
            original_path=file_path,
            expires_at=expires_at,
            file_size=file_size
        )
        
        db.session.add(job)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'job_id': job_id,
            'redirect_url': f'/convert/{job_id}'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/convert/<job_id>')
def convert_progress(job_id):
    """Conversion progress page"""
    job = ConversionJob.query.get_or_404(job_id)
    
    if datetime.utcnow() > job.expires_at:
        return """
        <h1>⏰ File Expired</h1>
        <p>This file has expired and been automatically deleted.</p>
        <a href="/">← Convert New File</a>
        """, 410
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Converting - Video Converter</title>
        <style>
            body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }}
            .progress-container {{ margin: 20px 0; }}
            .progress-bar {{ width: 100%; height: 30px; background: #f0f0f0; border-radius: 15px; overflow: hidden; }}
            .progress-fill {{ height: 100%; background: linear-gradient(90deg, #4CAF50, #45a049); transition: width 0.3s ease; }}
            .info {{ background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }}
            .btn {{ background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; text-decoration: none; display: inline-block; }}
            .status {{ text-align: center; margin: 20px 0; font-size: 18px; }}
        </style>
    </head>
    <body>
        <h1>🔄 Converting Your File</h1>
        
        <div class="info">
            <h3>File Information</h3>
            <p><strong>File:</strong> {job.original_filename}</p>
            <p><strong>Converting:</strong> {job.original_format.upper()} → {job.target_format.upper()}</p>
            <p><strong>Type:</strong> {job.file_type.title()}</p>
            <p><strong>Size:</strong> {job.file_size / 1024 / 1024:.1f} MB</p>
        </div>
        
        <div class="progress-container">
            <div class="progress-bar">
                <div class="progress-fill" id="progress-fill" style="width: {job.progress}%"></div>
            </div>
            <div class="status" id="status">
                <div id="progress-text">{job.progress}%</div>
                <div id="status-text">
                    {'⏳ Preparing...' if job.status == 'pending' else 
                     '🔄 Converting...' if job.status == 'processing' else
                     '✅ Completed!' if job.status == 'completed' else
                     '❌ Failed'}
                </div>
            </div>
        </div>
        
        {f'<div style="color: red; text-align: center;">❌ {job.error_message}</div>' if job.error_message else ''}
        
        <div style="text-align: center; margin: 20px 0;">
            {'<a href="/download/' + job.id + '" class="btn">📥 Download File</a>' if job.status == 'completed' else ''}
            <a href="/" class="btn" style="background: #6c757d;">🏠 Convert Another</a>
        </div>

        <script>
            const jobId = '{job.id}';
            let currentStatus = '{job.status}';
            
            // Auto-start conversion if pending
            if (currentStatus === 'pending') {{
                fetch('/api/convert', {{
                    method: 'POST',
                    headers: {{'Content-Type': 'application/json'}},
                    body: JSON.stringify({{job_id: jobId}})
                }});
            }}
            
            // Update progress
            function updateProgress() {{
                fetch('/api/progress/' + jobId)
                    .then(response => response.json())
                    .then(data => {{
                        document.getElementById('progress-fill').style.width = data.progress + '%';
                        document.getElementById('progress-text').textContent = data.progress + '%';
                        
                        let statusText = '⏳ Preparing...';
                        if (data.status === 'processing') statusText = '🔄 Converting...';
                        else if (data.status === 'completed') statusText = '✅ Completed!';
                        else if (data.status === 'failed') statusText = '❌ Failed';
                        
                        document.getElementById('status-text').textContent = statusText;
                        currentStatus = data.status;
                        
                        if (data.status === 'completed') {{
                            setTimeout(() => {{
                                window.location.href = '/download/' + jobId;
                            }}, 2000);
                        }}
                    }})
                    .catch(error => console.error('Error:', error));
            }}
            
            // Update every 2 seconds
            const interval = setInterval(() => {{
                if (currentStatus !== 'completed' && currentStatus !== 'failed') {{
                    updateProgress();
                }} else {{
                    clearInterval(interval);
                }}
            }}, 2000);
        </script>
    </body>
    </html>
    """

@app.route('/api/convert', methods=['POST'])
def api_convert():
    """Start conversion API"""
    try:
        data = request.get_json()
        job_id = data.get('job_id')
        
        job = ConversionJob.query.get(job_id)
        if not job:
            return jsonify({'error': 'Job not found'}), 404
        
        if job.status != 'pending':
            return jsonify({'error': 'Job already processed'}), 400
        
        # Start conversion in background
        thread = threading.Thread(target=start_conversion, args=(job_id,))
        thread.daemon = True
        thread.start()
        
        return jsonify({'success': True, 'message': 'Conversion started'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/progress/<job_id>')
def api_progress(job_id):
    """Get conversion progress"""
    job = ConversionJob.query.get_or_404(job_id)
    
    if datetime.utcnow() > job.expires_at:
        return jsonify({'error': 'File expired'}), 410
    
    return jsonify({
        'job_id': job.id,
        'status': job.status,
        'progress': job.progress,
        'error_message': job.error_message
    })

@app.route('/download/<job_id>')
def download_page(job_id):
    """Download page"""
    job = ConversionJob.query.get_or_404(job_id)
    
    if datetime.utcnow() > job.expires_at:
        return "<h1>⏰ File Expired</h1><p>This file has expired.</p><a href='/'>Convert New File</a>", 410
    
    if job.status != 'completed':
        return redirect(f'/convert/{job_id}')
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Download Ready - Video Converter</title>
        <style>
            body {{ font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; text-align: center; }}
            .download-btn {{ background: #28a745; color: white; padding: 20px 40px; border: none; border-radius: 10px; font-size: 18px; text-decoration: none; display: inline-block; margin: 20px; }}
            .info {{ background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0; }}
            .btn {{ background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; text-decoration: none; }}
        </style>
    </head>
    <body>
        <h1>✅ Conversion Complete!</h1>
        <p>Your file has been successfully converted!</p>
        
        <div class="info">
            <h3>📁 File Details</h3>
            <p><strong>Original:</strong> {job.original_filename}</p>
            <p><strong>Converted:</strong> {job.original_filename.rsplit('.', 1)[0]}.{job.target_format}</p>
            <p><strong>Format:</strong> {job.original_format.upper()} → {job.target_format.upper()}</p>
            <p><strong>Size:</strong> {job.file_size / 1024 / 1024:.1f} MB</p>
        </div>
        
        <a href="/api/download/{job.id}" class="download-btn">📥 Download Your File</a>
        
        <p><small>⏰ This file will be automatically deleted after 24 hours</small></p>
        
        <div>
            <a href="/" class="btn">🔄 Convert Another File</a>
        </div>
    </body>
    </html>
    """

@app.route('/api/download/<job_id>')
def api_download(job_id):
    """Download file API"""
    job = ConversionJob.query.get_or_404(job_id)
    
    if datetime.utcnow() > job.expires_at:
        return jsonify({'error': 'File expired'}), 410
    
    if job.status != 'completed' or not job.converted_path:
        return jsonify({'error': 'File not ready'}), 400
    
    if not os.path.exists(job.converted_path):
        return jsonify({'error': 'File not found'}), 404
    
    original_name = job.original_filename.rsplit('.', 1)[0]
    download_name = f"{original_name}.{job.target_format}"
    
    return send_file(job.converted_path, as_attachment=True, download_name=download_name)

@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    """Admin login"""
    if request.method == 'POST':
        username = request.form.get('username')
        password = request.form.get('password')
        
        if username == Config.ADMIN_USERNAME and password == Config.ADMIN_PASSWORD:
            session['admin_logged_in'] = True
            return redirect('/admin/dashboard')
        else:
            flash('Invalid credentials')
    
    return """
    <html>
    <head><title>Admin Login</title></head>
    <body style="font-family: Arial; max-width: 400px; margin: 100px auto; padding: 20px;">
        <form method="POST" style="background: #f8f9fa; padding: 30px; border-radius: 10px;">
            <h2>🔐 Admin Login</h2>
            <div style="margin: 20px 0;">
                <input type="text" name="username" placeholder="Username" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
            </div>
            <div style="margin: 20px 0;">
                <input type="password" name="password" placeholder="Password" required style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
            </div>
            <button type="submit" style="width: 100%; background: #dc3545; color: white; padding: 10px; border: none; border-radius: 5px; cursor: pointer;">Login</button>
            <p style="text-align: center; margin-top: 20px;"><a href="/">← Back to Converter</a></p>
        </form>
    </body>
    </html>
    """

@app.route('/admin/dashboard')
def admin_dashboard():
    """Admin dashboard"""
    if not session.get('admin_logged_in'):
        return redirect('/admin/login')
    
    stats = {
        'total_jobs': ConversionJob.query.count(),
        'pending_jobs': ConversionJob.query.filter_by(status='pending').count(),
        'processing_jobs': ConversionJob.query.filter_by(status='processing').count(),
        'completed_jobs': ConversionJob.query.filter_by(status='completed').count(),
        'failed_jobs': ConversionJob.query.filter_by(status='failed').count(),
        'recent_jobs': ConversionJob.query.order_by(ConversionJob.created_at.desc()).limit(10).all()
    }
    
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Admin Dashboard - Video Converter</title>
        <style>
            body {{ font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }}
            .header {{ display: flex; justify-content: space-between; align-items: center; margin-bottom: 30px; }}
            .stats-grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }}
            .stat-card {{ background: #f8f9fa; padding: 20px; border-radius: 10px; text-align: center; border-left: 4px solid #007bff; }}
            .stat-value {{ font-size: 2em; font-weight: bold; color: #007bff; }}
            .stat-label {{ color: #666; margin-top: 5px; }}
            .jobs-table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
            .jobs-table th, .jobs-table td {{ padding: 12px; border: 1px solid #ddd; text-align: left; }}
            .jobs-table th {{ background: #f8f9fa; font-weight: bold; }}
            .jobs-table tr:nth-child(even) {{ background: #f9f9f9; }}
            .status {{ padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; }}
            .status-pending {{ background: #fff3cd; color: #856404; }}
            .status-processing {{ background: #cce5ff; color: #004085; }}
            .status-completed {{ background: #d4edda; color: #155724; }}
            .status-failed {{ background: #f8d7da; color: #721c24; }}
            .btn {{ background: #007bff; color: white; padding: 10px 20px; border: none; border-radius: 5px; cursor: pointer; text-decoration: none; display: inline-block; margin: 5px; }}
            .btn-danger {{ background: #dc3545; }}
            .btn-success {{ background: #28a745; }}
            .progress-bar {{ width: 60px; height: 8px; background: #e9ecef; border-radius: 4px; overflow: hidden; }}
            .progress-fill {{ height: 100%; background: #28a745; transition: width 0.3s ease; }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🎛️ Admin Dashboard</h1>
            <div>
                <a href="/" class="btn">🏠 Home</a>
                <a href="/admin/logout" class="btn btn-danger">🚪 Logout</a>
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-value">{stats['total_jobs']}</div>
                <div class="stat-label">📊 Total Jobs</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{stats['pending_jobs']}</div>
                <div class="stat-label">⏳ Pending</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{stats['processing_jobs']}</div>
                <div class="stat-label">🔄 Processing</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{stats['completed_jobs']}</div>
                <div class="stat-label">✅ Completed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{stats['failed_jobs']}</div>
                <div class="stat-label">❌ Failed</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">{sum(job.file_size for job in ConversionJob.query.all()) / 1024 / 1024:.1f} MB</div>
                <div class="stat-label">💾 Storage Used</div>
            </div>
        </div>
        
        <h2>📋 Recent Jobs</h2>
        <table class="jobs-table">
            <thead>
                <tr>
                    <th>Job ID</th>
                    <th>Filename</th>
                    <th>Format</th>
                    <th>Status</th>
                    <th>Progress</th>
                    <th>Size</th>
                    <th>Created</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                {generate_jobs_table_rows(stats['recent_jobs'])}
            </tbody>
        </table>
        
        <div style="text-align: center; margin: 30px 0;">
            <button onclick="refreshDashboard()" class="btn">🔄 Refresh</button>
            <button onclick="cleanupExpired()" class="btn btn-success">🗑️ Cleanup Expired</button>
        </div>
        
        <div id="message" style="margin: 20px 0; padding: 10px; border-radius: 5px; display: none;"></div>
        
        <script>
            function refreshDashboard() {{
                location.reload();
            }}
            
            function cleanupExpired() {{
                if (confirm('Clean up all expired files?')) {{
                    fetch('/admin/cleanup', {{method: 'POST'}})
                        .then(response => response.json())
                        .then(data => {{
                            showMessage(data.message || 'Cleanup completed', 'success');
                            setTimeout(refreshDashboard, 2000);
                        }})
                        .catch(error => {{
                            showMessage('Cleanup failed: ' + error.message, 'error');
                        }});
                }}
            }}
            
            function deleteJob(jobId) {{
                if (confirm('Delete this job?')) {{
                    fetch('/admin/delete/' + jobId, {{method: 'DELETE'}})
                        .then(response => response.json())
                        .then(data => {{
                            showMessage('Job deleted successfully', 'success');
                            setTimeout(refreshDashboard, 1000);
                        }})
                        .catch(error => {{
                            showMessage('Delete failed: ' + error.message, 'error');
                        }});
                }}
            }}
            
            function showMessage(text, type) {{
                const messageDiv = document.getElementById('message');
                messageDiv.textContent = text;
                messageDiv.style.display = 'block';
                messageDiv.style.background = type === 'success' ? '#d4edda' : '#f8d7da';
                messageDiv.style.color = type === 'success' ? '#155724' : '#721c24';
                messageDiv.style.border = '1px solid ' + (type === 'success' ? '#c3e6cb' : '#f5c6cb');
            }}
            
            // Auto-refresh every 30 seconds
            setInterval(refreshDashboard, 30000);
        </script>
    </body>
    </html>
    """

@app.route('/admin/logout')
def admin_logout():
    """Admin logout"""
    session.pop('admin_logged_in', None)
    return redirect('/')

@app.route('/admin/cleanup', methods=['POST'])
def admin_cleanup():
    """Cleanup expired files"""
    try:
        if not session.get('admin_logged_in'):
            return jsonify({'error': 'Unauthorized'}), 401
        
        current_time = datetime.utcnow()
        expired_jobs = ConversionJob.query.filter(ConversionJob.expires_at < current_time).all()
        
        deleted_count = 0
        for job in expired_jobs:
            try:
                # Delete files
                if job.original_path and os.path.exists(job.original_path):
                    os.remove(job.original_path)
                if job.converted_path and os.path.exists(job.converted_path):
                    os.remove(job.converted_path)
                
                # Delete database record
                db.session.delete(job)
                deleted_count += 1
            except Exception as e:
                print(f"Error deleting job {job.id}: {e}")
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': f'Cleaned up {deleted_count} expired files'
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/admin/delete/<job_id>', methods=['DELETE'])
def admin_delete_job(job_id):
    """Delete specific job"""
    try:
        if not session.get('admin_logged_in'):
            return jsonify({'error': 'Unauthorized'}), 401
        
        job = ConversionJob.query.get_or_404(job_id)
        
        # Delete files
        if job.original_path and os.path.exists(job.original_path):
            os.remove(job.original_path)
        if job.converted_path and os.path.exists(job.converted_path):
            os.remove(job.converted_path)
        
        # Delete database record
        db.session.delete(job)
        db.session.commit()
        
        return jsonify({'success': True, 'message': 'Job deleted successfully'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

def generate_jobs_table_rows(jobs):
    """Generate HTML table rows for jobs"""
    if not jobs:
        return "<tr><td colspan='8' style='text-align: center; color: #666;'>No jobs found</td></tr>"
    
    rows = ""
    for job in jobs:
        status_class = f"status-{job.status}"
        progress_width = f"{job.progress}%"
        
        rows += f"""
        <tr>
            <td style="font-family: monospace; font-size: 12px;">{job.id[:8]}...</td>
            <td>{job.original_filename}</td>
            <td>{job.original_format.upper()} → {job.target_format.upper()}</td>
            <td><span class="status {status_class}">{job.status.upper()}</span></td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: {progress_width}"></div>
                </div>
                <small>{job.progress}%</small>
            </td>
            <td>{job.file_size / 1024 / 1024:.1f} MB</td>
            <td>{job.created_at.strftime('%m/%d %H:%M')}</td>
            <td>
                {"<a href='/download/" + job.id + "' class='btn' style='font-size: 12px; padding: 4px 8px;'>📥</a>" if job.status == 'completed' else ""}
                <button onclick="deleteJob('{job.id}')" class="btn btn-danger" style="font-size: 12px; padding: 4px 8px;">🗑️</button>
            </td>
        </tr>
        """
    
    return rows

# =============================================================================
# ERROR HANDLERS
# =============================================================================
@app.errorhandler(404)
def not_found(error):
    return """
    <h1>❌ Page Not Found</h1>
    <p>The page you're looking for doesn't exist.</p>
    <a href="/">🏠 Go Home</a>
    """, 404

@app.errorhandler(500)
def internal_error(error):
    return """
    <h1>💥 Server Error</h1>
    <p>Something went wrong on our end.</p>
    <a href="/">🏠 Go Home</a>
    """, 500

# =============================================================================
# INITIALIZE AND RUN
# =============================================================================
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    
    print("=" * 60)
    print("🎬 VIDEO CONVERTER SERVER STARTING")
    print("=" * 60)
    print(f"📍 Server running at: http://localhost:5000")
    print(f"🌐 External access: http://192.168.88.254:5000") 
    print(f"👤 Admin login: http://localhost:5000/admin/login")
    print(f"🔑 Username: {Config.ADMIN_USERNAME}")
    print(f"🔐 Password: {Config.ADMIN_PASSWORD}")
    print(f"🧪 Test page: http://localhost:5000/test")
    print("=" * 60)
    print("📁 Upload folder:", Config.UPLOAD_FOLDER)
    print("📂 Original folder:", Config.ORIGINAL_FOLDER) 
    print("📂 Converted folder:", Config.CONVERTED_FOLDER)
    print("📦 Supported formats:", ', '.join(Config.ALLOWED_EXTENSIONS))
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=5000, debug=True)
