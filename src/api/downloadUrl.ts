'use server'

// src/server/api/download-url.ts
import { createHandler } from '@solidjs/start/server';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

// Config — move to env later
const BUCKET_NAME = process.env.S3_BUCKET || 'myapp-releases-123';
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || 'd1a2b3c4d5e6f.cloudfront.net';

// Platform → S3 key mapping (match your upload paths!)
const PLATFORM_PATHS: Record<string, string> = {
  'windows-x86_64': 'releases/MyApp_1.2.0-setup.exe',
  'darwin-x86_64': 'releases/MyApp_1.2.0_x64.dmg',
  'darwin-aarch64': 'releases/MyApp_1.2.0_aarch64.dmg',
  'linux-x86_64': 'releases/MyApp-1.2.0.AppImage',
};

export const GET = createHandler(async (event) => {
  const url = new URL(event.request.url);
  const platform = url.searchParams.get('platform');

  // Validate platform
  if (!platform || !PLATFORM_PATHS[platform]) {
    return new Response(JSON.stringify({ error: 'Invalid platform' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const s3Key = PLATFORM_PATHS[platform];
  const filename = s3Key.split('/').pop() || 'MyApp-installer';

  try {
    // Get signed URL (expires in 5 min)
    const s3 = new S3Client({ 
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    });
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    const url = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min

    return new Response(JSON.stringify({ url, filename }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Download URL error:', err);
    return new Response(JSON.stringify({ error: 'Download unavailable' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
