"use client";

import { useState } from "react";
import { VideoUploadForm } from "@/components/VideoUploadForm";
import { UpgradePrompt } from "@/components/UpgradePrompt";
import { useEntitlements } from "@/components/EntitlementsProvider";
import "@/app/styling/VideoUpload.css";
import "@/app/styling/UpgradePrompt.css";

export default function VideoUploadPage() {
  const { entitlements, refreshEntitlements } = useEntitlements();
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  return (
    <div className="main-panel">
      <div className="video-upload-page">
        <div className="video-upload-header">
          <h1>Paste a TikTok Cooking Clip</h1>
          <p className="subtitle">
            Paste a TikTok cooking video URL and we&apos;ll extract ingredients and
            instructions automatically for you.
            {!entitlements.isPro ? (
              <>
                {" "}
                Free: {entitlements.extractionsRemaining} of{" "}
                {entitlements.extractionsLimit} extractions left this month.
              </>
            ) : null}
          </p>
        </div>

        <VideoUploadForm
          extractionsRemaining={
            entitlements.isPro ? null : entitlements.extractionsRemaining
          }
          onExtractionBlocked={() => setUpgradeOpen(true)}
          onExtractSuccess={() => void refreshEntitlements()}
        />
      </div>
      <UpgradePrompt
        open={upgradeOpen}
        reason="extractions"
        onClose={() => setUpgradeOpen(false)}
      />
    </div>
  );
}
