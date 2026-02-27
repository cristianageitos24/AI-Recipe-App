"use client";

import { VideoUploadForm } from "@/components/VideoUploadForm";
import "@/app/styling/VideoUpload.css";

export default function VideoUploadPage() {
  return (
    <div className="video-upload-page">
      <div className="video-upload-header">
        <h1>Paste a TikTok Cooking Clip</h1>
        <p className="subtitle">
          Paste a TikTok cooking video URL and we&apos;ll extract ingredients and instructions
          automatically for you.
        </p>
      </div>

      <VideoUploadForm />
    </div>
  );
}
