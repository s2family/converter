// static/js/converter.js
// Conversion-specific JavaScript functionality

class ConversionManager {
    constructor() {
        this.currentJob = null;
        this.progressTracker = null;
        this.estimatedTime = null;
        this.startTime = null;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        this.init();
    }
    
    init() {
        this.setupProgressTracking();
        this.setupAutoConversion();
        this.setupRetryLogic();
    }
    
    setupProgressTracking() {
        // Check if we're on a conversion page
        const jobId = this.getJobIdFromURL();
        if (jobId) {
            this.currentJob = jobId;
            this.startProgressTracking();
        }
    }
    
    setupAutoConversion() {
        // Auto-start conversion for pending jobs
        if (this.currentJob && window.jobData && window.jobData.status === 'pending') {
            this.startConversion();
        }
    }
    
    setupRetryLogic() {
        // Setup retry button if conversion failed
        const retryButton = document.querySelector('[onclick="retryConversion()"]');
        if (retryButton) {
            retryButton.addEventListener('click', (e) => {
                e.preventDefault();
                this.retryConversion();
            });
        }
    }
    
    getJobIdFromURL() {
        const pathParts = window.location.pathname.split('/');
        const convertIndex = pathParts.indexOf('convert');
        return convertIndex !== -1 ? pathParts[convertIndex + 1] : null;
    }
    
