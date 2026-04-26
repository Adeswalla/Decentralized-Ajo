"use client";

import * as React from "react";
import { Upload, X, CheckCircle, AlertCircle, File } from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";

interface FileUploadProps {
  accept?: string;
  maxSizeMB?: number;
  onFileSelect?: (file: File) => void;
  className?: string;
}

type UploadState = "idle" | "uploading" | "success" | "error";

export function FileUpload({
  accept = "image/*,application/pdf",
  maxSizeMB = 5,
  onFileSelect,
  className,
}: FileUploadProps) {
  const [state, setState] = React.useState<UploadState>("idle");
  const [progress, setProgress] = React.useState(0);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const processFile = React.useCallback(
    (file: File) => {
      setError(null);

      if (file.size > maxSizeMB * 1024 * 1024) {
        setError(`File exceeds ${maxSizeMB}MB limit`);
        setState("error");
        return;
      }

      setFileName(file.name);
      setState("uploading");
      setProgress(0);

      // Generate preview for images
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => setPreview(e.target?.result as string);
        reader.readAsDataURL(file);
      } else {
        setPreview(null);
      }

      // Simulate upload progress
      let p = 0;
      const interval = setInterval(() => {
        p += 20;
        setProgress(p);
        if (p >= 100) {
          clearInterval(interval);
          setState("success");
          onFileSelect?.(file);
        }
      }, 150);
    },
    [maxSizeMB, onFileSelect]
  );

  const handleDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const reset = () => {
    setState("idle");
    setProgress(0);
    setPreview(null);
    setFileName(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className={cn("w-full", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={handleChange}
        aria-label="File upload"
      />

      {state === "idle" || state === "error" ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload file by clicking or dragging"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" || e.key === " " ? inputRef.current?.click() : undefined}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : state === "error"
              ? "border-destructive bg-destructive/5"
              : "border-input hover:border-primary hover:bg-accent/50"
          )}
        >
          {state === "error" ? (
            <AlertCircle className="h-8 w-8 text-destructive" />
          ) : (
            <Upload className="h-8 w-8 text-muted-foreground" />
          )}
          <div className="text-center">
            <p className="text-sm font-medium">
              {isDragging ? "Drop file here" : "Click or drag to upload"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Max {maxSizeMB}MB
            </p>
          </div>
          {error && (
            <p className="text-xs text-destructive font-medium">{error}</p>
          )}
        </div>
      ) : (
        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center gap-3">
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="h-12 w-12 rounded object-cover shrink-0"
              />
            ) : (
              <File className="h-10 w-10 text-muted-foreground shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{fileName}</p>
              {state === "uploading" && (
                <p className="text-xs text-muted-foreground">{progress}%</p>
              )}
              {state === "success" && (
                <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" /> Uploaded successfully
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={reset}
              aria-label="Remove file"
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {state === "uploading" && <Progress value={progress} />}
        </div>
      )}
    </div>
  );
}
