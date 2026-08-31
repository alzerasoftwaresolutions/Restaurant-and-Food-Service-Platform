import QRCode from 'qrcode';
import { randomUUID } from 'node:crypto';
import { qrRepository } from '../../data/repositories/qrRepository.js';
import { organizationRepository } from '../../data/repositories/organizationRepository.js';
import { config } from '../../config/appConfig.js';

/**
 * QR Publishing — Core Capability Service
 */
export const qrService = {
  async generateQRCode({ branchId, title }) {
    if (!branchId) {
      throw new Error('Branch ID is required to generate a QR code');
    }

    const branch = await organizationRepository.findBranchById(branchId);
    if (!branch) {
      throw new Error(`Branch not found with ID: ${branchId}`);
    }

    // Canonical destination URL: /menu/:branchSlug
    const canonicalDestination = `${config.publishing.publicMenuBaseUrl}/${branch.slug}`;
    const code = `QR_${branch.code}_${randomUUID().replace(/-/g, '').slice(0, 6).toUpperCase()}`;
    const qrTitle = title || `${branch.name} Digital Menu QR`;

    // Generate high-resolution PNG data URI
    const qrImageData = await QRCode.toDataURL(canonicalDestination, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 2,
      width: 512,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    const id = `qr_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    return qrRepository.create({
      id,
      branchId,
      code,
      title: qrTitle,
      destinationUrl: canonicalDestination,
      qrImageData,
      status: 'Active'
    });
  },

  async getQRCode(id) {
    const qr = await qrRepository.findById(id);
    if (!qr) {
      throw new Error(`QR code not found with ID: ${id}`);
    }
    return qr;
  },

  async getQRCodeByCode(code) {
    const qr = await qrRepository.findByCode(code);
    if (!qr) {
      throw new Error(`QR code not found with code: ${code}`);
    }
    return qr;
  },

  async listQRCodesByBranch(branchId) {
    return qrRepository.listByBranch(branchId);
  },

  async listAllQRCodes() {
    return qrRepository.listAll();
  },

  async setQRCodeStatus(id, status) {
    if (!['Active', 'Disabled', 'Expired'].includes(status)) {
      throw new Error(`Invalid QR code status: ${status}. Allowed: Active, Disabled, Expired`);
    }
    await this.getQRCode(id);
    return qrRepository.updateStatus(id, status);
  },

  async regenerateQRCode(id) {
    const qr = await this.getQRCode(id);
    const branch = await organizationRepository.findBranchById(qr.branch_id);
    if (!branch) {
      throw new Error(`Associated branch not found for QR code: ${id}`);
    }

    const canonicalDestination = `${config.publishing.publicMenuBaseUrl}/${branch.slug}`;
    const qrImageData = await QRCode.toDataURL(canonicalDestination, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      margin: 2,
      width: 512,
      color: {
        dark: '#0f172a',
        light: '#ffffff'
      }
    });

    return qrRepository.updateImageData(id, qrImageData);
  },

  async deleteQRCode(id) {
    await this.getQRCode(id);
    await qrRepository.delete(id);
    return { success: true, deletedId: id };
  },

  async resolveQRDestination(code) {
    const qr = await qrRepository.findByCode(code);
    if (!qr) {
      return {
        success: false,
        reason: 'QR_NOT_FOUND',
        message: 'The scanned QR code is invalid or does not exist.'
      };
    }

    if (qr.status === 'Disabled') {
      return {
        success: false,
        reason: 'QR_DISABLED',
        message: 'This QR code has been temporarily disabled by the restaurant.'
      };
    }

    if (qr.status === 'Expired') {
      return {
        success: false,
        reason: 'QR_EXPIRED',
        message: 'This QR code has expired.'
      };
    }

    if (qr.branch_status !== 'Active') {
      return {
        success: false,
        reason: 'BRANCH_INACTIVE',
        message: 'The branch associated with this QR code is currently inactive.'
      };
    }

    return {
      success: true,
      destinationUrl: qr.destination_url,
      branchSlug: qr.branch_slug,
      branchName: qr.branch_name
    };
  }
};
