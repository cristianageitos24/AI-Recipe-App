"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { VideoUploadForm } from "@/components/VideoUploadForm";

export function DashboardVideoExtractorPanel() {
  return (
    <section className="home-section home-section-no-top-margin">
      <motion.div
        className="home-extractor-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <div className="home-extractor-copy">
          <span className="home-extractor-label">Video Recipe Extractor</span>
          <h2 className="home-extractor-title">Recipe Clip Studio</h2>
          <p className="home-extractor-subtitle">
            Turn any cooking clip into a saved recipe in your cookbooks.
          </p>
          <p className="home-extractor-body">
            Paste a TikTok link and upload the clip to extract ingredients, steps, and save it
            straight into the cookbook that fits best.
          </p>
          <Link href="/dashboard/video-upload" className="home-extractor-link">
            Open full video tools
          </Link>
        </div>
        <div className="home-extractor-form">
          <VideoUploadForm />
        </div>
      </motion.div>
    </section>
  );
}

