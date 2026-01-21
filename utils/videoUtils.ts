
/**
 * Extrai frames de um vídeo em intervalos regulares.
 */
export const extractFramesFromVideo = async (
  videoFile: File,
  frameCount: number,
  onProgress: (progress: number) => void
): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const videoUrl = URL.createObjectURL(videoFile);
    
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = async () => {
      const duration = video.duration;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error("Não foi possível obter o contexto do canvas"));
        return;
      }

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const frames: string[] = [];
      const interval = duration / frameCount;

      for (let i = 0; i < frameCount; i++) {
        const time = i * interval;
        video.currentTime = time;
        
        await new Promise((r) => {
          const onSeeked = () => {
            video.removeEventListener('seeked', onSeeked);
            r(true);
          };
          video.addEventListener('seeked', onSeeked);
        });

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push(canvas.toDataURL('image/png'));
        onProgress(Math.round(((i + 1) / frameCount) * 100));
      }

      URL.revokeObjectURL(videoUrl);
      resolve(frames);
    };

    video.onerror = () => reject(new Error("Erro ao carregar o ficheiro de vídeo"));
  });
};
