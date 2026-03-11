import './GeoPanel.css';

export interface ProximityAlert {
    id: string;
    name: string;
    status: string;
    icon: 'warning' | 'info' | 'danger';
}

export interface GeoData {
    locationName: string;
    subLevel: string;
    description: string;
    imageUrl?: string;
}

export interface GeoPanelProps {
    geoData: GeoData;
    proximityScan: {
        count: number;
        alerts: ProximityAlert[];
    };
    dataCache: {
        items: Array<{
            id: string;
            icon: 'lightning' | 'shield' | 'document' | 'wifi';
            active: boolean;
        }>;
    };
}

export default function GeoPanel(props: GeoPanelProps) {
    const getAlertIcon = (type: ProximityAlert['icon']) => {
        switch (type) {
            case 'warning':
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke-width="2" />
                        <line x1="12" y1="9" x2="12" y2="13" stroke-width="2" />
                        <line x1="12" y1="17" x2="12.01" y2="17" stroke-width="2" />
                    </svg>
                );
            case 'danger':
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" stroke-width="2" />
                        <line x1="15" y1="9" x2="9" y2="15" stroke-width="2" />
                        <line x1="9" y1="9" x2="15" y2="15" stroke-width="2" />
                    </svg>
                );
            case 'info':
            default:
                return (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" stroke-width="2" />
                        <line x1="12" y1="16" x2="12" y2="12" stroke-width="2" />
                        <line x1="12" y1="8" x2="12.01" y2="8" stroke-width="2" />
                    </svg>
                );
        }
    };

    const getCacheIcon = (type: GeoPanelProps['dataCache']['items'][0]['icon']) => {
        switch (type) {
            case 'lightning':
                return (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                    </svg>
                );
            case 'shield':
                return (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke-width="2" />
                    </svg>
                );
            case 'document':
                return (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-width="2" />
                        <polyline points="14 2 14 8 20 8" stroke-width="2" />
                        <line x1="16" y1="13" x2="8" y2="13" stroke-width="2" />
                        <line x1="16" y1="17" x2="8" y2="17" stroke-width="2" />
                        <polyline points="10 9 9 9 8 9" stroke-width="2" />
                    </svg>
                );
            case 'wifi':
            default:
                return (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M5 12.55a11 11 0 0 1 14.08 0" stroke-width="2" />
                        <path d="M1.42 9a16 16 0 0 1 21.16 0" stroke-width="2" />
                        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" stroke-width="2" />
                        <line x1="12" y1="20" x2="12.01" y2="20" stroke-width="2" />
                    </svg>
                );
        }
    };

    return (
        <div class="geo-panel">
            {/* Geo Data Section */}
            <div class="geo-section">
                <div class="section-header">
                    <span>GEO_DATA</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" stroke-width="2" />
                        <circle cx="12" cy="10" r="3" stroke-width="2" />
                    </svg>
                </div>

                <div class="geo-image">
                    {props.geoData.imageUrl ? (
                        <img src={props.geoData.imageUrl} alt={props.geoData.locationName} />
                    ) : (
                        <div class="geo-image-placeholder">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke-width="2" />
                                <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" />
                                <polyline points="21 15 16 10 5 21" stroke-width="2" />
                            </svg>
                        </div>
                    )}
                </div>

                <div class="geo-info">
                    <h3 class="geo-title">{props.geoData.subLevel}</h3>
                    <p class="geo-description">{props.geoData.description}</p>
                </div>
            </div>

            {/* Divider */}
            <div class="panel-divider" />

            {/* Proximity Scan Section */}
            <div class="proximity-section">
                <div class="proximity-header">
                    <span>PROXIMITY_SCAN</span>
                    <span class="proximity-count">{props.proximityScan.count.toString().padStart(2, '0')}</span>
                </div>

                <div class="alerts-list">
                    {props.proximityScan.alerts.map((alert) => (
                        <div class={`alert-item ${alert.icon}`}>
                            <div class="alert-icon">{getAlertIcon(alert.icon)}</div>
                            <div class="alert-info">
                                <div class="alert-name">{alert.name}</div>
                                <div class="alert-status">STATUS: {alert.status}</div>
                            </div>
                            <div class="alert-indicator">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke-width="2" />
                                    <line x1="12" y1="9" x2="12" y2="13" stroke-width="2" />
                                    <line x1="12" y1="17" x2="12.01" y2="17" stroke-width="2" />
                                </svg>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Divider */}
            <div class="panel-divider" />

            {/* Data Cache Section */}
            <div class="cache-section">
                <div class="section-header">
                    <span>DATA_CACHE</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2" stroke-width="2" />
                        <line x1="8" y1="21" x2="16" y2="21" stroke-width="2" />
                        <line x1="12" y1="17" x2="12" y2="21" stroke-width="2" />
                    </svg>
                </div>

                <div class="cache-grid">
                    {props.dataCache.items.map((item) => (
                        <div class={`cache-item ${item.active ? 'active' : ''}`}>
                            {getCacheIcon(item.icon)}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
