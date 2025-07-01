// static/js/main.js
// Main JavaScript for upload functionality and UI interactions

class VideoConverter {
    constructor() {
        this.fileInput = document.getElementById('file-input');
        this.uploadArea = document.getElementById('upload-area');
        this.fileInfo = document.getElementById('file-info');
        this.formatSelection = document.getElementById('format-selection');
        this.convertButtonContainer = document.getElementById('convert-button-container');
        this.uploadForm = document.getElementById('upload-form');
        
        this.selectedFile = null;
        this.supportedFormats = {
            video: ['mp4', 'avi', 'mov', 'mkv', 'flv', 'webm', 'mpeg'],
            audio: ['mp3', 'wav', 'mp4']
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupDragAndDrop();
        this.setupFormatTabs();
        this.setupFormValidation();
    }
    
    setupEventListeners() {
        // File input change
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Upload area click
        this.uploadArea.addEventListener('click', () => this.fileInput.click());
        
        // Remove file button
        document.addEventListener('click', (e) => {
            if (e.target.id === 'remove-file') {
                this.removeFile();
            }
        });
        
        // Form submission
        this.uploadForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        // Format option changes
        document.addEventListener('change', (e) => {
            if (e.target.name === 'target_format') {
                this.handleFormatChange(e);
            }
        });
    }
    
    setupDragAndDrop() {
        // Prevent default drag behaviors
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, this.preventDefaults, false);
            document.body.addEventListener(eventName, this.preventDefaults, false);
        });
        
        // Highlight drop area when item is dragged over it
        ['dragenter', 'dragover'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, () => this.highlight(), false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            this.uploadArea.addEventListener(eventName, () => this.unhighlight(), false);
        });
        
        // Handle dropped files
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e), false);
    }
    
    setupFormatTabs() {
        const formatTabs = document.querySelectorAll('.format-tab');
        const formatGroups = document.querySelectorAll('.format-group');
        
        formatTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetType = tab.dataset.type;
                
                // Update active tab
                formatTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Show/hide format groups
                formatGroups.forEach(group => {
                    if (group.dataset.type === targetType) {
                        group.style.display = 'block';
                    } else {
                        group.style.display = 'none';
                    }
                });
                
                // Clear previous selection
                document.querySelectorAll('input[name="target_format"]').forEach(input => {
                    input.checked = false;
                });
                
                this.updateConvertButton();
            });
        });
    }
    
    setupFormValidation() {
        // Real-time validation
        document.querySelectorAll('input[name="target_format"]').forEach(input => {
            input.addEventListener('change', () => this.validateForm());
        });
    }
    
    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    highlight() {
        this.uploadArea.classList.add('dragover');
    }
    
    unhighlight() {
        this.uploadArea.classList.remove('dragover');
    }
    
    handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            this.handleFile(files[0]);
        }
    }
    
    handleFileSelect(e) {
        const file = e.target.files[0];
        if (file) {
            this.handleFile(file);
        }
    }
    
    handleFile(file) {
        // Validate file
        if (!this.validateFile(file)) {
            return;
        }
        
        this.selectedFile = file;
        this.showFileInfo(file);
        this.showFormatSelection(file);
        this.hideUploadArea();
    }
    
    validateFile(file) {
        // Check file size (500MB limit)
        const maxSize = 500 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showError('File size must be less than 500MB');
            return false;
        }
        
        // Check file type
        const fileType = this.getFileType(file);
        if (!fileType) {
            this.showError('Unsupported file format. Please select a video or audio file.');
            return false;
        }
        
        return true;
    }
    
    getFileType(file) {
        const extension = file.name.split('.').pop().toLowerCase();
        
        if (this.supportedFormats.video.includes(extension)) {
            return 'video';
        } else if (this.supportedFormats.audio.includes(extension)) {
            return 'audio';
        }
        
        return null;
    }
    
    showFileInfo(file) {
        const fileName = document.getElementById('file-name');
        const fileSize = document.getElementById('file-size');
        
        fileName.textContent = file.name;
        fileSize.textContent = this.formatFileSize(file.size);
        
        this.fileInfo.style.display = 'block';
    }
    
    showFormatSelection(file) {
        const fileType = this.getFileType(file);
        
        // Show appropriate format tab
        const formatTabs = document.querySelectorAll('.format-tab');
        const formatGroups = document.querySelectorAll('.format-group');
        
        formatTabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.type === fileType) {
                tab.classList.add('active');
            }
        });
        
        formatGroups.forEach(group => {
            if (group.dataset.type === fileType) {
                group.style.display = 'block';
            } else {
                group.style.display = 'none';
            }
        });
        
        // Get current file format and suggest alternatives
        const currentFormat = file.name.split('.').pop().toLowerCase();
        this.suggestFormats(currentFormat, fileType);
        
        this.formatSelection.style.display = 'block';
    }
    
    suggestFormats(currentFormat, fileType) {
        const suggestions = {
            video: {
                'avi': 'mp4',
                'mov': 'mp4',
                'mkv': 'mp4',
                'flv': 'mp4',
                'webm': 'mp4',
                'mpeg': 'mp4'
            },
            audio: {
                'wav': 'mp3',
                'mp4': 'mp3'
            }
        };
        
        const suggested = suggestions[fileType]?.[currentFormat];
        if (suggested) {
            const suggestedInput = document.querySelector(`input[value="${suggested}"]`);
            if (suggestedInput) {
                suggestedInput.checked = true;
                this.updateConvertButton();
            }
        }
    }
    
    hideUploadArea() {
        this.uploadArea.style.display = 'none';
    }
    
    showUploadArea() {
        this.uploadArea.style.display = 'block';
    }
    
    removeFile() {
        this.selectedFile = null;
        this.fileInput.value = '';
        
        // Hide sections
        this.fileInfo.style.display = 'none';
        this.formatSelection.style.display = 'none';
        this.convertButtonContainer.style.display = 'none';
        
        // Show upload area
        this.showUploadArea();
        
        // Clear format selection
        document.querySelectorAll('input[name="target_format"]').forEach(input => {
            input.checked = false;
        });
    }
    
    handleFormatChange(e) {
        this.updateConvertButton();
        this.validateForm();
        
        // Add visual feedback
        const formatLabel = e.target.closest('.format-label');
        if (formatLabel) {
            // Animate selection
            formatLabel.style.transform = 'scale(1.05)';
            setTimeout(() => {
                formatLabel.style.transform = 'scale(1)';
            }, 150);
        }
    }
    
    updateConvertButton() {
        const selectedFormat = document.querySelector('input[name="target_format"]:checked');
        
        if (this.selectedFile && selectedFormat) {
            this.convertButtonContainer.style.display = 'block';
            
            // Update button text with format info
            const buttonText = document.querySelector('.convert-button .button-text');
            if (buttonText) {
                const currentFormat = this.selectedFile.name.split('.').pop().toUpperCase();
                const targetFormat = selectedFormat.value.toUpperCase();
                buttonText.textContent = `Convert ${currentFormat} to ${targetFormat}`;
            }
        } else {
            this.convertButtonContainer.style.display = 'none';
        }
    }
    
    validateForm() {
        const selectedFormat = document.querySelector('input[name="target_format"]:checked');
        const convertButton = document.getElementById('convert-button');
        
        if (this.selectedFile && selectedFormat) {
            // Check if conversion is needed
            const currentFormat = this.selectedFile.name.split('.').pop().toLowerCase();
            const targetFormat = selectedFormat.value.toLowerCase();
            
            if (currentFormat === targetFormat) {
                this.showWarning('Selected format is the same as the original file format.');
                convertButton.disabled = true;
                return false;
            } else {
                this.hideMessages();
                convertButton.disabled = false;
                return true;
            }
        }
        
        return false;
    }
    
    handleFormSubmit(e) {
        e.preventDefault();
        
        if (!this.validateForm()) {
            this.showError('Please select a file and target format.');
            return;
        }
        
        const formData = new FormData();
        formData.append('file', this.selectedFile);
        
        const selectedFormat = document.querySelector('input[name="target_format"]:checked');
        formData.append('target_format', selectedFormat.value);
        
        this.startUpload(formData);
    }
    
    startUpload(formData) {
        const convertButton = document.getElementById('convert-button');
        const buttonText = convertButton.querySelector('.button-text');
        const buttonLoader = convertButton.querySelector('.button-loader');
        
        // Show loading state
        buttonText.style.display = 'none';
        buttonLoader.style.display = 'inline-block';
        convertButton.disabled = true;
        
        // Show loading overlay
        this.showLoadingOverlay('Uploading file...');
        
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            this.hideLoadingOverlay();
            
            if (data.success) {
                // Redirect to conversion page
                window.location.href = data.redirect_url;
            } else {
                this.showError(data.error || 'Upload failed');
                this.resetButton(convertButton, buttonText, buttonLoader);
            }
        })
        .catch(error => {
            console.error('Upload error:', error);
            this.hideLoadingOverlay();
            this.showError('Upload failed. Please try again.');
            this.resetButton(convertButton, buttonText, buttonLoader);
        });
    }
    
    resetButton(button, textElement, loaderElement) {
        textElement.style.display = 'inline-block';
        loaderElement.style.display = 'none';
        button.disabled = false;
    }
    
    showLoadingOverlay(message) {
        const overlay = document.getElementById('loading-overlay');
        const messageElement = overlay.querySelector('p');
        
        if (messageElement) {
            messageElement.textContent = message;
        }
        
        overlay.style.display = 'flex';
    }
    
    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        overlay.style.display = 'none';
    }
    
    showError(message) {
        this.showMessage(message, 'error');
    }
    
    showWarning(message) {
        this.showMessage(message, 'warning');
    }
    
    showSuccess(message) {
        this.showMessage(message, 'success');
    }
    
    showMessage(message, type) {
        // Remove existing messages
        this.hideMessages();
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message message-${type}`;
        messageDiv.innerHTML = `
            <span class="message-icon">${this.getMessageIcon(type)}</span>
            <span class="message-text">${message}</span>
            <button class="message-close" onclick="this.parentElement.remove()">&times;</button>
        `;
        
        // Insert after converter card
        const converterCard = document.querySelector('.converter-card');
        converterCard.parentNode.insertBefore(messageDiv, converterCard.nextSibling);
        
        // Auto-hide after 5 seconds
        setTimeout(() => {
            if (messageDiv.parentNode) {
                messageDiv.remove();
            }
        }, 5000);
    }
    
    hideMessages() {
        document.querySelectorAll('.message').forEach(msg => msg.remove());
    }
    
    getMessageIcon(type) {
        const icons = {
            error: '❌',
            warning: '⚠️',
            success: '✅',
            info: 'ℹ️'
        };
        return icons[type] || 'ℹ️';
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    // Utility methods for analytics
    trackEvent(action, properties = {}) {
        if (typeof gtag !== 'undefined') {
            gtag('event', action, {
                event_category: 'Converter',
                ...properties
            });
        }
    }
    
    trackFileUpload(file) {
        const fileType = this.getFileType(file);
        const fileSize = file.size;
        const extension = file.name.split('.').pop().toLowerCase();
        
        this.trackEvent('file_upload', {
            file_type: fileType,
            file_extension: extension,
            file_size_mb: Math.round(fileSize / (1024 * 1024))
        });
    }
    
    trackConversion(fromFormat, toFormat) {
        this.trackEvent('conversion_start', {
            from_format: fromFormat,
            to_format: toFormat,
            conversion_type: `${fromFormat}_to_${toFormat}`
        });
    }
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// Progress tracking utilities
class ProgressTracker {
    constructor(jobId) {
        this.jobId = jobId;
        this.interval = null;
        this.callbacks = {
            progress: [],
            complete: [],
            error: []
        };
    }
    
    start() {
        this.interval = setInterval(() => {
            this.checkProgress();
        }, 2000);
    }
    
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    }
    
    checkProgress() {
        fetch(`/api/progress/${this.jobId}`)
            .then(response => response.json())
            .then(data => {
                this.handleProgressUpdate(data);
            })
            .catch(error => {
                console.error('Progress check error:', error);
                this.emit('error', error);
            });
    }
    
    handleProgressUpdate(data) {
        this.emit('progress', data);
        
        if (data.status === 'completed') {
            this.emit('complete', data);
            this.stop();
        } else if (data.status === 'failed') {
            this.emit('error', data);
            this.stop();
        }
    }
    
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }
    
    off(event, callback) {
        if (this.callbacks[event]) {
            const index = this.callbacks[event].indexOf(callback);
            if (index > -1) {
                this.callbacks[event].splice(index, 1);
            }
        }
    }
    
    emit(event, data) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback(data));
        }
    }
}

// Network status monitoring
class NetworkMonitor {
    constructor() {
        this.isOnline = navigator.onLine;
        this.callbacks = {
            online: [],
            offline: []
        };
        
        this.init();
    }
    
    init() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.emit('online');
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            this.emit('offline');
        });
    }
    
    on(event, callback) {
        if (this.callbacks[event]) {
            this.callbacks[event].push(callback);
        }
    }
    
    emit(event) {
        if (this.callbacks[event]) {
            this.callbacks[event].forEach(callback => callback());
        }
    }
    
    showOfflineMessage() {
        const message = document.createElement('div');
        message.className = 'network-status offline';
        message.innerHTML = `
            <span class="status-icon">📡</span>
            <span class="status-text">You're offline. Please check your internet connection.</span>
        `;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.remove();
            }
        }, 5000);
    }
    
    showOnlineMessage() {
        const message = document.createElement('div');
        message.className = 'network-status online';
        message.innerHTML = `
            <span class="status-icon">✅</span>
            <span class="status-text">You're back online!</span>
        `;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            if (message.parentNode) {
                message.remove();
            }
        }, 3000);
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Initialize main converter
    const converter = new VideoConverter();
    
    // Initialize network monitor
    const networkMonitor = new NetworkMonitor();
    
    networkMonitor.on('offline', () => {
        networkMonitor.showOfflineMessage();
    });
    
    networkMonitor.on('online', () => {
        networkMonitor.showOnlineMessage();
    });
    
    // Global error handler
    window.addEventListener('error', function(e) {
        console.error('Global error:', e.error);
        
        // Show user-friendly error message
        const errorMessage = document.createElement('div');
        errorMessage.className = 'global-error';
        errorMessage.innerHTML = `
            <span class="error-icon">⚠️</span>
            <span class="error-text">Something went wrong. Please refresh the page and try again.</span>
            <button onclick="location.reload()">Refresh Page</button>
        `;
        
        document.body.appendChild(errorMessage);
    });
    
    // Page visibility API for pausing/resuming operations
    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // Page is hidden, pause non-critical operations
            console.log('Page hidden - pausing operations');
        } else {
            // Page is visible, resume operations
            console.log('Page visible - resuming operations');
        }
    });
    
    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    console.log('Video Converter initialized successfully');
});

// Export for use in other modules
window.VideoConverter = VideoConverter;
window.ProgressTracker = ProgressTracker;
window.NetworkMonitor = NetworkMonitor;
