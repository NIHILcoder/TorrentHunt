/**
 * Speed Graph Component
 * 
 * Real-time visualization of download/upload speeds over time.
 */

import React, { useEffect, useRef, useState } from 'react';
import './SpeedGraph.css';

interface SpeedDataPoint {
    timestamp: number;
    download: number;
    upload: number;
}

interface SpeedGraphProps {
    downloadSpeed: number;
    uploadSpeed: number;
    historyLength?: number; // Number of data points to keep (default: 60)
    updateInterval?: number; // Update interval in ms (default: 1000)
    height?: number;
}

const formatSpeed = (bytes: number): string => {
    if (bytes === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export const SpeedGraph: React.FC<SpeedGraphProps> = ({
    downloadSpeed,
    uploadSpeed,
    historyLength = 60,
    updateInterval = 1000,
    height = 120,
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [history, setHistory] = useState<SpeedDataPoint[]>([]);
    const speedRef = useRef({ download: downloadSpeed, upload: uploadSpeed });
    const [hoveredPoint, setHoveredPoint] = useState<{ x: number; data: SpeedDataPoint } | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Update speed ref whenever props change
    useEffect(() => {
        speedRef.current = { download: downloadSpeed, upload: uploadSpeed };
    }, [downloadSpeed, uploadSpeed]);

    // Add new data point on each update - FIXED: independent of speed changes
    useEffect(() => {
        const interval = setInterval(() => {
            setHistory(prev => {
                const newPoint: SpeedDataPoint = {
                    timestamp: Date.now(),
                    download: speedRef.current.download,
                    upload: speedRef.current.upload,
                };
                const updated = [...prev, newPoint];
                // Keep only the last N points
                return updated.slice(-historyLength);
            });
        }, updateInterval);

        return () => clearInterval(interval);
    }, [historyLength, updateInterval]); // Removed downloadSpeed, uploadSpeed from dependencies

    // Handle mouse movement for hover effect
    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!canvasRef.current || history.length < 2) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const padding = { left: 55, right: 10 };
        const graphWidth = rect.width - padding.left - padding.right;

        if (x < padding.left || x > rect.width - padding.right) {
            setHoveredPoint(null);
            return;
        }

        // Find closes data point
        const relativeX = x - padding.left;
        const index = Math.round((relativeX / graphWidth) * (history.length - 1));

        if (index >= 0 && index < history.length) {
            setHoveredPoint({ x, data: history[index] });
        }
    };

    const handleMouseLeave = () => {
        setHoveredPoint(null);
    };

    // Draw the graph
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        canvas.height = rect.height * dpr;
        ctx.scale(dpr, dpr);

        const width = rect.width;
        const graphHeight = rect.height;
        const padding = { top: 10, bottom: 20, left: 55, right: 10 };
        const graphWidth = width - padding.left - padding.right;
        const drawHeight = graphHeight - padding.top - padding.bottom;

        // Clear canvas
        ctx.clearRect(0, 0, width, graphHeight);

        // Check if light theme
        const isLightTheme = document.documentElement.getAttribute('data-theme') === 'light';
        const gridColor = isLightTheme ? 'rgba(0, 0, 0, 0.1)' : 'rgba(255, 255, 255, 0.1)';
        const labelColor = isLightTheme ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.5)';

        // Find max value for scaling with adaptive minimum
        const allSpeeds = history.length > 0 ? history.flatMap(p => [p.download, p.upload]) : [0];
        const maxSpeedInData = Math.max(...allSpeeds, 0);

        // Adaptive minimum scale based on actual data
        let minScale = 1024; // 1 KB/s default
        if (maxSpeedInData > 10 * 1024 * 1024) {
            minScale = 1024 * 1024; // 1 MB/s for high speeds
        } else if (maxSpeedInData > 1024 * 1024) {
            minScale = 100 * 1024; // 100 KB/s for medium speeds
        }

        const maxSpeed = Math.max(maxSpeedInData, minScale);

        // Smart rounding: round up to nice numbers
        let roundedMax: number;
        if (maxSpeed < 10 * 1024) {
            roundedMax = Math.ceil(maxSpeed / 1024) * 1024; // Round to nearest KB
        } else if (maxSpeed < 100 * 1024) {
            roundedMax = Math.ceil(maxSpeed / (10 * 1024)) * (10 * 1024); // Round to nearest 10 KB
        } else if (maxSpeed < 1024 * 1024) {
            roundedMax = Math.ceil(maxSpeed / (50 * 1024)) * (50 * 1024); // Round to nearest 50 KB
        } else if (maxSpeed < 10 * 1024 * 1024) {
            roundedMax = Math.ceil(maxSpeed / (1024 * 1024)) * (1024 * 1024); // Round to nearest MB
        } else {
            roundedMax = Math.ceil(maxSpeed / (5 * 1024 * 1024)) * (5 * 1024 * 1024); // Round to nearest 5 MB
        }

        // Draw grid
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;

        // Horizontal grid lines
        for (let i = 0; i <= 4; i++) {
            const y = padding.top + (drawHeight * i) / 4;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(width - padding.right, y);
            ctx.stroke();

            // Speed labels
            const speed = roundedMax * (1 - i / 4);
            ctx.fillStyle = labelColor;
            ctx.font = '10px system-ui';
            ctx.textAlign = 'right';
            ctx.fillText(formatSpeed(speed), padding.left - 5, y + 3);
        }

        // Draw lines only if we have data
        if (history.length < 2) {
            // Draw "No data" message
            ctx.fillStyle = labelColor;
            ctx.font = '12px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('Collecting data...', width / 2, graphHeight / 2);
            return;
        }

        // Check if there's any activity (not all zeros)
        const hasActivity = history.some(p => p.download > 0 || p.upload > 0);
        if (!hasActivity) {
            ctx.fillStyle = labelColor;
            ctx.font = '12px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('No activity', width / 2, graphHeight / 2);
        }

        const drawLine = (data: number[], color: string, fillOpacity: number = 0.15) => {
            if (data.length < 2) return;

            ctx.save();

            // Enable anti-aliasing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';

            ctx.beginPath();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';

            // Calculate points
            const points: [number, number][] = data.map((value, index) => {
                const x = padding.left + (index / (historyLength - 1)) * graphWidth;
                const y = padding.top + drawHeight - (value / roundedMax) * drawHeight;
                return [x, y];
            });

            // Draw smooth curve using quadratic Bézier curves
            if (points.length > 0) {
                ctx.moveTo(points[0][0], points[0][1]);

                for (let i = 1; i < points.length; i++) {
                    const prev = points[i - 1];
                    const curr = points[i];

                    if (i === 1) {
                        // First segment - just line
                        ctx.lineTo(curr[0], curr[1]);
                    } else {
                        // Smooth curve through midpoint
                        const midX = (prev[0] + curr[0]) / 2;
                        const midY = (prev[1] + curr[1]) / 2;
                        ctx.quadraticCurveTo(prev[0], prev[1], midX, midY);
                    }
                }

                // Draw last segment
                if (points.length > 1) {
                    const last = points[points.length - 1];
                    ctx.lineTo(last[0], last[1]);
                }
            }

            ctx.stroke();

            // Fill area underline
            if (points.length > 0) {
                const lastPoint = points[points.length - 1];
                const firstPoint = points[0];

                ctx.lineTo(lastPoint[0], padding.top + drawHeight);
                ctx.lineTo(firstPoint[0], padding.top + drawHeight);
                ctx.closePath();

                // Create gradient fill
                const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + drawHeight);
                const rgbaColor = color.replace('rgb', 'rgba').replace(')', `, ${fillOpacity})`);
                const rgbaColorTransparent = color.replace('rgb', 'rgba').replace(')', ', 0)');
                gradient.addColorStop(0, rgbaColor);
                gradient.addColorStop(1, rgbaColorTransparent);

                ctx.fillStyle = gradient;
                ctx.fill();
            }

            ctx.restore();
        };

        // Draw upload first (behind)
        drawLine(history.map(p => p.upload), 'rgb(251, 191, 36)', 0.2);
        // Draw download on top
        drawLine(history.map(p => p.download), 'rgb(74, 222, 128)', 0.2);

        // Draw hover indicator
        if (hoveredPoint) {
            const relativeX = hoveredPoint.x;

            // Vertical line
            ctx.strokeStyle = isLightTheme ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.beginPath();
            ctx.moveTo(relativeX, padding.top);
            ctx.lineTo(relativeX, padding.top + drawHeight);
            ctx.stroke();
            ctx.setLineDash([]);
        }

    }, [history, historyLength, hoveredPoint]);

    return (
        <div className="speed-graph expanded">
            <div className="speed-graph-header">
                <div className="speed-graph-stats">
                    <div className="speed-stat download">
                        <span className="speed-dot download" />
                        <span className="speed-label">↓</span>
                        <span className="speed-value">{formatSpeed(downloadSpeed)}</span>
                    </div>
                    <div className="speed-stat upload">
                        <span className="speed-dot upload" />
                        <span className="speed-label">↑</span>
                        <span className="speed-value">{formatSpeed(uploadSpeed)}</span>
                    </div>
                </div>
                <div className="speed-graph-legend-inline">
                    <span className="legend-item download">
                        <span className="legend-dot" /> Download
                    </span>
                    <span className="legend-item upload">
                        <span className="legend-dot" /> Upload
                    </span>
                </div>
            </div>

            <div
                ref={containerRef}
                className="speed-graph-canvas-container"
                style={{ height }}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
            >
                <canvas ref={canvasRef} className="speed-graph-canvas" />

                {hoveredPoint && (
                    <div
                        className="speed-graph-tooltip"
                        style={{
                            left: hoveredPoint.x,
                            transform: hoveredPoint.x > 200 ? 'translateX(-100%)' : 'translateX(0)',
                        }}
                    >
                        <div className="tooltip-row download">
                            <span className="tooltip-label">↓ Download:</span>
                            <span className="tooltip-value">{formatSpeed(hoveredPoint.data.download)}</span>
                        </div>
                        <div className="tooltip-row upload">
                            <span className="tooltip-label">↑ Upload:</span>
                            <span className="tooltip-value">{formatSpeed(hoveredPoint.data.upload)}</span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// export default SpeedGraph;

