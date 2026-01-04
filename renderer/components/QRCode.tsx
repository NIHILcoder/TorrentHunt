/**
 * QR Code Component
 * 
 * Generates QR code for magnet links using HTML5 Canvas.
 */

import React, { useEffect, useRef } from 'react';
import './QRCode.css';

interface QRCodeProps {
  data: string;
  size?: number;
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
}

// Simple QR code generator using qrcodegen library logic
// For production, consider using 'qrcode' npm package
// This is a simplified version that works for basic cases

export const QRCode: React.FC<QRCodeProps> = ({ 
  data, 
  size = 200,
  errorCorrectionLevel = 'M' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Generate QR code matrix
    const qrMatrix = generateQRMatrix(data, errorCorrectionLevel);
    const matrixSize = qrMatrix.length;
    
    // Calculate module size
    const moduleSize = Math.floor(size / matrixSize);
    const actualSize = moduleSize * matrixSize;
    
    // Set canvas size
    canvas.width = actualSize;
    canvas.height = actualSize;

    // Clear canvas
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, actualSize, actualSize);

    // Draw QR code
    ctx.fillStyle = '#000000';
    for (let y = 0; y < matrixSize; y++) {
      for (let x = 0; x < matrixSize; x++) {
        if (qrMatrix[y][x]) {
          ctx.fillRect(x * moduleSize, y * moduleSize, moduleSize, moduleSize);
        }
      }
    }
  }, [data, size, errorCorrectionLevel]);

  return (
    <div className="qr-code-container">
      <canvas ref={canvasRef} className="qr-code-canvas" />
    </div>
  );
};

// Simplified QR code generation
// This is a basic implementation - for production use a proper library like 'qrcode'
function generateQRMatrix(data: string, ecLevel: string): boolean[][] {
  // This is a placeholder that creates a simple pattern
  // In production, replace with proper QR code library like 'qrcode' package
  
  const size = 33; // QR Version 2
  const matrix: boolean[][] = Array(size).fill(0).map(() => Array(size).fill(false));
  
  // Create a simple data pattern (this is NOT a real QR code!)
  // For a real implementation, use the 'qrcode' npm package
  
  // Finder patterns (corners)
  drawFinderPattern(matrix, 0, 0);
  drawFinderPattern(matrix, size - 7, 0);
  drawFinderPattern(matrix, 0, size - 7);
  
  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }
  
  // Data encoding (simplified - just a pattern for demo)
  let dataIndex = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isReserved(x, y, size)) {
        matrix[y][x] = (data.charCodeAt(dataIndex % data.length) & (1 << (dataIndex % 8))) !== 0;
        dataIndex++;
      }
    }
  }
  
  return matrix;
}

function drawFinderPattern(matrix: boolean[][], startX: number, startY: number) {
  // Draw 7x7 finder pattern
  for (let y = 0; y < 7; y++) {
    for (let x = 0; x < 7; x++) {
      const shouldFill = 
        (y === 0 || y === 6 || x === 0 || x === 6) || 
        (y >= 2 && y <= 4 && x >= 2 && x <= 4);
      matrix[startY + y][startX + x] = shouldFill;
    }
  }
}

function isReserved(x: number, y: number, size: number): boolean {
  // Check if position is reserved for patterns
  const isFinderArea = 
    (x < 9 && y < 9) ||
    (x >= size - 8 && y < 9) ||
    (x < 9 && y >= size - 8);
  
  const isTimingLine = x === 6 || y === 6;
  
  return isFinderArea || isTimingLine;
}

export default QRCode;
