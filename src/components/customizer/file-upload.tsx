"use client";

import { useState } from "react";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

interface FileUploadProps {
  onUploadComplete: (url: string) => void;
  onError?: (error: string) => void;
  accept?: string;
  label?: string;
}

export default function FileUpload({
  onUploadComplete,
  onError,
  accept = "image/png,image/jpeg,image/webp",
  label = "Upload Your Design",
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      onError?.("File must be under 10MB");
      return;
    }

    setUploading(true);
    setProgress(0);

    const filename = `uploads/${Date.now()}-${file.name}`;
    const fileRef = ref(storage, filename);
    const task = uploadBytesResumable(fileRef, file);

    task.on(
      "state_changed",
      (snapshot) => {
        const pct = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(pct);
      },
      (err) => {
        setUploading(false);
        onError?.(err.message);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        setUploading(false);
        onUploadComplete(url);
      }
    );
  };

  return (
    <div className="space-y-3">
      <label className="block font-medium text-sm text-teal">{label}</label>
      <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-teal/20 rounded-2xl cursor-pointer hover:border-teal/40 transition-colors bg-white/50">
        {uploading ? (
          <div className="text-center">
            <div className="w-full bg-warm-sand rounded-full h-2 mb-2 max-w-40 mx-auto">
              <div
                className="bg-gold h-2 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-teal/50">{Math.round(progress)}%</span>
          </div>
        ) : (
          <span className="text-sm text-teal/50">Click or drag to upload</span>
        )}
        <input
          type="file"
          className="hidden"
          accept={accept}
          onChange={handleFile}
          disabled={uploading}
        />
      </label>
    </div>
  );
}
