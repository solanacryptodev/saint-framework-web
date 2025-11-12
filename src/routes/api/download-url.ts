// src/server/api/download-url.ts
import { createHandler } from '@solidjs/start/server';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

// Config — move to env later
const BUCKET_NAME = process.env.S3_BUCKET;
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN;
const WINDOWS = process.env.WINDOWS_INSTALLER_NAME;

// Platform → S3 key mapping (match your upload paths!)
const PLATFORM_PATHS: Record<string, string> = {
  'windows-x86_64': `releases/${WINDOWS}`,
  // 'darwin-x86_64': 'releases/MyApp_1.2.0_x64.dmg',
  // 'darwin-aarch64': 'releases/MyApp_1.2.0_aarch64.dmg',
  // 'linux-x86_64': 'releases/MyApp-1.2.0.AppImage',
};

export const GET = createHandler(async (request) => {
  try {
    const url = new URL(request.request.url);
    console.log('API Route Hit - URL:', url.href);
    console.log('Environment check:', {
      hasRegion: !!process.env.AWS_REGION,
      hasAccessKey: !!process.env.AWS_ACCESS_KEY_ID,
      hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
      hasBucket: !!process.env.S3_BUCKET,
      bucketName: process.env.S3_BUCKET,
    });
    
    const platform = url.searchParams.get('platform');
    console.log('Requested platform:', platform);

    // Validate platform
    if (!platform || !PLATFORM_PATHS[platform]) {
      console.log('Invalid platform:', platform, 'Available:', Object.keys(PLATFORM_PATHS));
      return new Response(JSON.stringify({ error: 'Invalid platform' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const s3Key = PLATFORM_PATHS[platform];
    const filename = s3Key.split('/').pop() || '';
    console.log('S3 Key:', s3Key, 'Filename:', filename);

    // Get signed URL (expires in 5 min)
    const s3 = new S3Client({ 
      region: process.env.AWS_REGION || 'us-east-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    });
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    console.log('Generating signed URL...');
    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });
    console.log('Signed URL generated successfully');
    
    return new Response(JSON.stringify({ url: signedUrl, filename }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Download URL error:', err);
    const errorMessage = err instanceof Error ? err.message : 'Download unavailable';
    return new Response(JSON.stringify({ 
      error: errorMessage,
      details: err instanceof Error ? err.stack : undefined 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
