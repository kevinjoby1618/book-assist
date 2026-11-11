import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { CameraOff } from "lucide-react";
import { cn } from "@/lib/utils";

export type CameraHandle = { capture: (width?: number) => string | null };

export const Camera = forwardRef<CameraHandle, { scanning?: boolean; className?: string; mirrored?: boolean }>(
  function Camera({ scanning, className, mirrored = true }, ref) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
      let stream: MediaStream | null = null;
      navigator.mediaDevices
        ?.getUserMedia({ video: { width: 640, height: 480 } })
        .then((s) => {
          stream = s;
          if (videoRef.current) videoRef.current.srcObject = s;
        })
        .catch(() => setError("Camera access was blocked. Allow camera access and reload."));
      return () => stream?.getTracks().forEach((t) => t.stop());
    }, []);

    useImperativeHandle(ref, () => ({
      capture: (width = 512) => {
        const v = videoRef.current;
        if (!v || !v.videoWidth) return null;
        const c = document.createElement("canvas");
        c.width = width;
        c.height = Math.round((v.videoHeight / v.videoWidth) * width);
        const context = c.getContext("2d");
        if (!context) return null;
        context.drawImage(v, 0, 0, c.width, c.height);
        return c.toDataURL("image/jpeg", 0.75);
      },
    }));

    return (
      <div className={cn("relative aspect-[4/3] overflow-hidden rounded-xl bg-sidebar", scanning && "scan-line", className)}>
        {error ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sidebar-foreground">
            <CameraOff className="h-8 w-8" />
            <p className="text-sm">{error}</p>
          </div>
        ) : (
          <video ref={videoRef} autoPlay playsInline muted className={cn("h-full w-full object-cover", mirrored && "-scale-x-100")} />
        )}
      </div>
    );
  },
);
