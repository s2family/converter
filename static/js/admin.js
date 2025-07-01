// static/js/admin.js
// Admin dashboard JavaScript functionality

class AdminDashboard {
    constructor() {
        this.refreshInterval = null;
        this.jobUpdateInterval = null;
        this.currentModal = null;
        this.socketConnection = null;
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupAutoRefresh();
        this.setupJobUpdates();
        this.setupKeyboardShortcuts();
        this.setupWebSocket();
    }
    
    setupEventListeners() {
        // Quick action buttons
        document.addEventListener('click', (e) => {
            const target = e.target.closest('button');
            if (!target) return;
            
            const action = target.getAttribute('onclick');
            if (action) {
                e.preventDefault();
                this.handleQuickAction(action, target);
            }
        });
        
        // Table interactions
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('id-short')) {
                this.toggleJobId(e.target);
            }
        });
        
        // Modal close on escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentModal) {
                this.closeModal(this.currentModal);
            }
        });
        
        // Close modals on background click
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });
    }
    
    setupAutoRefresh() {
        // Auto-refresh dashboard every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.refreshDashboard(true); // Silent refresh
        }, 30000);
        
        // Refresh on page focus
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.refreshDashboard(true);
            }
        });
    }
    
    setupJobUpdates() {
        // Update processing jobs every 5 seconds
        this.jobUpdateInterval = setInterval(() => {
            this.updateProcessingJobs();
        }, 5000);
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + R: Refresh dashboard
            if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
                e.preventDefault();
                this.refreshDashboard();
            }
            
            // Ctrl/Cmd + H: Show system health
            if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
                e.preventDefault();
                this.showSystemHealth();
            }
            
            // Ctrl/Cmd + C: Run cleanup
            if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
                e.preventDefault();
                this.runCleanup();
            }
        });
    }
    
    setupWebSocket() {
        // Setup WebSocket for real-time updates if available
        if (typeof WebSocket !== 'undefined') {
            try {
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${protocol}//${window.location.host}/ws/admin`;
                
                this.socketConnection = new WebSocket(wsUrl);
                
                this.socketConnection.onopen = () => {
                    console.log('WebSocket connected');
                };
                
                this.socketConnection.onmessage = (event) => {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(data);
                };
                
                this.socketConnection.onerror = (error) => {
                    console.log('WebSocket error:', error);
                };
                
                this.socketConnection.onclose = () => {
                    console.log('WebSocket disconnected');
                    // Attempt to reconnect after 5 seconds
                    setTimeout(() => this.setupWebSocket(), 5000);
                };
            } catch (error) {
                console.log('WebSocket not available:', error);
            }
        }
    }
    
    handleWebSocketMessage(data) {
        switch (data.type) {
            case 'job_update':
                this.updateJobInTable(data.job);
                break;
            case 'stats_update':
                this.updateStatCards(data.stats);
                break;
            case 'system_alert':
                this.showSystemAlert(data.message, data.level);
                break;
        }
    }
    
    handleQuickAction(action, button) {
        // Extract function name from onclick attribute
        const functionName = action.split('(')[0];
        
        if (typeof this[functionName] === 'function') {
            this[functionName](button);
        } else if (typeof window[functionName] === 'function') {
            window[functionName](button);
        }
    }
    
    toggleJobId(element) {
        const fullId = element.parentElement.querySelector('.id-full');
        const shortId = element;
        
        if (fullId.style.display === 'none' || !fullId.style.display) {
            fullId.style.display = 'inline';
            shortId.style.display = 'none';
        } else {
            fullId.style.display = 'none';
            shortId.style.display = 'inline';
        }
    }
    
    refreshDashboard(silent = false) {
        if (!silent) {
            this.showLoadingOverlay('Refreshing dashboard...');
        }
        
        fetch('/admin/dashboard')
            .then(response => response.text())
            .then(html => {
                // Parse the new HTML and update relevant sections
                const parser = new DOMParser();
                const newDoc = parser.parseFromString(html, 'text/html');
                
                this.updateStatCards(newDoc);
                this.updateJobsTable(newDoc);
                this.updateMetrics(newDoc);
                
                if (!silent) {
                    this.hideLoadingOverlay();
                    this.showNotification('Dashboard refreshed successfully', 'success');
                }
                
                this.updateLastRefreshTime();
            })
            .catch(error => {
                console.error('Refresh failed:', error);
                if (!silent) {
                    this.hideLoadingOverlay();
                    this.showNotification('Failed to refresh dashboard', 'error');
                }
            });
    }
    
    updateStatCards(newDoc) {
        const statCards = document.querySelectorAll('.stat-card .stat-value');
        const newStatCards = newDoc.querySelectorAll('.stat-card .stat-value');
        
        statCards.forEach((card, index) => {
            if (newStatCards[index]) {
                const newValue = newStatCards[index].textContent;
                const currentValue = card.textContent;
                
                if (newValue !== currentValue) {
                    card.textContent = newValue;
                    this.animateStatChange(card);
                }
            }
        });
    }
    
    updateJobsTable(newDoc) {
        const currentTable = document.querySelector('.jobs-table tbody');
        const newTable = newDoc.querySelector('.jobs-table tbody');
        
        if (currentTable && newTable) {
            currentTable.innerHTML = newTable.innerHTML;
        }
    }
    
    updateMetrics(newDoc) {
        const metricsSection = document.querySelector('.performance-metrics');
        const newMetrics = newDoc.querySelector('.performance-metrics');
        
        if (metricsSection && newMetrics) {
            // Update only the content, preserve event listeners
            const metricCards = metricsSection.querySelectorAll('.metric-card .metric-content');
            const newMetricCards = newMetrics.querySelectorAll('.metric-card .metric-content');
            
            metricCards.forEach((card, index) => {
                if (newMetricCards[index]) {
                    card.innerHTML = newMetricCards[index].innerHTML;
                }
            });
        }
    }
    
    updateProcessingJobs() {
        const processingRows = document.querySelectorAll('.status-processing, .status-pending');
        
        processingRows.forEach(row => {
            const jobId = row.closest('[data-job-id]')?.dataset.jobId;
            if (jobId) {
                fetch(`/api/progress/${jobId}`)
                    .then(response => response.json())
                    .then(data => {
                        this.updateJobRow(row.closest('tr'), data);
                    })
                    .catch(error => {
                        console.error(`Failed to update job ${jobId}:`, error);
                    });
            }
        });
    }
    
    updateJobRow(row, jobData) {
        const statusElement = row.querySelector('.status-badge');
        const progressElement = row.querySelector('.progress-fill-small');
        const progressText = row.querySelector('.progress-text-small');
        
        if (statusElement) {
            statusElement.className = `status-badge status-${jobData.status}`;
            const icons = {
                pending: '⏳',
                processing: '🔄',
                completed: '✅',
                failed: '❌'
            };
            statusElement.innerHTML = `${icons[jobData.status]} ${jobData.status.charAt(0).toUpperCase() + jobData.status.slice(1)}`;
        }
        
        if (progressElement && progressText) {
            progressElement.style.width = `${jobData.progress}%`;
            progressText.textContent = `${jobData.progress}%`;
        }
        
        // Update action buttons based on new status
        if (jobData.status === 'completed') {
            this.addDownloadButton(row, jobData.job_id);
        }
    }
    
    updateJobInTable(jobData) {
        const row = document.querySelector(`[data-job-id="${jobData.job_id}"]`);
        if (row) {
            this.updateJobRow(row, jobData);
        }
    }
    
    addDownloadButton(row, jobId) {
        const actionsCell = row.querySelector('.actions');
        const downloadBtn = actionsCell.querySelector('[title="Download"]');
        
        if (!downloadBtn) {
            const buttonHtml = `<button onclick="downloadJob('${jobId}')" class="btn-icon-small" title="Download">⬇️</button>`;
            actionsCell.querySelector('.action-buttons-small').insertAdjacentHTML('beforeend', buttonHtml);
        }
    }
    
    animateStatChange(element) {
        element.style.transform = 'scale(1.1)';
        element.style.color = '#4CAF50';
        
        setTimeout(() => {
            element.style.transform = 'scale(1)';
            element.style.color = '';
        }, 300);
    }
    
    updateLastRefreshTime() {
        const now = new Date().toLocaleTimeString();
        const headerInfo = document.querySelector('.header-info p');
        
        if (headerInfo) {
            const text = headerInfo.textContent;
            if (text.includes('Last updated:')) {
                headerInfo.textContent = text.replace(/Last updated: \d+:\d+:\d+/, `Last updated: ${now}`);
            } else {
                headerInfo.textContent += ` • Last updated: ${now}`;
            }
        }
    }
    
    // Quick Action Handlers
    runCleanup(button) {
        if (button) {
            button.disabled = true;
            button.innerHTML = '<span class="action-icon">⏳</span><span class="action-text"><span class="action-title">Running...</span><span class="action-subtitle">Please wait</span></span>';
        }
        
        fetch('/api/storage/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const message = `Cleanup completed: ${data.results.deleted_jobs} jobs deleted, ${this.formatFileSize(data.results.total_size_freed)} freed`;
                this.showNotification(message, 'success');
                this.refreshDashboard(true);
            } else {
                this.showNotification('Cleanup failed: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Cleanup error:', error);
            this.showNotification('Cleanup failed', 'error');
        })
        .finally(() => {
            if (button) {
                button.disabled = false;
                button.innerHTML = '<span class="action-icon">🗑️</span><span class="action-text"><span class="action-title">Run Cleanup</span><span class="action-subtitle">Delete expired files</span></span>';
            }
        });
    }
    
    showSystemHealth() {
        this.showModal('health-modal');
        this.loadSystemHealth();
    }
    
    loadSystemHealth() {
        const healthContent = document.getElementById('health-content');
        const healthLoading = document.querySelector('.health-loading');
        
        if (healthLoading) healthLoading.style.display = 'block';
        if (healthContent) healthContent.style.display = 'none';
        
        fetch('/api/storage/health')
            .then(response => response.json())
            .then(data => {
                this.displaySystemHealth(data);
            })
            .catch(error => {
                console.error('Health check failed:', error);
                if (healthContent) {
                    healthContent.innerHTML = '<div class="error">Failed to load system health</div>';
                }
            })
            .finally(() => {
                if (healthLoading) healthLoading.style.display = 'none';
                if (healthContent) healthContent.style.display = 'block';
            });
    }
    
    displaySystemHealth(data) {
        const healthContent = document.getElementById('health-content');
        if (!healthContent) return;
        
        const healthClass = data.status === 'healthy' ? 'health-good' : data.status === 'warning' ? 'health-warning' : 'health-error';
        
        healthContent.innerHTML = `
            <div class="health-section">
                <h4>🏥 System Status</h4>
                <div class="health-grid">
                    <div class="health-item ${healthClass}">
                        <div class="health-value">${data.status || 'Unknown'}</div>
                        <div class="health-label">Overall Health</div>
                    </div>
                    <div class="health-item">
                        <div class="health-value">${data.disk_usage_percentage || 0}%</div>
                        <div class="health-label">Disk Usage</div>
                    </div>
                    <div class="health-item">
                        <div class="health-value">${data.active_jobs || 0}</div>
                        <div class="health-label">Active Jobs</div>
                    </div>
                    <div class="health-item">
                        <div class="health-value">${this.formatFileSize(data.available_space || 0)}</div>
                        <div class="health-label">Available Space</div>
                    </div>
                </div>
                
                ${data.issues && data.issues.length > 0 ? `
                    <div class="health-issues">
                        <h4>⚠️ Issues Detected</h4>
                        <ul>
                            ${data.issues.map(issue => `<li>${issue}</li>`).join('')}
                        </ul>
                    </div>
                ` : ''}
                
                <div class="health-timestamp">
                    Last checked: ${new Date(data.timestamp || Date.now()).toLocaleString()}
                </div>
            </div>
        `;
    }
    
    showStorageDetails() {
        this.showModal('storage-modal');
        this.loadStorageDetails();
    }
    
    loadStorageDetails() {
        fetch('/api/storage/stats')
            .then(response => response.json())
            .then(data => {
                this.displayStorageDetails(data);
            })
            .catch(error => {
                console.error('Storage details failed:', error);
            });
    }
    
    displayStorageDetails(data) {
        // Implementation for storage details modal
        console.log('Storage details:', data);
    }
    
    showClusterStatus() {
        if (!dashboardData.isMaster) {
            this.showNotification('Cluster status is only available on master server', 'warning');
            return;
        }
        
        this.showModal('cluster-modal');
        this.loadClusterStatus();
    }
    
    loadClusterStatus() {
        const clusterContent = document.getElementById('cluster-content');
        const clusterLoading = document.querySelector('.cluster-loading');
        
        if (clusterLoading) clusterLoading.style.display = 'block';
        if (clusterContent) clusterContent.style.display = 'none';
        
        fetch('/api/master/cluster-status')
            .then(response => response.json())
            .then(data => {
                this.displayClusterStatus(data);
            })
            .catch(error => {
                console.error('Cluster status failed:', error);
                if (clusterContent) {
                    clusterContent.innerHTML = '<div class="error">Failed to load cluster status</div>';
                }
            })
            .finally(() => {
                if (clusterLoading) clusterLoading.style.display = 'none';
                if (clusterContent) clusterContent.style.display = 'block';
            });
    }
    
    displayClusterStatus(data) {
        const clusterContent = document.getElementById('cluster-content');
        if (!clusterContent) return;
        
        let html = '<div class="cluster-overview">';
        
        // Master server status
        html += `
            <div class="server-status-card">
                <div class="server-status-header">
                    <span class="server-name">Master Server (${data.master_server.name})</span>
                    <span class="server-status server-online">🟢 Online</span>
                </div>
                <div class="server-metrics">
                    <div class="server-metric">
                        <div class="server-metric-value">${data.master_server.pending_jobs || 0}</div>
                        <div class="server-metric-label">Pending Jobs</div>
                    </div>
                    <div class="server-metric">
                        <div class="server-metric-value">${data.master_server.processing_jobs || 0}</div>
                        <div class="server-metric-label">Processing</div>
                    </div>
                </div>
            </div>
        `;
        
        // Worker servers
        Object.entries(data.worker_servers || {}).forEach(([serverName, serverData]) => {
            const isOnline = serverData.status === 'online';
            html += `
                <div class="server-status-card">
                    <div class="server-status-header">
                        <span class="server-name">Worker Server (${serverName})</span>
                        <span class="server-status ${isOnline ? 'server-online' : 'server-offline'}">
                            ${isOnline ? '🟢 Online' : '🔴 Offline'}
                        </span>
                    </div>
                    ${isOnline ? `
                        <div class="server-metrics">
                            <div class="server-metric">
                                <div class="server-metric-value">${serverData.pending_jobs || 0}</div>
                                <div class="server-metric-label">Pending Jobs</div>
                            </div>
                            <div class="server-metric">
                                <div class="server-metric-value">${serverData.processing_jobs || 0}</div>
                                <div class="server-metric-label">Processing</div>
                            </div>
                        </div>
                    ` : '<div class="server-error">Server is offline or unreachable</div>'}
                </div>
            `;
        });
        
        // Cluster summary
        html += `
            <div class="cluster-summary">
                <h4>📊 Cluster Summary</h4>
                <div class="server-metrics">
                    <div class="server-metric">
                        <div class="server-metric-value">${data.cluster_summary.total_pending_jobs || 0}</div>
                        <div class="server-metric-label">Total Pending</div>
                    </div>
                    <div class="server-metric">
                        <div class="server-metric-value">${data.cluster_summary.total_processing_jobs || 0}</div>
                        <div class="server-metric-label">Total Processing</div>
                    </div>
                    <div class="server-metric">
                        <div class="server-metric-value">${data.cluster_summary.active_servers || 0}</div>
                        <div class="server-metric-label">Active Servers</div>
                    </div>
                    <div class="server-metric">
                        <div class="server-metric-value">${data.cluster_summary.cluster_healthy ? 'Healthy' : 'Issues'}</div>
                        <div class="server-metric-label">Health Status</div>
                    </div>
                </div>
            </div>
        `;
        
        html += '</div>';
        clusterContent.innerHTML = html;
    }
    
    exportLogs() {
        this.showLoadingOverlay('Preparing logs for export...');
        
        fetch('/api/admin/export-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => {
            if (response.ok) {
                return response.blob();
            }
            throw new Error('Export failed');
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `system_logs_${new Date().toISOString().split('T')[0]}.zip`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            
            this.hideLoadingOverlay();
            this.showNotification('Logs exported successfully', 'success');
        })
        .catch(error => {
            console.error('Export failed:', error);
            this.hideLoadingOverlay();
            this.showNotification('Failed to export logs', 'error');
        });
    }
    
    // Job Management Functions
    viewJobDetails(jobId) {
        this.showModal('job-details-modal');
        this.loadJobDetails(jobId);
    }
    
    loadJobDetails(jobId) {
        const detailsContent = document.getElementById('job-details-content');
        const detailsLoading = document.querySelector('.job-details-loading');
        
        if (detailsLoading) detailsLoading.style.display = 'block';
        if (detailsContent) detailsContent.style.display = 'none';
        
        fetch(`/api/storage/file/${jobId}`)
            .then(response => response.json())
            .then(data => {
                this.displayJobDetails(data);
            })
            .catch(error => {
                console.error('Job details failed:', error);
                if (detailsContent) {
                    detailsContent.innerHTML = '<div class="error">Failed to load job details</div>';
                }
            })
            .finally(() => {
                if (detailsLoading) detailsLoading.style.display = 'none';
                if (detailsContent) detailsContent.style.display = 'block';
            });
    }
    
    displayJobDetails(data) {
        const detailsContent = document.getElementById('job-details-content');
        if (!detailsContent) return;
        
        detailsContent.innerHTML = `
            <div class="job-detail-section">
                <h4>📄 File Information</h4>
                <div class="job-detail-grid">
                    <div class="job-detail-item">
                        <span class="job-detail-label">Job ID:</span>
                        <span class="job-detail-value">${data.job_id}</span>
                    </div>
                    <div class="job-detail-item">
                        <span class="job-detail-label">Filename:</span>
                        <span class="job-detail-value">${data.original_filename}</span>
                    </div>
                    <div class="job-detail-item">
                        <span class="job-detail-label">Format:</span>
                        <span class="job-detail-value">${data.original_format} → ${data.target_format}</span>
                    </div>
                    <div class="job-detail-item">
                        <span class="job-detail-label">Type:</span>
                        <span class="job-detail-value">${data.file_type}</span>
                    </div>
                    <div class="job-detail-item">
                        <span class="job-detail-label">Size:</span>
                        <span class="job-detail-value">${this.formatFileSize(data.file_size)}</span>
                    </div>
                    <div class="job-detail-item">
                        <span class="job-detail-label">Status:</span>
                        <span class="job-detail-value">${data.status}</span>
                    </div>
                    <div class="job-detail-item">
                        <span class="job-detail-label">Progress:</span>
                        <span class="job-detail-value">${data.progress}%</span>
                    </div>
                    <div class="job-detail-item">
                        <span class="job-detail-label">Created:</span>
                        <span class="job-detail-value">${new Date(data.created_at).toLocaleString()}</span>
                    </div>
                    <div class="job-detail-item">
                        <span class="job-detail-label">Expires:</span>
                        <span class="job-detail-value">${new Date(data.expires_at).toLocaleString()}</span>
                    </div>
                    ${data.error_message ? `
                        <div class="job-detail-item">
                            <span class="job-detail-label">Error:</span>
                            <span class="job-detail-value error">${data.error_message}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    downloadJob(jobId) {
        window.open(`/api/download/${jobId}`, '_blank');
        this.trackEvent('admin_download', { job_id: jobId });
    }
    
    retryJob(jobId) {
        if (!confirm('Are you sure you want to retry this conversion?')) return;
        
        fetch(`/api/retry/${jobId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showNotification('Conversion retry started', 'success');
                this.refreshJobsTable();
            } else {
                this.showNotification('Retry failed: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Retry failed:', error);
            this.showNotification('Retry failed', 'error');
        });
    }
    
    deleteJob(jobId) {
        if (!confirm('Are you sure you want to delete this job? This action cannot be undone.')) return;
        
        fetch(`/api/storage/delete/${jobId}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                this.showNotification('Job deleted successfully', 'success');
                this.refreshJobsTable();
                this.refreshDashboard(true);
            } else {
                this.showNotification('Delete failed: ' + data.error, 'error');
            }
        })
        .catch(error => {
            console.error('Delete failed:', error);
            this.showNotification('Delete failed', 'error');
        });
    }
    
    showAllJobs() {
        window.open('/admin/jobs', '_blank');
    }
    
    refreshJobsTable() {
        const tableContainer = document.querySelector('.table-container');
        if (!tableContainer) return;
        
        fetch('/admin/jobs-table')
            .then(response => response.text())
            .then(html => {
                const parser = new DOMParser();
                const newDoc = parser.parseFromString(html, 'text/html');
                const newTable = newDoc.querySelector('.jobs-table');
                
                if (newTable) {
                    document.querySelector('.jobs-table').innerHTML = newTable.innerHTML;
                }
            })
            .catch(error => {
                console.error('Failed to refresh jobs table:', error);
            });
    }
    
    showJobDistribution() {
        // Load balancing and job distribution interface
        this.showNotification('Job distribution feature coming soon', 'info');
    }
    
    // Modal Management
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'flex';
            this.currentModal = modalId;
            document.body.style.overflow = 'hidden';
        }
    }
    
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
            this.currentModal = null;
            document.body.style.overflow = '';
        }
    }
    
    // Notification System
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `admin-notification notification-${type}`;
        
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icons[type]}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
            </div>
        `;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border-left: 4px solid ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : type === 'warning' ? '#ff9800' : '#2196F3'};
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            max-width: 400px;
            z-index: 1000;
            animation: slideInFromRight 0.3s ease;
        `;
        
        notification.querySelector('.notification-content').style.cssText = `
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 15px 20px;
        `;
        
        notification.querySelector('.notification-close').style.cssText = `
            background: none;
            border: none;
            font-size: 18px;
            cursor: pointer;
            color: #666;
            margin-left: auto;
        `;
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'slideOutToRight 0.3s ease';
                setTimeout(() => notification.remove(), 300);
            }
        }, 5000);
    }
    
    showLoadingOverlay(message = 'Loading...') {
        let overlay = document.getElementById('loading-overlay');
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.7);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 2000;
                backdrop-filter: blur(5px);
            `;
            
            overlay.innerHTML = `
                <div class="loading-content" style="
                    background: white;
                    padding: 2rem;
                    border-radius: 15px;
                    text-align: center;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
                ">
                    <div class="spinner" style="
                        width: 40px;
                        height: 40px;
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid #667eea;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 1rem;
                    "></div>
                    <p id="loading-message">${message}</p>
                </div>
            `;
            
            document.body.appendChild(overlay);
        } else {
            const messageElement = overlay.querySelector('#loading-message');
            if (messageElement) {
                messageElement.textContent = message;
            }
            overlay.style.display = 'flex';
        }
    }
    
    hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    showSystemAlert(message, level = 'info') {
        const alert = document.createElement('div');
        alert.className = `system-alert alert-${level}`;
        
        const alertColors = {
            info: '#2196F3',
            warning: '#ff9800',
            error: '#f44336',
            success: '#4CAF50'
        };
        
        alert.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: ${alertColors[level]};
            color: white;
            padding: 15px 20px;
            text-align: center;
            font-weight: bold;
            z-index: 1001;
            animation: slideDownFromTop 0.3s ease;
        `;
        
        alert.innerHTML = `
            <span class="alert-message">${message}</span>
            <button onclick="this.parentElement.remove()" style="
                background: none;
                border: none;
                color: white;
                font-size: 18px;
                cursor: pointer;
                margin-left: 20px;
            ">&times;</button>
        `;
        
        document.body.appendChild(alert);
        
        // Auto-remove after 10 seconds for system alerts
        setTimeout(() => {
            if (alert.parentElement) {
                alert.style.animation = 'slideUpToTop 0.3s ease';
                setTimeout(() => alert.remove(), 300);
            }
        }, 10000);
    }
    
    // Utility Methods
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    formatDuration(seconds) {
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
    
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString();
    }
    
    // Analytics and Tracking
    trackEvent(action, properties = {}) {
        if (typeof gtag !== 'undefined') {
            gtag('event', action, {
                event_category: 'Admin',
                ...properties
            });
        }
        
        // Also log to console for debugging
        console.log('Admin Event:', action, properties);
    }
    
    // Performance Monitoring
    startPerformanceMonitoring() {
        // Monitor page performance
        if (typeof PerformanceObserver !== 'undefined') {
            const observer = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.entryType === 'measure') {
                        console.log(`Performance: ${entry.name} took ${entry.duration}ms`);
                    }
                }
            });
            
            observer.observe({ entryTypes: ['measure'] });
        }
    }
    
    measurePerformance(name, fn) {
        const startMark = `${name}-start`;
        const endMark = `${name}-end`;
        
        if (typeof performance !== 'undefined') {
            performance.mark(startMark);
        }
        
        const result = fn();
        
        if (typeof performance !== 'undefined') {
            performance.mark(endMark);
            performance.measure(name, startMark, endMark);
        }
        
        return result;
    }
    
    // Data Export Utilities
    exportTableToCSV(tableSelector, filename) {
        const table = document.querySelector(tableSelector);
        if (!table) return;
        
        const rows = Array.from(table.querySelectorAll('tr'));
        const csvContent = rows.map(row => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            return cells.map(cell => {
                const text = cell.textContent.trim();
                return `"${text.replace(/"/g, '""')}"`;
            }).join(',');
        }).join('\n');
        
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || 'admin_data.csv';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        
        this.trackEvent('data_export', { type: 'csv', filename });
    }
    
    exportStatsToJSON(filename) {
        const stats = {
            timestamp: new Date().toISOString(),
            server: dashboardData.serverName,
            is_master: dashboardData.isMaster,
            stats: dashboardData.stats,
            export_type: 'admin_statistics'
        };
        
        const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `admin_stats_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        
        this.trackEvent('data_export', { type: 'json', filename });
    }
    
    // Search and Filter Functionality
    setupTableSearch() {
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search jobs...';
        searchInput.className = 'table-search';
        searchInput.style.cssText = `
            padding: 8px 12px;
            border: 2px solid #e0e6ed;
            border-radius: 8px;
            font-size: 14px;
            margin-bottom: 1rem;
            width: 300px;
        `;
        
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            tableContainer.parentNode.insertBefore(searchInput, tableContainer);
        }
        
        searchInput.addEventListener('input', (e) => {
            this.filterTable(e.target.value.toLowerCase());
        });
    }
    
    filterTable(searchTerm) {
        const rows = document.querySelectorAll('.jobs-table tbody tr');
        
        rows.forEach(row => {
            const text = row.textContent.toLowerCase();
            const isVisible = text.includes(searchTerm);
            row.style.display = isVisible ? '' : 'none';
        });
        
        // Update visible count
        const visibleRows = Array.from(rows).filter(row => row.style.display !== 'none');
        console.log(`Showing ${visibleRows.length} of ${rows.length} jobs`);
    }
    
    // Advanced Admin Features
    initializeAdvancedFeatures() {
        this.setupTableSearch();
        this.setupBulkActions();
        this.setupAutoSave();
        this.startPerformanceMonitoring();
    }
    
    setupBulkActions() {
        // Add checkboxes to table rows for bulk operations
        const table = document.querySelector('.jobs-table');
        if (!table) return;
        
        // Add header checkbox
        const headerRow = table.querySelector('thead tr');
        if (headerRow) {
            const selectAllTh = document.createElement('th');
            selectAllTh.innerHTML = '<input type="checkbox" id="select-all-jobs">';
            headerRow.insertBefore(selectAllTh, headerRow.firstChild);
        }
        
        // Add row checkboxes
        const bodyRows = table.querySelectorAll('tbody tr');
        bodyRows.forEach(row => {
            const selectTd = document.createElement('td');
            const jobId = row.dataset.jobId;
            selectTd.innerHTML = `<input type="checkbox" class="job-checkbox" value="${jobId}">`;
            row.insertBefore(selectTd, row.firstChild);
        });
        
        // Setup select all functionality
        const selectAllCheckbox = document.getElementById('select-all-jobs');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', (e) => {
                const checkboxes = document.querySelectorAll('.job-checkbox');
                checkboxes.forEach(cb => cb.checked = e.target.checked);
                this.updateBulkActionButtons();
            });
        }
        
        // Setup individual checkbox handlers
        document.addEventListener('change', (e) => {
            if (e.target.classList.contains('job-checkbox')) {
                this.updateBulkActionButtons();
            }
        });
        
        // Add bulk action buttons
        this.addBulkActionButtons();
    }
    
    addBulkActionButtons() {
        const sectionHeader = document.querySelector('.section-header');
        if (!sectionHeader) return;
        
        const bulkActions = document.createElement('div');
        bulkActions.className = 'bulk-actions';
        bulkActions.style.cssText = 'display: none; gap: 0.5rem;';
        bulkActions.innerHTML = `
            <button onclick="adminDashboard.bulkDeleteJobs()" class="btn btn-danger btn-small">
                <span class="btn-icon">🗑️</span> Delete Selected
            </button>
            <button onclick="adminDashboard.bulkRetryJobs()" class="btn btn-secondary btn-small">
                <span class="btn-icon">🔄</span> Retry Selected
            </button>
            <button onclick="adminDashboard.exportSelectedJobs()" class="btn btn-outline btn-small">
                <span class="btn-icon">📄</span> Export Selected
            </button>
        `;
        
        sectionHeader.appendChild(bulkActions);
    }
    
    updateBulkActionButtons() {
        const selectedCheckboxes = document.querySelectorAll('.job-checkbox:checked');
        const bulkActions = document.querySelector('.bulk-actions');
        
        if (bulkActions) {
            bulkActions.style.display = selectedCheckboxes.length > 0 ? 'flex' : 'none';
        }
    }
    
    bulkDeleteJobs() {
        const selectedJobs = Array.from(document.querySelectorAll('.job-checkbox:checked'))
            .map(cb => cb.value);
        
        if (selectedJobs.length === 0) return;
        
        if (!confirm(`Are you sure you want to delete ${selectedJobs.length} selected jobs?`)) return;
        
        this.showLoadingOverlay(`Deleting ${selectedJobs.length} jobs...`);
        
        Promise.all(selectedJobs.map(jobId => 
            fetch(`/api/storage/delete/${jobId}`, { method: 'DELETE' })
        ))
        .then(responses => {
            const successCount = responses.filter(r => r.ok).length;
            this.hideLoadingOverlay();
            this.showNotification(`Successfully deleted ${successCount} of ${selectedJobs.length} jobs`, 'success');
            this.refreshJobsTable();
            this.refreshDashboard(true);
        })
        .catch(error => {
            console.error('Bulk delete failed:', error);
            this.hideLoadingOverlay();
            this.showNotification('Bulk delete failed', 'error');
        });
    }
    
    bulkRetryJobs() {
        const selectedJobs = Array.from(document.querySelectorAll('.job-checkbox:checked'))
            .map(cb => cb.value);
        
        if (selectedJobs.length === 0) return;
        
        this.showLoadingOverlay(`Retrying ${selectedJobs.length} jobs...`);
        
        Promise.all(selectedJobs.map(jobId => 
            fetch(`/api/retry/${jobId}`, { method: 'POST' })
        ))
        .then(responses => {
            const successCount = responses.filter(r => r.ok).length;
            this.hideLoadingOverlay();
            this.showNotification(`Successfully retried ${successCount} of ${selectedJobs.length} jobs`, 'success');
            this.refreshJobsTable();
        })
        .catch(error => {
            console.error('Bulk retry failed:', error);
            this.hideLoadingOverlay();
            this.showNotification('Bulk retry failed', 'error');
        });
    }
    
    exportSelectedJobs() {
        const selectedJobs = Array.from(document.querySelectorAll('.job-checkbox:checked'))
            .map(cb => cb.value);
        
        if (selectedJobs.length === 0) return;
        
        // Export selected job data
        const jobData = selectedJobs.map(jobId => {
            const row = document.querySelector(`[data-job-id="${jobId}"]`);
            if (!row) return null;
            
            const cells = row.querySelectorAll('td');
            return {
                job_id: jobId,
                filename: cells[2]?.textContent?.trim(),
                format: cells[3]?.textContent?.trim(),
                status: cells[4]?.textContent?.trim(),
                progress: cells[5]?.textContent?.trim(),
                created: cells[6]?.textContent?.trim()
            };
        }).filter(Boolean);
        
        const blob = new Blob([JSON.stringify(jobData, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `selected_jobs_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        a.remove();
        
        this.showNotification(`Exported ${selectedJobs.length} jobs`, 'success');
    }
    
    setupAutoSave() {
        // Auto-save user preferences
        const preferences = {
            autoRefresh: true,
            refreshInterval: 30000,
            showNotifications: true,
            tablePageSize: 10
        };
        
        // Load saved preferences
        const saved = localStorage.getItem('admin_preferences');
        if (saved) {
            Object.assign(preferences, JSON.parse(saved));
        }
        
        // Save preferences periodically
        setInterval(() => {
            localStorage.setItem('admin_preferences', JSON.stringify(preferences));
        }, 10000);
        
        this.preferences = preferences;
    }
    
    // Cleanup and Destroy
    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        if (this.jobUpdateInterval) {
            clearInterval(this.jobUpdateInterval);
        }
        
        if (this.socketConnection) {
            this.socketConnection.close();
        }
        
        // Remove event listeners
        document.removeEventListener('visibilitychange', this.handleVisibilityChange);
        document.removeEventListener('keydown', this.handleKeyboardShortcuts);
        
        console.log('Admin Dashboard destroyed');
    }
}

