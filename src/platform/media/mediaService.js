import path from 'node:path';
import fs from 'node:fs';
import { randomUUID } from 'node:crypto';
import { mediaRepository } from '../../data/repositories/mediaRepository.js';
import { config } from '../../config/appConfig.js';

/**
 * Media Management — Platform Service
 */
export const mediaService = {
  async registerUploadedFile(file, { assetType = 'general', altText = null } = {}) {
    if (!file) {
      throw new Error('No file provided for upload');
    }

    if (!config.media.allowedMimeTypes.includes(file.mimetype)) {
      // Remove uploaded file from disk if invalid type
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new Error(`Unsupported media type: ${file.mimetype}. Allowed: ${config.media.allowedMimeTypes.join(', ')}`);
    }

    if (file.size > config.media.maxFileSize) {
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new Error(`File exceeds maximum size of ${config.media.maxFileSize / (1024 * 1024)}MB`);
    }

    const id = `med_${randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const relativeFilePath = `/uploads/${file.filename}`;

    return mediaRepository.create({
      id,
      originalFilename: file.originalname,
      storedFilename: file.filename,
      mimeType: file.mimetype,
      fileSizeBytes: file.size,
      filePath: relativeFilePath,
      assetType,
      altText
    });
  },

  async getMediaAsset(id) {
    const asset = await mediaRepository.findById(id);
    if (!asset) {
      throw new Error(`Media asset not found with ID: ${id}`);
    }
    return asset;
  },

  async listMediaAssets({ assetType } = {}) {
    if (assetType) {
      return mediaRepository.listByType(assetType);
    }
    return mediaRepository.listAll();
  },

  async deleteMediaAsset(id) {
    const asset = await mediaRepository.findById(id);
    if (!asset) {
      throw new Error(`Media asset not found with ID: ${id}`);
    }

    // Check usage across restaurants and menu items
    const usageCount = await mediaRepository.getAssetUsageCount(id);
    if (usageCount > 0) {
      throw new Error(`Cannot delete media asset because it is currently linked to ${usageCount} restaurant profile(s) or menu item(s).`);
    }

    // Remove file from disk
    const diskPath = path.join(config.media.uploadDir, asset.stored_filename);
    if (fs.existsSync(diskPath)) {
      try {
        fs.unlinkSync(diskPath);
      } catch (err) {
        console.warn(`[MediaService] Failed to delete file from disk: ${diskPath}`, err);
      }
    }

    await mediaRepository.delete(id);
    return { success: true, deletedId: id };
  }
};
