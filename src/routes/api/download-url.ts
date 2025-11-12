// src/routes/api/download-url.ts
import type { APIEvent } from '@solidjs/start/server';
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { GetObjectCommand } from '@aws-sdk/client-s3';

// Validate env at module level
const required = ['S3_BUCKET', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'WINDOWS_INSTALLER_NAME'];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing env: ${key}`);
  }
}

const PLATFORM_PATHS = {
  'windows-x86_64': `releases/${process.env.WINDOWS_INSTALLER_NAME}`,
} as const;

export async function GET({ request }: APIEvent) { // ✅ Modern style
  console.log('✅ API Route Hit!');
  
  try {
    // ✅ Correct way to get URL in APIEvent
    const url = new URL(request.url); // ← request.url (not request.request.url)
    const platform = url.searchParams.get('platform');
    
    console.log('Requested platform:', platform);

    if (!platform || !(platform in PLATFORM_PATHS)) {
      return new Response(JSON.stringify({ 
        error: `Platform '${platform}' not supported. Available: ${Object.keys(PLATFORM_PATHS).join(', ')}` 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const s3Key = PLATFORM_PATHS[platform as keyof typeof PLATFORM_PATHS];
    const filename = s3Key.split('/').pop() || 'installer.exe';
    console.log('region: ', process.env.AWS_REGION)

    // Get signed URL (expires in 5 min)
    const s3 = new S3Client({ 
      region: process.env.AWS_REGION || 'us-east-2',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      }
    });

    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: s3Key
    });

    const signedUrl = await getSignedUrl(s3, command, { expiresIn: 300 });

    return new Response(JSON.stringify({ url: signedUrl, filename }), {
      headers: { 'Content-Type': 'application/json' }
    });
    
  } catch (err: any) {
    console.error('💥 API Error:', {
      message: err.message,
      name: err.name,
      platform: new URL(request.url).searchParams.get('platform')
    });
    
    return new Response(JSON.stringify({ 
      error: 'Download service temporarily unavailable' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}