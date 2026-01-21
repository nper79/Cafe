
/**
 * Helper to load an image from a source string.
 */
const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = src;
  });
};

/**
 * Creates a single "Contact Sheet" image containing all frames in a grid.
 * This allows the AI to see the temporal sequence and compare frames side-by-side.
 */
export const createContactSheet = async (frames: string[], columns: number = 5): Promise<string> => {
  if (frames.length === 0) return '';
  
  // Use first frame to determine aspect ratio, but force a manageable width for the grid
  // 320px is enough for the AI to see facial features like eyes, while keeping the total image size reasonable.
  const sample = await loadImage(frames[0]);
  const targetWidth = 320; 
  const scale = targetWidth / sample.width;
  const targetHeight = Math.floor(sample.height * scale);

  const rows = Math.ceil(frames.length / columns);
  
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth * columns;
  canvas.height = targetHeight * rows;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error("Canvas context failed");
  
  // Draw black background
  ctx.fillStyle = '#0f172a'; // Slate-950
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await Promise.all(frames.map(async (src, i) => {
    const img = await loadImage(src);
    const col = i % columns;
    const row = Math.floor(i / columns);
    const x = col * targetWidth;
    const y = row * targetHeight;
    
    // Draw Image
    ctx.drawImage(img, x, y, targetWidth, targetHeight);
    
    // Draw Index Number Overlay (High Contrast)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(x, y, 70, 35);
    
    ctx.fillStyle = '#facc15'; // Yellow-400
    ctx.font = 'bold 24px Arial';
    ctx.textBaseline = 'top';
    ctx.fillText(`#${i}`, x + 8, y + 6);

    // Draw border around frame
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, targetWidth, targetHeight);
  }));

  return canvas.toDataURL('image/jpeg', 0.85);
};

/**
 * Slices an image into a grid of smaller images with pixel-perfect precision.
 */
export const sliceGridImage = async (imageUrl: string, rows: number = 3, cols: number = 3): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const cellWidth = img.width / cols;
      const cellHeight = img.height / rows;
      const slicedImages: string[] = [];
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error("Could not get canvas context"));
        return;
      }
      
      canvas.width = Math.floor(cellWidth);
      canvas.height = Math.floor(cellHeight);
      
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(
            img,
            Math.round(c * cellWidth), 
            Math.round(r * cellHeight), 
            Math.round(cellWidth), 
            Math.round(cellHeight), 
            0, 0, 
            canvas.width, 
            canvas.height
          );
          slicedImages.push(canvas.toDataURL('image/png'));
        }
      }
      
      resolve(slicedImages);
    };
    img.onerror = () => reject(new Error("Failed to load image for slicing"));
    img.src = imageUrl;
  });
};

/**
 * Removes the background color (defaults to white) from an image.
 * Uses a tolerance threshold to handle compression artifacts or near-white pixels.
 */
export const removeColorBackground = async (
  base64Image: string, 
  tolerance: number = 20, 
  targetColor: {r:number, g:number, b:number} = {r: 255, g: 255, b: 255}
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      
      if (!ctx) {
        reject(new Error("Canvas context failed"));
        return;
      }
      
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Calculate distance from target color
        const diffR = Math.abs(r - targetColor.r);
        const diffG = Math.abs(g - targetColor.g);
        const diffB = Math.abs(b - targetColor.b);
        
        // If within tolerance, make transparent
        if (diffR <= tolerance && diffG <= tolerance && diffB <= tolerance) {
          data[i + 3] = 0; // Alpha to 0
        }
      }
      
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = (e) => reject(e);
    img.src = base64Image;
  });
};
