"use client";

import { useState, useRef, useEffect } from "react";
import { getVideoJob, type VideoJob } from "@/app/actions/video-jobs";

interface VideoUploadFormProps {
  onJobCreated?: (jobId: string) => void;
}

export function VideoUploadForm({ onJobCreated }: VideoUploadFormProps) {
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<VideoJob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "video/mp4" && !file.name.endsWith(".mp4")) {
        setError("Only MP4 files are supported");
        return;
      }
      if (file.size > 50 * 1024 * 1024) {
        setError("File size must be less than 50MB");
        return;
      }
      setVideoFile(file);
      setError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      setError("Please select a video file");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("video", videoFile);
      if (tiktokUrl.trim()) {
        formData.append("tiktokUrl", tiktokUrl.trim());
      }

      const response = await fetch("/api/video/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setJobId(data.jobId);
      setJobStatus({
        id: data.jobId,
        status: data.status,
      } as VideoJob);

      // Start polling for status
      startPolling(data.jobId);

      // Reset form
      setVideoFile(null);
      setTiktokUrl("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      onJobCreated?.(data.jobId);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const startPolling = (id: string) => {
    // Clear existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Poll every 2 seconds
    pollIntervalRef.current = setInterval(async () => {
      const result = await getVideoJob(id);
      if (result.error) {
        console.error("Failed to fetch job status:", result.error);
        return;
      }

      if (result.data) {
        setJobStatus(result.data);

        // Stop polling if job is done or error
        if (result.data.status === "done" || result.data.status === "error") {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      }
    }, 2000);
  };

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="video-upload-form">
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="tiktok-url">TikTok URL (optional)</label>
          <input
            id="tiktok-url"
            type="url"
            value={tiktokUrl}
            onChange={(e) => setTiktokUrl(e.target.value)}
            placeholder="https://www.tiktok.com/..."
            className="form-input"
            disabled={uploading}
          />
        </div>

        <div className="form-group">
          <label htmlFor="video-file">Video File (MP4, max 50MB)</label>
          <input
            id="video-file"
            ref={fileInputRef}
            type="file"
            accept="video/mp4"
            onChange={handleFileChange}
            className="form-input"
            disabled={uploading}
            required
          />
          {videoFile && (
            <p className="file-info">
              Selected: {videoFile.name} ({(videoFile.size / 1024 / 1024).toFixed(2)} MB)
            </p>
          )}
        </div>

        {error && <div className="error-message">{error}</div>}

        <button
          type="submit"
          className="submit-button"
          disabled={uploading || !videoFile}
        >
          {uploading ? "Uploading..." : "Upload Video"}
        </button>
      </form>

      {jobStatus && (
        <div className="job-status">
          <h3>Processing Status</h3>
          <div className={`status-badge status-${jobStatus.status}`}>
            {jobStatus.status.charAt(0).toUpperCase() + jobStatus.status.slice(1)}
          </div>

          {jobStatus.status === "processing" && (
            <p className="status-message">
              Processing video... This may take a few minutes.
            </p>
          )}

          {jobStatus.status === "done" && jobStatus.ocr_text && (
            <div className="ocr-result">
              <h4>Extracted Text:</h4>
              <pre className="ocr-text">{jobStatus.ocr_text}</pre>
            </div>
          )}

          {jobStatus.status === "error" && jobStatus.error_message && (
            <div className="error-message">
              <strong>Error:</strong> {jobStatus.error_message}
            </div>
          )}

          {jobStatus.processing_ms && (
            <p className="processing-time">
              Processed in {(jobStatus.processing_ms / 1000).toFixed(1)} seconds
            </p>
          )}
        </div>
      )}
    </div>
  );
}
