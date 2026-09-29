import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "../../../config/env.js";
import type {
  IStorageProvider,
  PresignedUrlResult,
  StorageFile,
  StorageProviderType,
  UploadOptions,
  UploadResult,
} from "../storage.interface.js";

/**
 * Production-grade AWS S3 Storage Provider implementing IStorageProvider.
 * Uses the official '@aws-sdk/client-s3' package for AWS cloud object storage.
 * Configured via AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.
 */
export class AwsS3StorageProvider implements IStorageProvider {
  readonly providerType: StorageProviderType = "AWS_S3";

  private readonly bucket: string;
  private readonly region: string;
  private readonly client: S3Client | null = null;

  constructor() {
    this.bucket = ENV.aws_s3_bucket || "";
    this.region = ENV.aws_region || "us-east-1";

    const accessKeyId = ENV.aws_access_key_id;
    const secretAccessKey = ENV.aws_secret_access_key;

    if (this.bucket && accessKeyId && secretAccessKey) {
      this.client = new S3Client({
        region: this.region,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    } else {
      console.warn(
        "[AwsS3StorageProvider] Warning: AWS S3 credentials not fully configured in environment."
      );
    }
  }

  async upload(file: StorageFile, options?: UploadOptions): Promise<UploadResult> {
    if (!this.bucket || !this.client) {
      throw new Error(
        "AWS S3 credentials not configured. Please define AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY."
      );
    }

    const key = `${options?.folder ? `${options.folder}/` : ""}${options?.publicId || `${Date.now()}-${file.originalname}`}`;

    // High-performance concurrent multi-part stream to AWS S3 (6 parallel streams, 5MB chunks)
    const parallelUpload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      },
      queueSize: 6,
      partSize: 5 * 1024 * 1024,
      leavePartsOnError: false,
    });

    await parallelUpload.done();

    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return {
      url,
      secureUrl: url,
      publicId: key,
      provider: "AWS_S3",
      bytes: file.size,
      format: file.mimetype.split("/")[1] || "png",
    };
  }

  async delete(publicId: string): Promise<boolean> {
    if (!this.bucket || !this.client) {
      return false;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: publicId,
      });

      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  getUrl(publicId: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${publicId}`;
  }

  /**
   * Generate S3 Presigned PUT URL for direct client-to-cloud uploads (video & large media files)
   */
  async getPresignedPutUrl(
    key: string,
    contentType: string,
    expiresInSeconds: number = 900
  ): Promise<PresignedUrlResult> {
    if (!this.bucket || !this.client) {
      throw new Error(
        "AWS S3 credentials not configured. Please define AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY."
      );
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const uploadUrl = await getSignedUrl(this.client as any, command as any, {
      expiresIn: expiresInSeconds,
    });

    const publicUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return {
      uploadUrl,
      key,
      publicUrl,
      provider: "AWS_S3",
      expiresInSeconds,
    };
  }
}
