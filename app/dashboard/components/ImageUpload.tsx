"use client";

import { useState, useRef } from "react";
import { UploadCloud, Image as ImageIcon, X, RefreshCw } from "lucide-react";

type ImageUploadProps = {
  currentImageUrl?: string | null;
  onUploadSuccess: (mediaData: any) => void;
  className?: string;
};

export default function ImageUpload({ currentImageUrl, onUploadSuccess, className = "" }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (e.g. max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError("Ukuran gambar maksimal 5MB");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/media", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal mengunggah gambar");
      }

      onUploadSuccess(data);
      
      // Clear input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err: any) {
      setError(err.message || "Gagal mengunggah gambar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <div className="flex items-center gap-3">
        {/* Preview Container */}
        <div className="relative shrink-0 w-16 h-16 rounded-xl border border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden">
          {currentImageUrl ? (
            <img src={currentImageUrl} alt="Preview" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-6 h-6 text-slate-300" />
          )}
          
          {uploading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
              <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
            </div>
          )}
        </div>

        {/* Upload Button & Error */}
        <div className="flex-1 min-w-0">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            type="button"
            className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            <UploadCloud className="w-4 h-4 text-slate-400" />
            {uploading ? "Mengunggah..." : currentImageUrl ? "Ganti Gambar" : "Unggah Gambar"}
          </button>
          
          <p className="text-[10px] text-slate-400 mt-1.5">Maks. 5MB (JPG, PNG, WebP)</p>
          
          {error && (
            <p className="text-xs text-red-500 mt-1">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