// Add CSS animations
const adminStyles = document.createElement('style');
adminStyles.textContent = `
    @keyframes slideInFromRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOutToRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
    
    @keyframes slideDownFromTop {
        from { transform: translateY(-100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
    
    @keyframes slideUpToTop {
        from { transform: translateY(0); opacity: 1; }
        to { transform: translateY(-100%); opacity: 0; }
    }
    
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
    
    .admin-notification {
        border-radius: 8px;
        margin-bottom: 10px;
    }
    
    .notification-content {
        align-items: center;
    }
    
    .table-search:focus {
        outline: none;
        border-color: #667eea;
        box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    }
    
    .bulk-actions {
        align-items: center;
    }
    
    .job-checkbox {
        margin: 0;
    }
    
    .error {
        color: #f44336;
        font-weight: bold;
    }
`;

document.head.appendChild(adminStyles);

// Global functions for backward compatibility
function refreshDashboard() {
    if (window.adminDashboard) {
        window.adminDashboard.refreshDashboard();
    }
}

function runCleanup() {
    if (window.adminDashboard) {
        window.adminDashboard.runCleanup();
    }
}

function showSystemHealth() {
    if (window.adminDashboard) {
        window.adminDashboard.showSystemHealth();
    }
}

function showStorageDetails() {
    if (window.adminDashboard) {
        window.adminDashboard.showStorageDetails();
    }
}

