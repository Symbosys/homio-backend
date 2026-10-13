import { ENV } from "../../config/env.js";
import { AzureBlobStorageProvider } from "./providers/azure.provider.js";
import { CloudinaryStorageProvider } from "./providers/cloudinary.provider.js";
import { AwsS3StorageProvider } from "./providers/s3.provider.js";
import type { IStorageProvider, StorageProviderType } from "./storage.interface.js";

/**
 * Storage Factory responsible for instantiating the appropriate storage provider
 * based on environment configuration (STORAGE_PROVIDER).
 *
 * Defaults to CLOUDINARY. To migrate to AWS or Azure, simply change the STORAGE_PROVIDER
 * env variable (e.g., STORAGE_PROVIDER=AWS_S3) without changing any application code.
 */
export class StorageFactory {
  private static instance: IStorageProvider;

  static getProvider(type?: StorageProviderType): IStorageProvider {
    if (this.instance && !type) {
      return this.instance;
    }

    const providerType: StorageProviderType = type || ENV.STORAGE_PROVIDER || "CLOUDINARY";

    let provider: IStorageProvider;

    switch (providerType) {
      case "AWS_S3":
        provider = new AwsS3StorageProvider();
        break;
      case "AZURE_BLOB":
        provider = new AzureBlobStorageProvider();
        break;
      case "CLOUDINARY":
      default:
        provider = new CloudinaryStorageProvider();
        break;
    }

    if (!type) {
      this.instance = provider;
    }

    return provider;
  }
}
