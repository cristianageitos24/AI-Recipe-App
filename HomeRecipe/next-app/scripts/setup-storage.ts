#!/usr/bin/env tsx
/**
 * Setup script for Supabase Storage bucket and policies
 * Run with: npm run setup:storage
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseSecretKey) {
  console.error("Missing required environment variables:");
  console.error("  NEXT_PUBLIC_SUPABASE_URL:", supabaseUrl ? "✓" : "✗");
  console.error("  SUPABASE_SECRET_KEY:", supabaseSecretKey ? "✓" : "✗");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function setupStorage() {
  console.log("Setting up Supabase Storage for video uploads...\n");

  // Create bucket if it doesn't exist
  const bucketName = "videos";
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  
  if (listError) {
    console.error("Error listing buckets:", listError);
    process.exit(1);
  }

  const bucketExists = buckets.some((b) => b.name === bucketName);

  if (!bucketExists) {
    console.log(`Creating bucket: ${bucketName}...`);
    const { data, error } = await supabase.storage.createBucket(bucketName, {
      public: false,
      fileSizeLimit: 52428800, // 50MB
      allowedMimeTypes: ["video/mp4"],
    });

    if (error) {
      console.error("Error creating bucket:", error);
      process.exit(1);
    }
    console.log("✓ Bucket created\n");
  } else {
    console.log(`✓ Bucket '${bucketName}' already exists\n`);
  }

  // Note: Storage RLS policies need to be set up manually via SQL Editor
  // See supabase/storage-setup.md for the SQL policies
  console.log("⚠ Storage RLS policies must be set up manually.");
  console.log("   See supabase/storage-setup.md for SQL policies.\n");
  console.log("Done!");
}

setupStorage().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