function exportLogs() {
    if (window.adminDashboard) {
        window.adminDashboard.exportLogs();
    }
}

function showClusterStatus() {
    if (window.adminDashboard) {
        window.adminDashboard.showClusterStatus();
    }
}

function showJobDistribution() {
    if (window.adminDashboard) {
        window.adminDashboard.showJobDistribution();
    }
}

function viewJobDetails(jobId) {
    if (window.adminDashboard) {
        window.adminDashboard.viewJobDetails(jobId);
    }
}

function downloadJob(jobId) {
    if (window.adminDashboard) {
        window.adminDashboard.downloadJob(jobId);
    }
}

function retryJob(jobId) {
    if (window.adminDashboard) {
        window.adminDashboard.retryJob(jobId);
    }
}

function deleteJob(jobId) {
    if (window.adminDashboard) {
        window.adminDashboard.deleteJob(jobId);
    }
}

function refreshJobsTable() {
    if (window.adminDashboard) {
        window.adminDashboard.refreshJobsTable();
    }
}

function showAllJobs() {
    if (window.adminDashboard) {
        window.adminDashboard.showAllJobs();
    }
}

function closeModal(modalId) {
    if (window.adminDashboard) {
        window.adminDashboard.closeModal(modalId);
    }
}

// Initialize admin dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize on admin pages
    if (document.querySelector('.admin-dashboard') || document.querySelector('.login-card')) {
        window.adminDashboard = new AdminDashboard();
        
        // Initialize advanced features if on dashboard page
        if (document.querySelector('.admin-dashboard')) {
            window.adminDashboard.initializeAdvancedFeatures();
        }
        
        console.log('Admin Dashboard initialized successfully');
    }
});

// Handle page unload
window.addEventListener('beforeunload', function() {
    if (window.adminDashboard) {
        window.adminDashboard.destroy();
    }
});

// Export for external use
window.AdminDashboard = AdminDashboard;
