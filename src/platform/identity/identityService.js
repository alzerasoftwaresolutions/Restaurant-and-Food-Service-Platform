import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { identityRepository } from '../../data/repositories/identityRepository.js';
import { config } from '../../config/appConfig.js';

const SALT_ROUNDS = 10;

/**
 * Identity & Access — Platform Service
 */
export const identityService = {
  async authenticate(identifier, password) {
    if (!identifier || !password) {
      throw new Error('Username/email and password are required');
    }

    const user = await identityRepository.findByIdentifier(identifier);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw new Error('Invalid credentials');
    }

    const roles = await identityRepository.getUserRoles(user.id);
    const roleNames = roles.map(r => r.name);

    const payload = {
      userId: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      roles: roleNames
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    });

    return {
      token,
      user: payload
    };
  },

  async verifyToken(token) {
    try {
      return jwt.verify(token, config.jwt.secret);
    } catch (err) {
      throw new Error('Invalid or expired authentication token');
    }
  },

  async createUser({ username, email, password, fullName, roles = [] }) {
    if (!username || !email || !password) {
      throw new Error('Username, email, and password are required');
    }

    const existingUser = await identityRepository.findByIdentifier(username);
    const existingEmail = await identityRepository.findByEmail(email);
    if (existingUser || existingEmail) {
      throw new Error('User with this username or email already exists');
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const userId = `usr_${randomUUID().replace(/-/g, '').slice(0, 16)}`;

    const user = await identityRepository.create({
      id: userId,
      username,
      email,
      passwordHash,
      fullName,
      isActive: 1
    });

    for (const roleName of roles) {
      const role = await identityRepository.findRoleByName(roleName);
      if (role) {
        await identityRepository.assignRole(user.id, role.id);
      }
    }

    return user;
  },

  async changePassword(userId, currentPassword, newPassword) {
    if (!currentPassword || !newPassword) {
      throw new Error('Current and new password are required');
    }
    if (newPassword.length < 8) {
      throw new Error('Password must be at least 8 characters');
    }

    const user = await identityRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      throw new Error('Current password does not match');
    }

    const newHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await identityRepository.updatePassword(userId, newHash);
    return { success: true };
  },

  async getUserProfile(userId) {
    const user = await identityRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }
    const roles = await identityRepository.getUserRoles(userId);
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.full_name,
      isActive: Boolean(user.is_active),
      roles: roles.map(r => r.name),
      createdAt: user.created_at
    };
  }
};
