"use client";

import { VideoUploadForm } from "@/components/VideoUploadForm";
import "@/app/styling/VideoUpload.css";

export default function VideoUploadPage() {
  return (
    <div className="video-upload-page">
      <div className="video-upload-header">
        <h1>Upload Cooking Video</h1>
        <p className="subtitle">
          Upload a cooking video (MP4) to extract ingredients and instructions using OCR.
          The video will be processed automatically.
        </p>
      </div>

      <VideoUploadForm />
    </div>
  );
}