    startConversion() {
        if (!this.currentJob) return;
        
        this.startTime = Date.now();
        
        fetch('/api/convert', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                job_id: this.currentJob
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                console.log('Conversion started successfully');
                this.trackConversionStart();
            } else {
                this.handleConversionError(data.error);
            }
        })
        .catch(error => {
            console.error('Failed to start conversion:', error);
            this.handleConversionError('Failed to start conversion');
        });
    }
    
    startProgressTracking() {
        if (this.progressTracker) {
            this.progressTracker.stop();
        }
        
        this.progressTracker = new ProgressTracker(this.currentJob);
        
        this.progressTracker.on('progress', (data) => {
            this.updateProgress(data);
        });
        
        this.progressTracker.on('complete', (data) => {
            this.handleConversionComplete(data);
        });
        
        this.progressTracker.on('error', (data) => {
            this.handleConversionError(data.error_message || 'Conversion failed');
        });
        
        this.progressTracker.start();
    }
    
    updateProgress(data) {
        this.updateProgressBar(data.progress);
        this.updateStatus(data.status);
        this.updateTimeEstimate(data.progress);
        this.updateConversionStats(data);
    }
    
    updateProgressBar(progress) {
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');
        
        if (progressFill && progressText) {
            progressFill.style.width = `${progress}%`;
            progressText.textContent = `${progress}%`;
            
            // Add animation class for smooth progress
            progressFill.classList.add('progress-updating');
            setTimeout(() => {
                progressFill.classList.remove('progress-updating');
            }, 300);
        }
    }
    
    updateStatus(status) {
        const statusElement = document.getElementById('progress-status');
        if (!statusElement) return;
        
        let statusIcon, statusText;
        
        switch (status) {
            case 'pending':
                statusIcon = '⏳';
                statusText = 'Preparing for conversion...';
                break;
            case 'processing':
                statusIcon = '🔄';
                statusText = 'Converting your file...';
                break;
            case 'completed':
                statusIcon = '✅';
                statusText = 'Conversion completed successfully!';
                break;
            case 'failed':
                statusIcon = '❌';
                statusText = 'Conversion failed';
                break;
            default:
                statusIcon = '❓';
                statusText = 'Unknown status';
        }
        
        statusElement.innerHTML = `<span class="status-icon">${statusIcon}</span> ${statusText}`;
    }
    
    updateTimeEstimate(progress) {
        if (!this.startTime || progress <= 0) return;
        
        const elapsed = (Date.now() - this.startTime) / 1000; // seconds
        const rate = progress / elapsed; // progress per second
        
        if (rate > 0 && progress < 100) {
            const remainingProgress = 100 - progress;
            const estimatedSeconds = remainingProgress / rate;
            
            this.updateTimeDisplay(estimatedSeconds);
        }
    }
    
    updateTimeDisplay(seconds) {
        const timeRemainingElement = document.getElementById('time-remaining');
        const estimatedTimeElement = document.getElementById('estimated-time');
        
        const timeString = this.formatTime(seconds);
        
        if (timeRemainingElement) {
            timeRemainingElement.textContent = timeString;
        }
        
        if (estimatedTimeElement) {
            estimatedTimeElement.textContent = timeString;
        }
    }
    
    updateConversionStats(data) {
        // Update conversion speed
        const speedElement = document.getElementById('conversion-speed');
        if (speedElement && data.processing_speed) {
            speedElement.textContent = `${data.processing_speed} fps`;
        }
        
        // Update processed time
        const processedElement = document.getElementById('processed-time');
        if (processedElement && data.processed_duration) {
            processedElement.textContent = this.formatTime(data.processed_duration);
        }
        
        // Update resource usage
        const cpuElement = document.getElementById('cpu-usage');
        const memoryElement = document.getElementById('memory-usage');
        
        if (cpuElement && data.cpu_usage) {
            cpuElement.textContent = `${data.cpu_usage}%`;
        }
        
        if (memoryElement && data.memory_usage) {
            memoryElement.textContent = `${data.memory_usage}MB`;
        }
    }
    
    handleConversionComplete(data) {
        console.log('Conversion completed:', data);
        
        this.trackConversionComplete();
        this.showCompletionNotification();
        
        // Auto-redirect to download page after 3 seconds
        setTimeout(() => {
            window.location.href = `/download/${this.currentJob}`;
        }, 3000);
    }
    
    handleConversionError(errorMessage) {
        console.error('Conversion error:', errorMessage);
        
        this.trackConversionError(errorMessage);
        this.showErrorNotification(errorMessage);
        this.showRetryOption();
    }
    
    retryConversion() {
        if (this.retryCount >= this.maxRetries) {
            this.showMaxRetriesReached();
            return;
        }
        
        this.retryCount++;
        console.log(`Retrying conversion (attempt ${this.retryCount}/${this.maxRetries})`);
        
        fetch(`/api/retry/${this.currentJob}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.startTime = Date.now();
                this.startProgressTracking();
                this.hideRetryOption();
                this.trackConversionRetry();
            } else {
                this.handleConversionError(data.error);
            }
        })
        .catch(error => {
            console.error('Retry failed:', error);
            this.handleConversionError('Retry failed');
        });
    }
    
    showCompletionNotification() {
        this.showNotification('Conversion completed successfully! Redirecting to download page...', 'success');
        
        // Show confetti animation
        this.showConfettiAnimation();
    }
    
    showErrorNotification(message) {
        this.showNotification(`Conversion failed: ${message}`, 'error');
    }
    
    showNotification(message, type) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
        notification.innerHTML = `
            <span class="notification-icon">${icon}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#d4edda' : type === 'error' ? '#f8d7da' : '#d1ecf1'};
            color: ${type === 'success' ? '#155724' : type === 'error' ? '#721c24' : '#0c5460'};
            border: 1px solid ${type === 'success' ? '#c3e6cb' : type === 'error' ? '#f5c6cb' : '#bee5eb'};
            border-radius: 8px;
            padding: 15px 20px;
            max-width: 400px;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            display: flex;
            align-items: center;
            gap: 10px;
            animation: slideInRight 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }
    
    showRetryOption() {
        const retryContainer = document.createElement('div');
        retryContainer.className = 'retry-container';
        retryContainer.innerHTML = `
            <div class="retry-message">
                <h3>🔄 Conversion Failed</h3>
                <p>Don't worry! You can try converting your file again.</p>
                <div class="retry-actions">
                    <button onclick="conversionManager.retryConversion()" class="btn btn-primary">
                        <span class="btn-icon">🔄</span>
                        Retry Conversion (${this.retryCount}/${this.maxRetries})
                    </button>
                    <button onclick="window.location.href='/'" class="btn btn-outline">
                        <span class="btn-icon">🏠</span>
                        Start Over
                    </button>
                </div>
            </div>
        `;
        
        const progressContainer = document.querySelector('.progress-container');
        if (progressContainer) {
            progressContainer.appendChild(retryContainer);
        }
    }
    
    hideRetryOption() {
        const retryContainer = document.querySelector('.retry-container');
        if (retryContainer) {
            retryContainer.remove();
        }
    }
    
    showMaxRetriesReached() {
        this.showNotification('Maximum retry attempts reached. Please try uploading your file again.', 'error');
        
        // Show alternative options
        const alternativeContainer = document.createElement('div');
        alternativeContainer.className = 'alternative-options';
        alternativeContainer.innerHTML = `
            <div class="alternative-message">
                <h3>⚠️ Maximum Retries Reached</h3>
                <p>We've tried converting your file ${this.maxRetries} times without success. Here are some alternatives:</p>
                <div class="alternative-actions">
                    <button onclick="window.location.reload()" class="btn btn-secondary">
                        <span class="btn-icon">🔄</span>
                        Refresh Page
                    </button>
                    <button onclick="window.location.href='/'" class="btn btn-primary">
                        <span class="btn-icon">📁</span>
                        Try Different File
                    </button>
                    <button onclick="conversionManager.showTroubleshooting()" class="btn btn-outline">
                        <span class="btn-icon">❓</span>
                        Get Help
                    </button>
                </div>
            </div>
        `;
        
        const progressContainer = document.querySelector('.progress-container');
        if (progressContainer) {
            progressContainer.appendChild(alternativeContainer);
        }
    }
    
    showTroubleshooting() {
        const modal = document.createElement('div');
        modal.className = 'troubleshooting-modal';
        modal.innerHTML = `
            <div class="modal-overlay" onclick="this.parentElement.remove()">
                <div class="modal-content" onclick="event.stopPropagation()">
                    <div class="modal-header">
                        <h3>🛠️ Troubleshooting</h3>
                        <button class="modal-close" onclick="this.closest('.troubleshooting-modal').remove()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="troubleshooting-section">
                            <h4>🔍 Common Issues</h4>
                            <ul>
                                <li><strong>File too large:</strong> Try compressing your file or using a smaller version</li>
                                <li><strong>Corrupted file:</strong> Check if the original file plays correctly</li>
                                <li><strong>Unsupported codec:</strong> Try converting to MP4 first</li>
                                <li><strong>Network issues:</strong> Check your internet connection</li>
                            </ul>
                        </div>
                        
                        <div class="troubleshooting-section">
                            <h4>💡 Suggestions</h4>
                            <ul>
                                <li>Try a different output format (MP4 is most compatible)</li>
                                <li>Reduce file size before uploading</li>
                                <li>Use a stable internet connection</li>
                                <li>Clear your browser cache and try again</li>
                            </ul>
                        </div>
                        
                        <div class="troubleshooting-section">
                            <h4>📊 File Information</h4>
                            <div class="file-debug-info" id="file-debug-info">
                                Loading file information...
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Load file debug information
        this.loadFileDebugInfo();
    }
    
    loadFileDebugInfo() {
        fetch(`/api/storage/file/${this.currentJob}`)
            .then(response => response.json())
            .then(data => {
                const debugInfo = document.getElementById('file-debug-info');
                if (debugInfo) {
                    debugInfo.innerHTML = `
                        <div class="debug-grid">
                            <div class="debug-item">
                                <span class="debug-label">Original Format:</span>
                                <span class="debug-value">${data.original_format || 'Unknown'}</span>
                            </div>
                            <div class="debug-item">
                                <span class="debug-label">Target Format:</span>
                                <span class="debug-value">${data.target_format || 'Unknown'}</span>
                            </div>
                            <div class="debug-item">
                                <span class="debug-label">File Size:</span>
                                <span class="debug-value">${this.formatFileSize(data.file_size || 0)}</span>
                            </div>
                            <div class="debug-item">
                                <span class="debug-label">File Type:</span>
                                <span class="debug-value">${data.file_type || 'Unknown'}</span>
                            </div>
                            <div class="debug-item">
                                <span class="debug-label">Status:</span>
                                <span class="debug-value">${data.status || 'Unknown'}</span>
                            </div>
                            <div class="debug-item">
                                <span class="debug-label">Error:</span>
                                <span class="debug-value">${data.error_message || 'None'}</span>
                            </div>
                        </div>
                    `;
                }
            })
            .catch(error => {
                const debugInfo = document.getElementById('file-debug-info');
                if (debugInfo) {
                    debugInfo.innerHTML = '<p class="error">Failed to load file information</p>';
                }
            });
    }
    
    showConfettiAnimation() {
        // Simple confetti animation
        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];
        
        for (let i = 0; i < 50; i++) {
            setTimeout(() => {
                const confetti = document.createElement('div');
                confetti.style.cssText = `
                    position: fixed;
                    top: -10px;
                    left: ${Math.random() * 100}vw;
                    width: 10px;
                    height: 10px;
                    background: ${colors[Math.floor(Math.random() * colors.length)]};
                    border-radius: 50%;
                    pointer-events: none;
                    z-index: 9999;
                    animation: confettiFall 3s linear forwards;
                `;
                
                document.body.appendChild(confetti);
                
                setTimeout(() => confetti.remove(), 3000);
            }, i * 50);
        }
    }
    
    formatTime(seconds) {
        if (seconds < 60) {
            return `${Math.round(seconds)}s`;
        } else if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = Math.round(seconds % 60);
            return `${minutes}m ${remainingSeconds}s`;
        } else {
            const hours = Math.floor(seconds / 3600);
            const minutes = Math.floor((seconds % 3600) / 60);
            return `${hours}h ${minutes}m`;
        }
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Analytics tracking
    trackConversionStart() {
        if (typeof gtag !== 'undefined') {
            gtag('event', 'conversion_start', {
                event_category: 'Conversion',
                job_id: this.currentJob
            });
        }
    }
    
    trackConversionComplete() {
        const duration = this.startTime ? (Date.now() - this.startTime) / 1000 : 0;
        
        if (typeof gtag !== 'undefined') {
            gtag('event', 'conversion_complete', {
                event_category: 'Conversion',
                job_id: this.currentJob,
                conversion_duration: Math.round(duration)
            });
        }
    }
    
    trackConversionError(errorMessage) {
        if (typeof gtag !== 'undefined') {
            gtag('event', 'conversion_error', {
                event_category: 'Conversion',
                job_id: this.currentJob,
                error_message: errorMessage,
                retry_count: this.retryCount
            });
        }
    }
    
    trackConversionRetry() {
        if (typeof gtag !== 'undefined') {
            gtag('event', 'conversion_retry', {
                event_category: 'Conversion',
                job_id: this.currentJob,
                retry_attempt: this.retryCount
            });
        }
    }
    
    // Cleanup methods
    destroy() {
        if (this.progressTracker) {
            this.progressTracker.stop();
        }
        
        // Remove event listeners
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        window.removeEventListener('beforeunload', this.handleBeforeUnload);
    }
    
    handleVisibilityChange() {
        if (document.hidden) {
            // Page hidden - reduce polling frequency
            if (this.progressTracker) {
                this.progressTracker.interval = 5000; // 5 seconds
            }
        } else {
            // Page visible - normal polling frequency
            if (this.progressTracker) {
                this.progressTracker.interval = 2000; // 2 seconds
            }
        }
    }
    
    handleBeforeUnload(e) {
        if (this.progressTracker && this.progressTracker.interval) {
            e.preventDefault();
            e.returnValue = 'Your file is still being converted. Are you sure you want to leave?';
            return e.returnValue;
        }
    }
}

// Quality estimation utility
class QualityEstimator {
    static estimateConversionQuality(fromFormat, toFormat, fileSize) {
        const qualityMatrix = {
            // Video formats
            'mp4': { quality: 90, compatibility: 95, size: 80 },
            'avi': { quality: 85, compatibility: 70, size: 60 },
            'mov': { quality: 88, compatibility: 75, size: 75 },
            'mkv': { quality: 92, compatibility: 65, size: 70 },
            'webm': { quality: 85, compatibility: 80, size: 85 },
            'flv': { quality: 70, compatibility: 60, size: 90 },
            
            // Audio formats
            'mp3': { quality: 85, compatibility: 95, size: 90 },
            'wav': { quality: 100, compatibility: 85, size: 30 },
        };
        
        const fromStats = qualityMatrix[fromFormat] || { quality: 70, compatibility: 70, size: 70 };
        const toStats = qualityMatrix[toFormat] || { quality: 70, compatibility: 70, size: 70 };
        
        return {
            expectedQuality: Math.min(fromStats.quality, toStats.quality),
            compatibility: toStats.compatibility,
            sizeEfficiency: toStats.size,
            recommendation: this.getRecommendation(fromFormat, toFormat)
        };
    }
    
    static getRecommendation(fromFormat, toFormat) {
        const recommendations = {
            'avi_to_mp4': 'Excellent choice! MP4 offers great compatibility and smaller file size.',
            'mov_to_mp4': 'Good conversion for better compatibility across devices.',
            'mkv_to_mp4': 'MP4 will be more widely supported while maintaining good quality.',
            'wav_to_mp3': 'Significant size reduction with minimal quality loss.',
            'mp4_to_avi': 'Note: AVI files are typically larger but may be needed for specific software.',
        };
        
        const key = `${fromFormat}_to_${toFormat}`;
        return recommendations[key] || 'This conversion should work well for your needs.';
    }
}

// Format compatibility checker
class CompatibilityChecker {
    static checkBrowserSupport(format) {
        const video = document.createElement('video');
        const audio = document.createElement('audio');
        
        const videoFormats = {
            'mp4': video.canPlayType('video/mp4'),
            'webm': video.canPlayType('video/webm'),
            'avi': '', // Not natively supported
            'mov': video.canPlayType('video/quicktime'),
            'mkv': '', // Not natively supported
            'flv': '' // Not natively supported
        };
        
        const audioFormats = {
            'mp3': audio.canPlayType('audio/mpeg'),
            'wav': audio.canPlayType('audio/wav'),
            'mp4': audio.canPlayType('audio/mp4')
        };
        
        return videoFormats[format] || audioFormats[format] || '';
    }
    
    static getCompatibilityInfo(format) {
        const support = this.checkBrowserSupport(format);
        const devices = {
            'mp4': ['iPhone', 'Android', 'Desktop', 'Smart TV', 'Gaming Console'],
            'mp3': ['iPhone', 'Android', 'Desktop', 'MP3 Player', 'Car Audio'],
            'wav': ['Desktop', 'Professional Audio Equipment'],
            'avi': ['Desktop (with codec)', 'Older devices'],
            'webm': ['Chrome Browser', 'Firefox Browser', 'Modern Desktop'],
            'mov': ['iPhone', 'Mac', 'QuickTime Player'],
            'mkv': ['VLC Player', 'Desktop (with codec)'],
            'flv': ['Flash Player', 'Legacy Web Players']
        };
        
        return {
            browserSupport: support ? 'Supported' : 'Not natively supported',
            supportLevel: support ? (support === 'probably' ? 'Full' : 'Partial') : 'None',
            compatibleDevices: devices[format] || ['Limited compatibility']
        };
    }
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    @keyframes confettiFall {
        to {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
        }
    }
    
    .troubleshooting-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 2000;
    }
    
    .modal-overlay {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(5px);
    }
    
    .modal-content {
        background: white;
        border-radius: 15px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 2rem 2rem 1rem;
        border-bottom: 1px solid #e0e6ed;
    }
    
    .modal-close {
        background: none;
        border: none;
        font-size: 2rem;
        cursor: pointer;
        color: #666;
        padding: 0;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .modal-body {
        padding: 2rem;
    }
    
    .troubleshooting-section {
        margin-bottom: 2rem;
    }
    
    .troubleshooting-section h4 {
        margin-bottom: 1rem;
        color: #333;
    }
    
    .debug-grid {
        display: grid;
        gap: 0.5rem;
    }
    
    .debug-item {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        border-bottom: 1px solid #f0f0f0;
    }
    
    .debug-label {
        font-weight: 600;
        color: #555;
    }
    
    .debug-value {
        color: #333;
        font-family: monospace;
    }
    
    .progress-updating {
        transition: width 0.3s ease;
    }
    
    .retry-container,
    .alternative-options {
        background: #f8f9fa;
        border-radius: 15px;
        padding: 2rem;
        margin-top: 2rem;
        text-align: center;
    }
    
    .retry-actions,
    .alternative-actions {
        display: flex;
        gap: 1rem;
        justify-content: center;
        flex-wrap: wrap;
        margin-top: 1.5rem;
    }
    
    @media (max-width: 768px) {
        .modal-content {
            margin: 1rem;
            max-height: calc(100vh - 2rem);
        }
        
        .retry-actions,
        .alternative-actions {
            flex-direction: column;
            align-items: center;
        }
        
        .retry-actions .btn,
        .alternative-actions .btn {
            width: 100%;
            max-width: 250px;
        }
    }
`;

document.head.appendChild(style);

// Initialize conversion manager when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    window.conversionManager = new ConversionManager();
    
    console.log('Conversion Manager initialized');
});

// Export classes for external use
window.ConversionManager = ConversionManager;
window.QualityEstimator = QualityEstimator;
window.CompatibilityChecker = CompatibilityChecker;
