import express from 'express';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import axios from 'axios';
import QRCode from 'qrcode';
import crypto from 'crypto';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const generatePayload = require('promptpay-qr');

const app = express();
const PORT = process.env.PORT || 3001;

// JWT Secret Key
const JWT_SECRET = '32670cc39ca9333bedb30406cc22c4bc';

// Encryption Key for Web Config (32 bytes for AES-256)
const ENCRYPTION_KEY = crypto.createHash('sha256').update('web-config-encryption-key-2025').digest();
const ENCRYPTION_IV_LENGTH = 16; // For AES, this is always 16

// Encryption functions
function encryptData(text) {
  const iv = crypto.randomBytes(ENCRYPTION_IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(JSON.stringify(text), 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptData(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = parts.join(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

// Database configuration
const dbConfig = {
  host: '210.246.215.19',
  port: 3306,
  user: 'vhouseuser',
  password: 'StrongPass123!',
  database: 'vhousespace',
  ssl: {
    rejectUnauthorized: false
  }
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // อนุญาต localhost สำหรับ dev
    if (!origin ||
      origin.startsWith('http://localhost') ||
      origin.startsWith('https://localhost')) {
      return callback(null, true);
    }

    // อนุญาตทุก subdomain ของ vhouse.online
    if (/\.vhouse\.online$/.test(origin) || origin === 'https://vhouse.online') {
      return callback(null, true);
    }

    // ไม่อนุญาต origin อื่น
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));

app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// Multi-tenant middleware - Extract subdomain and find customer_id
const multiTenantMiddleware = async (req, res, next) => {
  try {
    // Get host from request
    const host = req.get('host') || req.get('x-forwarded-host') || '';

    // Check if it's localhost first - auto use 'death'
    // This includes requests FROM localhost frontend TO external API
    const origin = req.get('origin') || '';
    if (host.includes('localhost') || origin.includes('localhost')) {
      const [sites] = await pool.execute(
        'SELECT customer_id, website_name FROM auth_sites WHERE website_name = ?',
        ['death']
      );

      if (sites.length > 0) {
        const site = sites[0];
        req.customer_id = parseInt(site.customer_id);
        req.website_name = site.website_name;
      } else {
        req.customer_id = null;
        req.website_name = null;
      }
      return next();
    }

    let subdomain = req.get('x-subdomain') || req.get('x-website-name');

    // If no custom header, try to extract from origin header
    if (!subdomain) {
      const origin = req.get('origin') || '';
      if (origin.includes('vhouse.online')) {
        // Extract subdomain from origin: https://subdomain.vhouse.online
        const originMatch = origin.match(/https?:\/\/([^.]+)\.vhouse\.online/);
        if (originMatch) {
          subdomain = originMatch[1];
        }
      }
    }

    // If still no subdomain, try to extract from host (for direct API calls)
    if (!subdomain) {
      subdomain = host.split('.')[0];
    }

    // Skip multi-tenant for main domain
    if (host === 'vhouse.online' || !subdomain || subdomain === 'www') {
      req.customer_id = null;
      req.website_name = null;
      return next();
    }

    // Debug logging for production troubleshooting
    console.log('Multi-tenant Debug:', {
      host,
      origin: req.get('origin'),
      xSubdomain: req.get('x-subdomain'),
      xWebsiteName: req.get('x-website-name'),
      extractedSubdomain: subdomain,
      userAgent: req.get('user-agent'),
      isLocalhostHost: host.includes('localhost'),
      isLocalhostOrigin: origin.includes('localhost')
    });

    // Find customer_id from auth_sites table using website_name
    const [sites] = await pool.execute(
      'SELECT customer_id, website_name FROM auth_sites WHERE website_name = ?',
      [subdomain]
    );

    if (sites.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Website not found or inactive',
        subdomain: subdomain,
        debug: {
          host,
          origin: req.get('origin'),
          xSubdomain: req.get('x-subdomain'),
          xWebsiteName: req.get('x-website-name')
        }
      });
    }

    const site = sites[0];
    req.customer_id = parseInt(site.customer_id);
    req.website_name = site.website_name;

    next();
  } catch (error) {
    console.error('Multi-tenant middleware error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
};



// Apply multi-tenant middleware to all routes
app.use(multiTenantMiddleware);

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Access token required'
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    req.user = user;
    next();
  });
};

// Role-based permission middleware
const requirePermission = (permission) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Get user's role and permissions
      const [userRoles] = await pool.execute(
        `SELECT 
          u.role,
          r.${permission}
        FROM users u
        LEFT JOIN roles r ON u.role = r.rank_name
        WHERE u.id = ?`,
        [userId]
      );

      if (userRoles.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const userRole = userRoles[0];

      // If no role found in roles table, deny access
      if (!userRole[permission]) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required permission: ${permission}`,
          user_role: userRole.role || 'member'
        });
      }

      // Check if user has the required permission
      if (!userRole[permission]) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required permission: ${permission}`,
          user_role: userRole.role
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };
};

// Helper function to check multiple permissions
const requireAnyPermission = (permissions) => {
  return async (req, res, next) => {
    try {
      const userId = req.user.id;

      // Get user's role and permissions
      const [userRoles] = await pool.execute(
        `SELECT 
          u.role,
          ${permissions.map(p => `r.${p}`).join(', ')}
        FROM users u
        LEFT JOIN roles r ON u.role = r.rank_name
        WHERE u.id = ?`,
        [userId]
      );

      if (userRoles.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      const userRole = userRoles[0];

      // Check if user has any of the required permissions
      const hasPermission = permissions.some(permission => userRole[permission]);

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: `Access denied. Required any of these permissions: ${permissions.join(', ')}`,
          user_role: userRole.role || 'member'
        });
      }

      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: error.message
      });
    }
  };
};


// Basic health check
app.get('/', (req, res) => {
  res.json({
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Signup endpoint
app.post('/signup', async (req, res) => {
  try {
    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const { fullname, email, password } = req.body;

    // Validate required fields
    if (!fullname || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Fullname, email, and password are required'
      });
    }

    // Check if user already exists for this customer
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ? AND customer_id = ?',
      [email, req.customer_id]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user with customer_id
    const [result] = await pool.execute(
      'INSERT INTO users (customer_id, fullname, email, password) VALUES (?, ?, ?, ?)',
      [req.customer_id, fullname, email, hashedPassword]
    );

    // Generate JWT token
    const token = jwt.sign(
      {
        id: result.insertId,
        email: email,
        fullname: fullname,
        customer_id: req.customer_id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      token: token,
      user: {
        id: result.insertId,
        fullname: fullname,
        email: email
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Login endpoint
app.post('/login', async (req, res) => {
  try {
    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email and customer_id
    const [users] = await pool.execute(
      'SELECT id, fullname, email, password, money, points, role FROM users WHERE email = ? AND customer_id = ?',
      [email, req.customer_id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = users[0];

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        fullname: user.fullname,
        customer_id: req.customer_id
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      token: token,
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        money: user.money,
        points: user.points,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get user profile (protected route)
app.get('/my-profile', authenticateToken, async (req, res) => {
  try {
    // Check if customer_id matches token
    if (req.user.customer_id !== req.customer_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - customer mismatch'
      });
    }

    const [users] = await pool.execute(
      'SELECT id, fullname, email, money, points, role, created_at FROM users WHERE id = ? AND customer_id = ?',
      [req.user.id, req.customer_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    res.json({
      success: true,
      message: 'Profile retrieved successfully',
      user: {
        id: user.id,
        fullname: user.fullname,
        email: user.email,
        money: user.money,
        points: user.points,
        role: user.role,
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Change password endpoint
app.put('/change-password', authenticateToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    
    // Validate input
    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุรหัสผ่านเก่าและรหัสผ่านใหม่'
      });
    }
    
    // Check password requirements
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'
      });
    }
    
    // Check if customer_id matches token
    if (req.user.customer_id !== req.customer_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - customer mismatch'
      });
    }
    
    // Get current user data with password
    const [users] = await pool.execute(
      'SELECT id, password FROM users WHERE id = ? AND customer_id = ?',
      [req.user.id, req.customer_id]
    );
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบผู้ใช้งาน'
      });
    }
    
    const user = users[0];
    
    // Verify old password
    const isValidPassword = await bcrypt.compare(oldPassword, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'รหัสผ่านเก่าไม่ถูกต้อง'
      });
    }
    
    // Hash new password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Update password
    await pool.execute(
      'UPDATE users SET password = ? WHERE id = ? AND customer_id = ?',
      [hashedPassword, req.user.id, req.customer_id]
    );
    
    res.json({
      success: true,
      message: 'เปลี่ยนรหัสผ่านสำเร็จ'
    });
    
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดภายในระบบ',
      error: error.message
    });
  }
});

// Logout endpoint (client-side token removal)
app.post('/logout', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful. Please remove token from client-side storage.'
  });
});

// Verify token endpoint
app.get('/verify-token', authenticateToken, (req, res) => {
  // Check if customer_id matches token
  if (req.user.customer_id !== req.customer_id) {
    return res.status(403).json({
      success: false,
      message: 'Access denied - customer mismatch'
    });
  }

  res.json({
    success: true,
    message: 'Token is valid',
    user: {
      id: req.user.id,
      email: req.user.email,
      fullname: req.user.fullname,
      customer_id: req.user.customer_id
    }
  });
});

// Get theme settings endpoint
app.get('/theme-settings', async (req, res) => {
  try {
    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    // Get theme settings for specific customer
    const [themes] = await pool.execute(
      'SELECT * FROM theme_settings WHERE customer_id = ? ORDER BY id LIMIT 1',
      [req.customer_id]
    );

    if (themes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No theme settings found for this customer'
      });
    }

    const theme = themes[0];

    res.json({
      success: true,
      message: 'Theme settings retrieved successfully',
      theme: {
        id: theme.id,
        primary_color: theme.primary_color,
        secondary_color: theme.secondary_color,
        background_color: theme.background_color,
        text_color: theme.text_color,
        theme_mode: theme.theme_mode,
        updated_at: theme.updated_at
      }
    });

  } catch (error) {
    console.error('Theme settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update theme settings endpoint
app.put('/update-theme-settings', authenticateToken, requirePermission('can_manage_settings'), async (req, res) => {
  try {
    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const {
      primary_color,
      secondary_color,
      background_color,
      text_color,
      theme_mode
    } = req.body;

    // Check if theme settings exist for this customer
    const [existingThemes] = await pool.execute(
      'SELECT id FROM theme_settings WHERE customer_id = ?',
      [req.customer_id]
    );

    if (existingThemes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No theme settings found for this customer. Cannot create new theme settings.'
      });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (primary_color !== undefined) {
      updateFields.push('primary_color = ?');
      updateValues.push(primary_color);
    }
    if (secondary_color !== undefined) {
      updateFields.push('secondary_color = ?');
      updateValues.push(secondary_color);
    }
    if (background_color !== undefined) {
      updateFields.push('background_color = ?');
      updateValues.push(background_color);
    }
    if (text_color !== undefined) {
      updateFields.push('text_color = ?');
      updateValues.push(text_color);
    }
    if (theme_mode !== undefined) {
      updateFields.push('theme_mode = ?');
      updateValues.push(theme_mode);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Add customer_id to the end of values array
    updateValues.push(req.customer_id);

    // Execute update
    const [result] = await pool.execute(
      `UPDATE theme_settings SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE customer_id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Theme settings not found or no changes made'
      });
    }

    // Get updated theme settings
    const [updatedThemes] = await pool.execute(
      'SELECT * FROM theme_settings WHERE customer_id = ?',
      [req.customer_id]
    );

    const updatedTheme = updatedThemes[0];

    res.json({
      success: true,
      message: 'Theme settings updated successfully',
      theme: {
        id: updatedTheme.id,
        primary_color: updatedTheme.primary_color,
        secondary_color: updatedTheme.secondary_color,
        background_color: updatedTheme.background_color,
        text_color: updatedTheme.text_color,
        theme_mode: updatedTheme.theme_mode,
        updated_at: updatedTheme.updated_at
      }
    });

  } catch (error) {
    console.error('Update theme settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

app.get('/get-web-config', async (req, res) => {
  try {
    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    // Get config for specific customer (including PromptPay fields)
    const [configs] = await pool.execute(
      `SELECT id, owner_phone, site_name, site_logo, meta_title, meta_description, 
       meta_keywords, meta_author, discord_link, discord_webhook, banner_link, 
       banner2_link, banner3_link, navigation_banner_1, navigation_link_1,
       navigation_banner_2, navigation_link_2, navigation_banner_3, navigation_link_3,
       navigation_banner_4, navigation_link_4, background_image, footer_image, load_logo, 
       footer_logo, theme, ad_banner, font_select, 
       bank_account_name, bank_account_number, bank_account_name_thai, bank_name,
       promptpay_number, promptpay_name, 
       line_cookie, line_mac, verify_token, last_check, auto_verify_enabled, review, transac, annouce_status,
       user_card, topup_card, stock_card, sell_card,
       created_at, updated_at 
       FROM config WHERE customer_id = ? ORDER BY id LIMIT 1`,
      [req.customer_id]
    );

    if (configs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No web config found for this customer'
      });
    }

    const config = configs[0];

    // Prepare config object
    const configData = {
      id: config.id,
      owner_phone: config.owner_phone,
      site_name: config.site_name,
      site_logo: config.site_logo,
      meta_title: config.meta_title,
      meta_description: config.meta_description,
      meta_keywords: config.meta_keywords,
      meta_author: config.meta_author,
      discord_link: config.discord_link,
      discord_webhook: config.discord_webhook,
      banner_link: config.banner_link,
      banner2_link: config.banner2_link,
      banner3_link: config.banner3_link,
      navigation_banner_1: config.navigation_banner_1,
      navigation_link_1: config.navigation_link_1,
      navigation_banner_2: config.navigation_banner_2,
      navigation_link_2: config.navigation_link_2,
      navigation_banner_3: config.navigation_banner_3,
      navigation_link_3: config.navigation_link_3,
      navigation_banner_4: config.navigation_banner_4,
      navigation_link_4: config.navigation_link_4,
      background_image: config.background_image,
      footer_image: config.footer_image,
      load_logo: config.load_logo,
      footer_logo: config.footer_logo,
      theme: config.theme,
      ad_banner: config.ad_banner,
      font_select: config.font_select,
      // Bank account fields
      bank_account_name: config.bank_account_name,
      bank_account_number: config.bank_account_number,
      bank_account_name_thai: config.bank_account_name_thai,
      bank_name: config.bank_name,
      // PromptPay configuration fields
      promptpay_number: config.promptpay_number,
      promptpay_name: config.promptpay_name,
      line_cookie: config.line_cookie,
      line_mac: config.line_mac,
      verify_token: config.verify_token,
      last_check: config.last_check,
      auto_verify_enabled: config.auto_verify_enabled,
      review: config.review,
      transac: config.transac,
      annouce_status: config.annouce_status,
      user_card: config.user_card,
      topup_card: config.topup_card,
      stock_card: config.stock_card,
      sell_card: config.sell_card,
      created_at: config.created_at,
      updated_at: config.updated_at
    };

    // Encrypt the config data
    const encryptedConfig = encryptData(configData);

    res.json({
      success: true,
      message: 'Web config retrieved successfully (encrypted)',
      encrypted: true,
      data: encryptedConfig
    });

  } catch (error) {
    console.error('Web config error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Decrypt web config endpoint for frontend
app.post('/decrypt-web-config', async (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({
        success: false,
        message: 'Encrypted data is required'
      });
    }

    // Decrypt the data
    const decryptedConfig = decryptData(data);

    res.json({
      success: true,
      message: 'Web config decrypted successfully',
      config: decryptedConfig
    });

  } catch (error) {
    console.error('Decrypt web config error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to decrypt data',
      error: error.message
    });
  }
});

// Update web config endpoint (excluding theme)
app.put('/update-web-config', authenticateToken, requirePermission('can_manage_settings'), async (req, res) => {
  try {
    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const {
      owner_phone,
      site_name,
      site_logo,
      meta_title,
      meta_description,
      meta_keywords,
      meta_author,
      discord_link,
      discord_webhook,
      banner_link,
      banner2_link,
      banner3_link,
      navigation_banner_1,
      navigation_link_1,
      navigation_banner_2,
      navigation_link_2,
      navigation_banner_3,
      navigation_link_3,
      navigation_banner_4,
      navigation_link_4,
      background_image,
      footer_image,
      load_logo,
      footer_logo,
      theme,
      ad_banner,
      font_select,
      // Bank account fields
      bank_account_name,
      bank_account_number,
      bank_account_name_thai,
      // PromptPay configuration fields
      promptpay_number,
      promptpay_name,
      line_cookie,
      line_mac,
      verify_token,
      auto_verify_enabled,
      review,
      transac,
      annouce_status,  // ✅ เพิ่มบรรทัดนี้
      user_card,
      topup_card,
      stock_card,
      sell_card
    } = req.body;

    // Check if config exists for this customer
    const [existingConfigs] = await pool.execute(
      'SELECT id FROM config WHERE customer_id = ?',
      [req.customer_id]
    );

    if (existingConfigs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No config found for this customer. Cannot create new config.'
      });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (owner_phone !== undefined) {
      updateFields.push('owner_phone = ?');
      updateValues.push(owner_phone);
    }
    if (site_name !== undefined) {
      updateFields.push('site_name = ?');
      updateValues.push(site_name);
    }
    if (site_logo !== undefined) {
      updateFields.push('site_logo = ?');
      updateValues.push(site_logo);
    }
    if (meta_title !== undefined) {
      updateFields.push('meta_title = ?');
      updateValues.push(meta_title);
    }
    if (meta_description !== undefined) {
      updateFields.push('meta_description = ?');
      updateValues.push(meta_description);
    }
    if (meta_keywords !== undefined) {
      updateFields.push('meta_keywords = ?');
      updateValues.push(meta_keywords);
    }
    if (meta_author !== undefined) {
      updateFields.push('meta_author = ?');
      updateValues.push(meta_author);
    }
    if (discord_link !== undefined) {
      updateFields.push('discord_link = ?');
      updateValues.push(discord_link);
    }
    if (discord_webhook !== undefined) {
      updateFields.push('discord_webhook = ?');
      updateValues.push(discord_webhook);
    }
    if (banner_link !== undefined) {
      updateFields.push('banner_link = ?');
      updateValues.push(banner_link);
    }
    if (banner2_link !== undefined) {
      updateFields.push('banner2_link = ?');
      updateValues.push(banner2_link);
    }
    if (banner3_link !== undefined) {
      updateFields.push('banner3_link = ?');
      updateValues.push(banner3_link);
    }
    if (background_image !== undefined) {
      updateFields.push('background_image = ?');
      updateValues.push(background_image);
    }
    if (footer_image !== undefined) {
      updateFields.push('footer_image = ?');
      updateValues.push(footer_image);
    }
    if (load_logo !== undefined) {
      updateFields.push('load_logo = ?');
      updateValues.push(load_logo);
    }
    if (footer_logo !== undefined) {
      updateFields.push('footer_logo = ?');
      updateValues.push(footer_logo);
    }
    if (theme !== undefined) {
      updateFields.push('theme = ?');
      updateValues.push(theme);
    }
    if (ad_banner !== undefined) {
      updateFields.push('ad_banner = ?');
      updateValues.push(ad_banner);
    }
    if (navigation_banner_1 !== undefined) {
      updateFields.push('navigation_banner_1 = ?');
      updateValues.push(navigation_banner_1);
    }
    if (navigation_link_1 !== undefined) {
      updateFields.push('navigation_link_1 = ?');
      updateValues.push(navigation_link_1);
    }
    if (navigation_banner_2 !== undefined) {
      updateFields.push('navigation_banner_2 = ?');
      updateValues.push(navigation_banner_2);
    }
    if (navigation_link_2 !== undefined) {
      updateFields.push('navigation_link_2 = ?');
      updateValues.push(navigation_link_2);
    }
    if (navigation_banner_3 !== undefined) {
      updateFields.push('navigation_banner_3 = ?');
      updateValues.push(navigation_banner_3);
    }
    if (navigation_link_3 !== undefined) {
      updateFields.push('navigation_link_3 = ?');
      updateValues.push(navigation_link_3);
    }
    if (navigation_banner_4 !== undefined) {
      updateFields.push('navigation_banner_4 = ?');
      updateValues.push(navigation_banner_4);
    }
    if (navigation_link_4 !== undefined) {
      updateFields.push('navigation_link_4 = ?');
      updateValues.push(navigation_link_4);
    }
    if (font_select !== undefined) {
      updateFields.push('font_select = ?');
      updateValues.push(font_select);
    }

    // Bank account fields
    if (bank_account_name !== undefined) {
      updateFields.push('bank_account_name = ?');
      updateValues.push(bank_account_name);
    }
    if (bank_account_number !== undefined) {
      updateFields.push('bank_account_number = ?');
      updateValues.push(bank_account_number);
    }
    if (bank_account_name_thai !== undefined) {
      updateFields.push('bank_account_name_thai = ?');
      updateValues.push(bank_account_name_thai);
    }

    // PromptPay configuration fields
    if (promptpay_number !== undefined) {
      updateFields.push('promptpay_number = ?');
      updateValues.push(promptpay_number);
    }
    if (promptpay_name !== undefined) {
      updateFields.push('promptpay_name = ?');
      updateValues.push(promptpay_name);
    }
    if (line_cookie !== undefined) {
      updateFields.push('line_cookie = ?');
      updateValues.push(line_cookie);
    }
    if (line_mac !== undefined) {
      updateFields.push('line_mac = ?');
      updateValues.push(line_mac);
    }
    if (verify_token !== undefined) {
      updateFields.push('verify_token = ?');
      updateValues.push(verify_token);
    }
    if (auto_verify_enabled !== undefined) {
      updateFields.push('auto_verify_enabled = ?');
      updateValues.push(auto_verify_enabled ? 1 : 0);
    }
    if (review !== undefined) {
      updateFields.push('review = ?');
      updateValues.push(review ? 1 : 0);
    }
    if (transac !== undefined) {
      updateFields.push('transac = ?');
      updateValues.push(transac ? 1 : 0);
    }
    // ✅ เพิ่มส่วนนี้
    if (annouce_status !== undefined) {
      updateFields.push('annouce_status = ?');
      updateValues.push(annouce_status ? 1 : 0);
    }
    if (user_card !== undefined) {
      updateFields.push('user_card = ?');
      updateValues.push(user_card ? 1 : 0);
    }
    if (topup_card !== undefined) {
      updateFields.push('topup_card = ?');
      updateValues.push(topup_card ? 1 : 0);
    }
    if (stock_card !== undefined) {
      updateFields.push('stock_card = ?');
      updateValues.push(stock_card ? 1 : 0);
    }
    if (sell_card !== undefined) {
      updateFields.push('sell_card = ?');
      updateValues.push(sell_card ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Add customer_id to the end of values array
    updateValues.push(req.customer_id);

    // Execute update
    const [result] = await pool.execute(
      `UPDATE config SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP WHERE customer_id = ?`,
      updateValues
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Config not found or no changes made'
      });
    }

    // Get updated config (✅ เพิ่ม annouce_status ใน SELECT)
    const [updatedConfigs] = await pool.execute(
      `SELECT id, owner_phone, site_name, site_logo, meta_title, meta_description, 
       meta_keywords, meta_author, discord_link, discord_webhook, banner_link, 
       banner2_link, banner3_link, navigation_banner_1, navigation_link_1,
       navigation_banner_2, navigation_link_2, navigation_banner_3, navigation_link_3,
       navigation_banner_4, navigation_link_4, background_image, footer_image, load_logo, 
       footer_logo, theme, ad_banner, font_select, 
       bank_account_name, bank_account_number, bank_account_name_thai,
       promptpay_number, promptpay_name, 
       line_cookie, line_mac, verify_token, last_check, auto_verify_enabled, review, transac, annouce_status,
       user_card, topup_card, stock_card, sell_card,
       created_at, updated_at 
       FROM config WHERE customer_id = ?`,
      [req.customer_id]
    );

    const updatedConfig = updatedConfigs[0];

    res.json({
      success: true,
      message: 'Web config updated successfully',
      config: {
        id: updatedConfig.id,
        owner_phone: updatedConfig.owner_phone,
        site_name: updatedConfig.site_name,
        site_logo: updatedConfig.site_logo,
        meta_title: updatedConfig.meta_title,
        meta_description: updatedConfig.meta_description,
        meta_keywords: updatedConfig.meta_keywords,
        meta_author: updatedConfig.meta_author,
        discord_link: updatedConfig.discord_link,
        discord_webhook: updatedConfig.discord_webhook,
        banner_link: updatedConfig.banner_link,
        banner2_link: updatedConfig.banner2_link,
        banner3_link: updatedConfig.banner3_link,
        navigation_banner_1: updatedConfig.navigation_banner_1,
        navigation_link_1: updatedConfig.navigation_link_1,
        navigation_banner_2: updatedConfig.navigation_banner_2,
        navigation_link_2: updatedConfig.navigation_link_2,
        navigation_banner_3: updatedConfig.navigation_banner_3,
        navigation_link_3: updatedConfig.navigation_link_3,
        navigation_banner_4: updatedConfig.navigation_banner_4,
        navigation_link_4: updatedConfig.navigation_link_4,
        background_image: updatedConfig.background_image,
        footer_image: updatedConfig.footer_image,
        load_logo: updatedConfig.load_logo,
        footer_logo: updatedConfig.footer_logo,
        theme: updatedConfig.theme,
        ad_banner: updatedConfig.ad_banner,
        font_select: updatedConfig.font_select,
        // Bank account fields
        bank_account_name: updatedConfig.bank_account_name,
        bank_account_number: updatedConfig.bank_account_number,
        bank_account_name_thai: updatedConfig.bank_account_name_thai,
        // PromptPay configuration fields
        promptpay_number: updatedConfig.promptpay_number,
        promptpay_name: updatedConfig.promptpay_name,
        line_cookie: updatedConfig.line_cookie,
        line_mac: updatedConfig.line_mac,
        verify_token: updatedConfig.verify_token,
        last_check: updatedConfig.last_check,
        auto_verify_enabled: updatedConfig.auto_verify_enabled,
        review: updatedConfig.review,
        transac: updatedConfig.transac,
        annouce_status: updatedConfig.annouce_status,  // ✅ เพิ่มบรรทัดนี้
        user_card: updatedConfig.user_card,
        topup_card: updatedConfig.topup_card,
        stock_card: updatedConfig.stock_card,
        sell_card: updatedConfig.sell_card,
        created_at: updatedConfig.created_at,
        updated_at: updatedConfig.updated_at
      }
    });

  } catch (error) {
    console.error('Update web config error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});



// Get categories endpoint (hierarchical structure)
app.get('/categories', async (req, res) => {
  try {
    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    // Get all categories for specific customer ordered by priority and title
    const [categories] = await pool.execute(
      'SELECT id, parent_id, title, subtitle, image, category, featured, isActive, priority, created_at FROM categories WHERE customer_id = ? AND isActive = 1 ORDER BY priority DESC, title ASC',
      [req.customer_id]
    );

    // Get product counts for each category
    const [productCounts] = await pool.execute(
      `SELECT category_id, COUNT(*) as product_count 
       FROM products 
       WHERE customer_id = ? AND isActive = 1 
       GROUP BY category_id`,
      [req.customer_id]
    );

    // Create a map of category_id -> product_count
    const productCountMap = new Map();
    productCounts.forEach(row => {
      productCountMap.set(row.category_id, row.product_count);
    });

    // Build hierarchical structure
    const categoryMap = new Map();
    const rootCategories = [];

    // First pass: create map of all categories
    categories.forEach(category => {
      categoryMap.set(category.id, {
        ...category,
        children: [],
        product_count: productCountMap.get(category.id) || 0,
        subcategory_count: 0
      });
    });

    // Second pass: build hierarchy and count subcategories
    categories.forEach(category => {
      const categoryObj = categoryMap.get(category.id);

      if (category.parent_id === null) {
        // Root category
        rootCategories.push(categoryObj);
      } else {
        // Child category
        const parent = categoryMap.get(category.parent_id);
        if (parent) {
          parent.children.push(categoryObj);
          parent.subcategory_count++;
        }
      }
    });

    res.json({
      success: true,
      message: 'Categories retrieved successfully',
      categories: rootCategories,
      total: categories.length
    });

  } catch (error) {
    console.error('Categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get flat categories endpoint (non-nested structure)
app.get('/categories/flat', async (req, res) => {
  try {
    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    // Get all categories in flat structure for specific customer ordered by priority and title
    const [categories] = await pool.execute(
      'SELECT id, parent_id, title, subtitle, image, category, featured, isActive, priority, created_at FROM categories WHERE customer_id = ? AND isActive = 1 ORDER BY priority DESC, title ASC',
      [req.customer_id]
    );

    res.json({
      success: true,
      message: 'Flat categories retrieved successfully',
      categories: categories,
      total: categories.length
    });

  } catch (error) {
    console.error('Flat categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get nested categories endpoint (hierarchical structure)
app.get('/categories/nested', async (req, res) => {
  try {
    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    // Get all categories for specific customer ordered by priority and title
    const [categories] = await pool.execute(
      'SELECT id, parent_id, title, subtitle, image, category, featured, isActive, priority, created_at FROM categories WHERE customer_id = ? AND isActive = 1 ORDER BY priority DESC, title ASC',
      [req.customer_id]
    );

    // Build hierarchical structure
    const categoryMap = new Map();
    const rootCategories = [];

    // First pass: create map of all categories
    categories.forEach(category => {
      categoryMap.set(category.id, {
        ...category,
        children: []
      });
    });

    // Second pass: build hierarchy
    categories.forEach(category => {
      const categoryObj = categoryMap.get(category.id);

      if (category.parent_id === null) {
        // Root category
        rootCategories.push(categoryObj);
      } else {
        // Child category
        const parent = categoryMap.get(category.parent_id);
        if (parent) {
          parent.children.push(categoryObj);
        }
      }
    });

    res.json({
      success: true,
      message: 'Nested categories retrieved successfully',
      categories: rootCategories,
      total: categories.length
    });

  } catch (error) {
    console.error('Nested categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get products by category ID endpoint
app.get('/categories/:categoryId/products', async (req, res) => {
  try {
    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const categoryId = req.params.categoryId;
    // Validate category ID
    if (!categoryId || isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    // Check if category exists for this customer
    const [categoryCheck] = await pool.execute(
      'SELECT id, title FROM categories WHERE id = ? AND customer_id = ? AND isActive = 1',
      [categoryId, req.customer_id]
    );

    if (categoryCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found or inactive'
      });
    }

    // Get products for the category and customer
    const [products] = await pool.execute(
      `SELECT 
        id, category_id, title, subtitle, price, reseller_price, stock, 
        duration, image, download_link, isSpecial, featured, isActive, 
        isWarrenty, warrenty_text, primary_color, secondary_color, 
        created_at, priority, discount_percent
      FROM products 
      WHERE category_id = ? AND customer_id = ? AND isActive = 1 
      ORDER BY priority DESC, title ASC`,
      [categoryId, req.customer_id]
    );

    // Calculate discounted prices for each product
    const productsWithDiscount = products.map(product => {
      const originalPrice = parseFloat(product.price);
      const discountPercent = parseInt(product.discount_percent) || 0;
      const discountedPrice = originalPrice * (1 - discountPercent / 100);

      return {
        ...product,
        original_price: originalPrice,
        discounted_price: discountedPrice,
        has_discount: discountPercent > 0,
        discount_savings: originalPrice - discountedPrice
      };
    });

    res.json({
      success: true,
      message: 'Products retrieved successfully',
      category: categoryCheck[0],
      products: productsWithDiscount,
      total: productsWithDiscount.length
    });

  } catch (error) {
    console.error('Products by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get single product by ID endpoint
app.get('/products/:productId', async (req, res) => {
  try {
    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const productId = req.params.productId;

    // Validate product ID
    if (!productId || isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required'
      });
    }

    // Get product details for specific customer
    const [products] = await pool.execute(
      `SELECT 
        p.id, p.category_id, p.title, p.subtitle, p.price, p.reseller_price, p.stock, 
        p.duration, p.image, p.download_link, p.isSpecial, p.featured, p.isActive, 
        p.isWarrenty, p.warrenty_text, p.primary_color, p.secondary_color, 
        p.created_at, p.priority, p.discount_percent,
        c.title as category_title, c.category as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.customer_id = ? AND p.isActive = 1`,
      [productId, req.customer_id]
    );

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or inactive'
      });
    }

    const product = products[0];

    // Calculate discounted price for single product
    const originalPrice = parseFloat(product.price);
    const discountPercent = parseInt(product.discount_percent) || 0;
    const discountedPrice = originalPrice * (1 - discountPercent / 100);

    res.json({
      success: true,
      message: 'Product retrieved successfully',
      product: {
        id: product.id,
        category_id: product.category_id,
        category_title: product.category_title,
        category_slug: product.category_slug,
        title: product.title,
        subtitle: product.subtitle,
        price: product.price,
        original_price: originalPrice,
        discounted_price: discountedPrice,
        has_discount: discountPercent > 0,
        discount_savings: originalPrice - discountedPrice,
        reseller_price: product.reseller_price,
        stock: product.stock,
        duration: product.duration,
        image: product.image,
        download_link: product.download_link,
        isSpecial: product.isSpecial,
        featured: product.featured,
        isActive: product.isActive,
        isWarrenty: product.isWarrenty,
        warrenty_text: product.warrenty_text,
        primary_color: product.primary_color,
        secondary_color: product.secondary_color,
        created_at: product.created_at,
        priority: product.priority,
        discount_percent: product.discount_percent
      }
    });

  } catch (error) {
    console.error('Product by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Purchase product endpoint
app.post('/purchase', authenticateToken, async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { product_id, quantity = 1 } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!product_id || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and valid quantity are required'
      });
    }

    // Get product details
    const [products] = await connection.execute(
      'SELECT id, title, price, stock, discount_percent FROM products WHERE id = ? AND isActive = 1',
      [product_id]
    );

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or inactive'
      });
    }

    const product = products[0];

    // Check if enough stock is available
    if (product.stock < quantity) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient stock available'
      });
    }

    // Get available product_stock (unsold items)
    const [availableStock] = await connection.execute(
      `SELECT id, license_key FROM product_stock WHERE product_id = ? AND sold = 0 LIMIT ${quantity}`,
      [product_id]
    );

    if (availableStock.length < quantity) {
      return res.status(400).json({
        success: false,
        message: 'สินค้าไม่พร้อมสำหรับซื้อ'
      });
    }

    // Get user's current money
    const [users] = await connection.execute(
      'SELECT money FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];

    // Calculate discounted price
    const originalPrice = parseFloat(product.price);
    const discountPercent = parseInt(product.discount_percent) || 0;
    const discountedPrice = originalPrice * (1 - discountPercent / 100);
    const totalPrice = discountedPrice * quantity;
    const totalDiscount = (originalPrice - discountedPrice) * quantity;

    // Check if user has enough money
    if (user.money < totalPrice) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance',
        required: totalPrice,
        available: user.money
      });
    }

    // Generate unique bill number
    const billNumber = `BILL-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create transaction
    const [transactionResult] = await connection.execute(
      'INSERT INTO transactions (customer_id, bill_number, user_id, total_price) VALUES (?, ?, ?, ?)',
      [req.customer_id, billNumber, userId, totalPrice]
    );

    const transactionId = transactionResult.insertId;

    // Create transaction items and update product_stock
    const transactionItems = [];
    for (let i = 0; i < quantity; i++) {
      const stockItem = availableStock[i];

      // Create transaction item
      const [itemResult] = await connection.execute(
        'INSERT INTO transaction_items (customer_id, bill_number, transaction_id, product_id, quantity, price, license_id) VALUES (?, ?, ?, ?, 1, ?, ?)',
        [req.customer_id, billNumber, transactionId, product_id, discountedPrice, stockItem.id]
      );

      // Mark stock as sold
      await connection.execute(
        'UPDATE product_stock SET sold = 1 WHERE id = ?',
        [stockItem.id]
      );

      transactionItems.push({
        id: itemResult.insertId,
        license_key: stockItem.license_key
      });
    }

    // Deduct money from user
    await connection.execute(
      'UPDATE users SET money = money - ? WHERE id = ?',
      [totalPrice, userId]
    );

    // Update product stock count by counting unsold items
    const [stockCount] = await connection.execute(
      'SELECT COUNT(*) as available_stock FROM product_stock WHERE product_id = ? AND sold = 0',
      [product_id]
    );

    await connection.execute(
      'UPDATE products SET stock = ? WHERE id = ?',
      [stockCount[0].available_stock, product_id]
    );

    await connection.commit();

    // Get Discord webhook URL, site name, and site logo from config
    const [configRows] = await connection.execute(
      'SELECT discord_webhook, site_name, site_logo FROM config WHERE customer_id = ? ORDER BY id ASC LIMIT 1',
      [req.customer_id]
    );
    const discordWebhookUrl = configRows.length > 0 ? configRows[0].discord_webhook : null;
    const siteName = configRows.length > 0 ? configRows[0].site_name : 'Backend System';
    const siteLogo = configRows.length > 0 ? configRows[0].site_logo : 'https://img2.pic.in.th/pic/logodiscordf124e71a99293428.png';

    console.log("Discord webhook debug:", {
      hasConfig: configRows.length > 0,
      webhookUrl: discordWebhookUrl ? "SET" : "NOT_SET",
      webhookUrlLength: discordWebhookUrl ? discordWebhookUrl.length : 0
    });

    // Send Discord webhook if configured
    if (discordWebhookUrl) {
      try {
        const [userInfo] = await connection.execute(
          'SELECT fullname, email FROM users WHERE id = ?',
          [userId]
        );
        const user = userInfo[0];

        // Get user's remaining money after purchase
        const [remainingMoney] = await connection.execute(
          'SELECT money FROM users WHERE id = ?',
          [userId]
        );
        const newMoney = parseFloat(remainingMoney[0].money) || 0;

        const embed = {
          title: "🛒 การซื้อสินค้าใหม่",
          color: 0x00ff00,
          fields: [
            {
              name: "📋 หมายเลขบิล",
              value: billNumber,
              inline: true
            },
            {
              name: "👤 ผู้ซื้อ",
              value: user.fullname || user.email || "ไม่ระบุ",
              inline: true
            },
            {
              name: "💰 ราคารวม",
              value: `${totalPrice.toFixed(2)} บาท`,
              inline: true
            },
            {
              name: "📦 จำนวนสินค้า",
              value: `${transactionItems.length} รายการ`,
              inline: true
            },
            {
              name: "💳 เงินคงเหลือ",
              value: `${newMoney.toFixed(2)} บาท`,
              inline: true
            },
            {
              name: "🏷️ สินค้า",
              value: product.title,
              inline: false
            }
          ],
          timestamp: new Date().toISOString(),
          footer: {
            text: siteName
          },
          thumbnail: {
            url: siteLogo
          }
        };

        const webhookPayload = {
          embeds: [embed]
        };

        const webhookResponse = await axios.post(discordWebhookUrl, webhookPayload, {
          headers: {
            'Content-Type': 'application/json',
          }
        });

        console.log('Discord webhook sent successfully');
      } catch (webhookError) {
        console.error('Discord webhook error:', webhookError);
        // Don't fail the purchase if webhook fails
      }
    }

    res.json({
      success: true,
      message: 'Purchase completed successfully',
      transaction: {
        id: transactionId,
        bill_number: billNumber,
        total_price: totalPrice,
        items: transactionItems
      },
      product: {
        id: product.id,
        title: product.title,
        original_price: originalPrice,
        discounted_price: discountedPrice,
        discount_percent: discountPercent,
        total_discount: totalDiscount,
        quantity: quantity
      },
      summary: {
        subtotal: originalPrice * quantity,
        discount_applied: totalDiscount,
        total_paid: totalPrice
      }
    });

  } catch (error) {
    await connection.rollback();
    console.error('Purchase error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// Get all products endpoint
app.get('/products', async (req, res) => {
  try {
    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const categoryId = req.query.category_id;
    let whereClause = 'p.customer_id = ? AND p.isActive = 1';
    let queryParams = [req.customer_id];

    // If category_id is provided, validate it and add to filter
    if (categoryId) {
      // Validate category ID
      if (isNaN(categoryId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category ID format'
        });
      }

      // Check if category exists for this customer
      const [categoryCheck] = await pool.execute(
        'SELECT id, title FROM categories WHERE id = ? AND customer_id = ? AND isActive = 1',
        [categoryId, req.customer_id]
      );

      if (categoryCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Category not found or inactive'
        });
      }

      // Add category filter to query
      whereClause += ' AND p.category_id = ?';
      queryParams.push(categoryId);
    }

    // Get products with category information for specific customer
    const [products] = await pool.execute(
      `SELECT 
        p.id, p.category_id, p.title, p.subtitle, p.price, p.reseller_price, p.stock, 
        p.duration, p.image, p.download_link, p.isSpecial, p.featured, p.isActive, 
        p.isWarrenty, p.warrenty_text, p.primary_color, p.secondary_color, 
        p.created_at, p.priority, p.discount_percent,
        c.title as category_title, c.category as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${whereClause}
      ORDER BY p.priority DESC, p.title ASC`,
      queryParams
    );

    // Calculate discounted prices for each product
    const productsWithDiscount = products.map(product => {
      const originalPrice = parseFloat(product.price);
      const discountPercent = parseInt(product.discount_percent) || 0;
      const discountedPrice = originalPrice * (1 - discountPercent / 100);

      return {
        ...product,
        original_price: originalPrice,
        discounted_price: discountedPrice,
        has_discount: discountPercent > 0,
        discount_savings: originalPrice - discountedPrice
      };
    });

    res.json({
      success: true,
      message: 'Products retrieved successfully',
      products: productsWithDiscount,
      total: productsWithDiscount.length,
      category_id: categoryId || null
    });

  } catch (error) {
    console.error('Products error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Search products endpoint
app.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    const categoryId = req.query.category_id;
    const customerId = req.query.customer_id || req.customer_id;

    // Validate search query
    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }

    // Validate category ID if provided
    if (categoryId && isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID format'
      });
    }

    // Validate customer ID if provided
    if (customerId && isNaN(customerId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid customer ID format'
      });
    }

    // Check if category exists for this customer (if category_id provided)
    if (categoryId && customerId) {
      const [categoryCheck] = await pool.execute(
        'SELECT id, title FROM categories WHERE id = ? AND customer_id = ? AND isActive = 1',
        [categoryId, customerId]
      );

      if (categoryCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Category not found or inactive'
        });
      }
    }

    // Build search query - if no customer_id, search all products
    let whereClause = 'p.isActive = 1 AND (p.title LIKE ? OR p.subtitle LIKE ?)';
    let queryParams = [`%${query}%`, `%${query}%`];

    // Add customer filter if customer_id is available
    if (customerId) {
      whereClause = 'p.customer_id = ? AND p.isActive = 1 AND (p.title LIKE ? OR p.subtitle LIKE ?)';
      queryParams = [customerId, `%${query}%`, `%${query}%`];
    }

    // Add category filter if provided
    if (categoryId) {
      whereClause += ' AND p.category_id = ?';
      queryParams.push(categoryId);
    }

    // Search products with category information
    const [products] = await pool.execute(
      `SELECT 
        p.id, p.category_id, p.title, p.subtitle, p.price, p.reseller_price, p.stock, 
        p.duration, p.image, p.download_link, p.isSpecial, p.featured, p.isActive, 
        p.isWarrenty, p.warrenty_text, p.primary_color, p.secondary_color, 
        p.created_at, p.priority, p.discount_percent, p.customer_id,
        c.title as category_title, c.category as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE ${whereClause}
      ORDER BY p.priority DESC, p.title ASC`,
      queryParams
    );

    // Calculate discounted prices for each product
    const productsWithDiscount = products.map(product => {
      const originalPrice = parseFloat(product.price);
      const discountPercent = parseInt(product.discount_percent) || 0;
      const discountedPrice = originalPrice * (1 - discountPercent / 100);

      return {
        ...product,
        original_price: originalPrice,
        discounted_price: discountedPrice,
        has_discount: discountPercent > 0,
        discount_savings: originalPrice - discountedPrice
      };
    });

    res.json({
      success: true,
      message: 'Search completed successfully',
      products: productsWithDiscount,
      total: productsWithDiscount.length,
      query: query,
      category_id: categoryId || null,
      customer_id: customerId || null
    });

  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});


// Get all reviews endpoint (simple select without query parameters)
app.get('/reviews/all', async (req, res) => {
  try {
    // Use customer_id from multi-tenant middleware only
    const customerId = req.customer_id;

    // Validate customer ID from multi-tenant middleware
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID not found. Please check your subdomain or website configuration.'
      });
    }

    // Check if review feature is enabled
    const [configRows] = await pool.execute(
      'SELECT review FROM config WHERE customer_id = ?',
      [customerId]
    );

    if (configRows.length === 0 || !configRows[0].review) {
      return res.status(403).json({
        success: false,
        message: 'Review feature is disabled for this store'
      });
    }

    // Get all reviews with user information (no pagination, no query parameters)
    const [reviews] = await pool.execute(
      `SELECT 
        r.id, r.customer_id, r.user_id, r.review_text, r.rating, 
        r.is_active, r.created_at, r.updated_at,
        u.fullname as user_name, u.email as user_email
      FROM reviews r
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.is_active = 1 AND r.customer_id = ?
      ORDER BY r.created_at DESC`,
      [customerId]
    );

    res.json({
      success: true,
      data: reviews,
      total: reviews.length,
      customer_id: customerId
    });

  } catch (error) {
    console.error('All reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Create review endpoint
app.post('/reviews', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const customerId = req.customer_id;
    const { review_text, rating } = req.body;

    // Check if customer_id is available
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    // Check if review feature is enabled
    const [configRows] = await pool.execute(
      'SELECT review FROM config WHERE customer_id = ?',
      [customerId]
    );

    if (configRows.length === 0 || !configRows[0].review) {
      return res.status(403).json({
        success: false,
        message: 'Review feature is disabled for this store'
      });
    }

    // Validate required fields
    if (!review_text || review_text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Review text is required'
      });
    }

    // Validate rating if provided
    if (rating && (isNaN(rating) || rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Check if user already reviewed this customer
    const [existingReview] = await pool.execute(
      'SELECT id FROM reviews WHERE customer_id = ? AND user_id = ? AND is_active = 1',
      [customerId, userId]
    );

    if (existingReview.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'You have already reviewed this store'
      });
    }

    // Create review
    const [result] = await pool.execute(
      'INSERT INTO reviews (customer_id, user_id, review_text, rating) VALUES (?, ?, ?, ?)',
      [customerId, userId, review_text.trim(), rating || null]
    );

    res.json({
      success: true,
      message: 'Review created successfully',
      review_id: result.insertId
    });

  } catch (error) {
    console.error('Create review error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update review endpoint
app.put('/reviews/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const customerId = req.customer_id;
    const reviewId = req.params.id;
    const { review_text, rating } = req.body;

    // Check if customer_id is available
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    // Check if review feature is enabled
    const [configRows] = await pool.execute(
      'SELECT review FROM config WHERE customer_id = ?',
      [customerId]
    );

    if (configRows.length === 0 || !configRows[0].review) {
      return res.status(403).json({
        success: false,
        message: 'Review feature is disabled for this store'
      });
    }

    // Validate review ID
    if (!reviewId || isNaN(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid review ID is required'
      });
    }

    // Check if review exists and belongs to user
    const [existingReview] = await pool.execute(
      'SELECT id FROM reviews WHERE id = ? AND user_id = ? AND customer_id = ? AND is_active = 1',
      [reviewId, userId, customerId]
    );

    if (existingReview.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review not found or you do not have permission to edit it'
      });
    }

    // Validate fields
    if (!review_text || review_text.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Review text is required'
      });
    }

    if (rating && (isNaN(rating) || rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5'
      });
    }

    // Update review
    await pool.execute(
      'UPDATE reviews SET review_text = ?, rating = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [review_text.trim(), rating || null, reviewId]
    );

    res.json({
      success: true,
      message: 'Review updated successfully'
    });

  } catch (error) {
    console.error('Update review error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Delete review endpoint
app.delete('/reviews/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const customerId = req.customer_id;
    const reviewId = req.params.id;

    // Check if customer_id is available
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    // Check if review feature is enabled
    const [configRows] = await pool.execute(
      'SELECT review FROM config WHERE customer_id = ?',
      [customerId]
    );

    if (configRows.length === 0 || !configRows[0].review) {
      return res.status(403).json({
        success: false,
        message: 'Review feature is disabled for this store'
      });
    }

    // Validate review ID
    if (!reviewId || isNaN(reviewId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid review ID is required'
      });
    }

    // Check if review exists and belongs to user
    const [existingReview] = await pool.execute(
      'SELECT id FROM reviews WHERE id = ? AND user_id = ? AND customer_id = ? AND is_active = 1',
      [reviewId, userId, customerId]
    );

    if (existingReview.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Review not found or you do not have permission to delete it'
      });
    }

    // Soft delete review (set is_active to 0)
    await pool.execute(
      'UPDATE reviews SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [reviewId]
    );

    res.json({
      success: true,
      message: 'Review deleted successfully'
    });

  } catch (error) {
    console.error('Delete review error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

app.get('/store/last-transactions', async (req, res) => {
  try {
    const customerId = req.customer_id;
    const limit = parseInt(req.query.limit) || 10; // Default 10 transactions

    // Validate customer ID
    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer ID not found. Please check your subdomain or website configuration.'
      });
    }

    // Check if transaction display feature is enabled
    const [configRows] = await pool.execute(
      'SELECT transac FROM config WHERE customer_id = ?',
      [customerId]
    );

    if (configRows.length === 0 || !configRows[0].transac) {
      return res.status(403).json({
        success: false,
        message: 'Transaction display feature is disabled for this store'
      });
    }

    // Validate limit
    if (isNaN(limit) || limit < 1 || limit > 100) {
      return res.status(400).json({
        success: false,
        message: 'Limit must be between 1 and 100'
      });
    }

    // Calculate max rows (already validated as number)
    const maxRows = limit * 20;

    // Get store's recent transactions with transaction items and user info
    const [transactions] = await pool.execute(
      `SELECT 
        t.id, 
        t.bill_number, 
        t.total_price, 
        t.created_at,
        u.fullname as user_name,
        u.email as user_email,
        ti.id as item_id, 
        ti.product_id, 
        ti.quantity, 
        ti.price as item_price,
        p.title as product_title, 
        p.image as product_image
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
      LEFT JOIN products p ON ti.product_id = p.id
      WHERE t.customer_id = ?
      ORDER BY t.created_at DESC, ti.id ASC
      LIMIT ${maxRows}`,
      [customerId]  // ส่งแค่ customer_id parameter เดียว
    );

    // Group transactions and their items
    const transactionMap = new Map();

    transactions.forEach(row => {
      if (!transactionMap.has(row.id)) {
        transactionMap.set(row.id, {
          id: row.id,
          bill_number: row.bill_number,
          total_price: row.total_price,
          created_at: row.created_at,
          user_name: row.user_name,
          user_email: row.user_email,
          items: []
        });
      }

      if (row.item_id) {
        transactionMap.get(row.id).items.push({
          id: row.item_id,
          product_id: row.product_id,
          product_title: row.product_title,
          product_image: row.product_image,
          quantity: row.quantity,
          price: row.item_price
        });
      }
    });

    // Convert map to array and limit to requested number
    const storeTransactions = Array.from(transactionMap.values()).slice(0, limit);

    res.json({
      success: true,
      message: 'Store transactions retrieved successfully',
      data: storeTransactions,
      total: storeTransactions.length,
      customer_id: customerId
    });

  } catch (error) {
    console.error('Store last transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get user's transactions endpoint
app.get('/my-transactions', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's transactions with transaction items
    const [transactions] = await pool.execute(
      `SELECT 
        t.id, t.bill_number, t.total_price, t.created_at,
        ti.id as item_id, ti.product_id, ti.quantity, ti.price as item_price,
        ti.license_id, ps.license_key,
        p.title as product_title, p.image as product_image, p.download_link as product_download_link
      FROM transactions t
      LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
      LEFT JOIN product_stock ps ON ti.license_id = ps.id
      LEFT JOIN products p ON ti.product_id = p.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC, ti.id ASC`,
      [userId]
    );

    // Group transactions and their items
    const transactionMap = new Map();

    transactions.forEach(row => {
      if (!transactionMap.has(row.id)) {
        transactionMap.set(row.id, {
          id: row.id,
          bill_number: row.bill_number,
          total_price: row.total_price,
          created_at: row.created_at,
          items: []
        });
      }

      if (row.item_id) {
        transactionMap.get(row.id).items.push({
          id: row.item_id,
          product_id: row.product_id,
          product_title: row.product_title,
          product_image: row.product_image,
          download_link: row.product_download_link,
          quantity: row.quantity,
          price: row.item_price,
          license_key: row.license_key
        });
      }
    });

    const userTransactions = Array.from(transactionMap.values());

    res.json({
      success: true,
      message: 'Transactions retrieved successfully',
      transactions: userTransactions,
      total: userTransactions.length
    });

  } catch (error) {
    console.error('My transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get user role permissions endpoint
app.get('/myrole', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user's role and role permissions
    const [userRoles] = await pool.execute(
      `SELECT 
        u.id, u.fullname, u.email, u.role,
        r.id as role_id, r.rank_name, 
        r.can_edit_categories, r.can_edit_products, r.can_edit_users, 
        r.can_edit_orders, r.can_manage_keys, r.can_view_reports, 
        r.can_manage_promotions, r.can_manage_settings, r.can_access_reseller_price
      FROM users u
      LEFT JOIN roles r ON u.role = r.rank_name
      WHERE u.id = ?`,
      [userId]
    );

    if (userRoles.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userRole = userRoles[0];

    // If no role found in roles table, return default member permissions
    if (!userRole.role_id) {
      return res.json({
        success: true,
        message: 'User role permissions retrieved successfully',
        user: {
          id: userRole.id,
          fullname: userRole.fullname,
          email: userRole.email,
          role: userRole.role || 'member'
        },
        permissions: {
          can_edit_categories: false,
          can_edit_products: false,
          can_edit_users: false,
          can_edit_orders: false,
          can_manage_keys: false,
          can_view_reports: false,
          can_manage_promotions: false,
          can_manage_settings: false,
          can_access_reseller_price: false
        },
        role_info: {
          id: null,
          rank_name: userRole.role || 'member',
          description: 'Default member role with basic permissions'
        }
      });
    }

    // Return role permissions
    res.json({
      success: true,
      message: 'User role permissions retrieved successfully',
      user: {
        id: userRole.id,
        fullname: userRole.fullname,
        email: userRole.email,
        role: userRole.role
      },
      permissions: {
        can_edit_categories: Boolean(userRole.can_edit_categories),
        can_edit_products: Boolean(userRole.can_edit_products),
        can_edit_users: Boolean(userRole.can_edit_users),
        can_edit_orders: Boolean(userRole.can_edit_orders),
        can_manage_keys: Boolean(userRole.can_manage_keys),
        can_view_reports: Boolean(userRole.can_view_reports),
        can_manage_promotions: Boolean(userRole.can_manage_promotions),
        can_manage_settings: Boolean(userRole.can_manage_settings),
        can_access_reseller_price: Boolean(userRole.can_access_reseller_price)
      },
      role_info: {
        id: userRole.role_id,
        rank_name: userRole.rank_name,
        description: `Role: ${userRole.rank_name} with specific permissions`
      }
    });

  } catch (error) {
    console.error('My role error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all roles endpoint (admin only)
app.get('/roles', authenticateToken, requirePermission('can_edit_users'), async (req, res) => {
  try {
    const [roles] = await pool.execute(
      'SELECT * FROM roles WHERE customer_id = ? ORDER BY id ASC',
      [req.customer_id]
    );

    res.json({
      success: true,
      message: 'Roles retrieved successfully',
      roles: roles
    });

  } catch (error) {
    console.error('Roles error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update user role endpoint (admin only)
app.put('/users/:userId/role', authenticateToken, requirePermission('can_edit_users'), async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // Validate required fields
    if (!role) {
      return res.status(400).json({
        success: false,
        message: 'Role is required'
      });
    }

    // Check if role exists
    const [roleCheck] = await pool.execute(
      'SELECT id FROM roles WHERE rank_name = ?',
      [role]
    );

    if (roleCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Available roles: member, moderator, admin, super_admin, reseller'
      });
    }

    // Check if user exists
    const [userCheck] = await pool.execute(
      'SELECT id, fullname, email FROM users WHERE id = ?',
      [userId]
    );

    if (userCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update user role
    await pool.execute(
      'UPDATE users SET role = ? WHERE id = ?',
      [role, userId]
    );

    res.json({
      success: true,
      message: 'User role updated successfully',
      user: {
        id: userCheck[0].id,
        fullname: userCheck[0].fullname,
        email: userCheck[0].email,
        role: role
      }
    });

  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Example protected endpoint that requires specific permission
app.get('/admin/dashboard', authenticateToken, requirePermission('can_view_reports'), async (req, res) => {
  try {
    // This endpoint is only accessible to users with can_view_reports permission
    const [stats] = await pool.execute(
      `SELECT 
        (SELECT COUNT(*) FROM users) as total_users,
        (SELECT COUNT(*) FROM products) as total_products,
        (SELECT COUNT(*) FROM transactions) as total_transactions,
        (SELECT SUM(total_price) FROM transactions) as total_revenue`
    );

    res.json({
      success: true,
      message: 'Admin dashboard data retrieved successfully',
      dashboard: {
        total_users: stats[0].total_users,
        total_products: stats[0].total_products,
        total_transactions: stats[0].total_transactions,
        total_revenue: stats[0].total_revenue || 0
      }
    });

  } catch (error) {
    console.error('Admin dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get statistics endpoint
app.get('/get-stats', async (req, res) => {
  try {
    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    // Check database connection status
    let dbStatus = '24/7';
    let dbMessage = 'Database is running normally';

    try {
      // Test database connection
      await pool.execute('SELECT 1');
    } catch (dbError) {
      dbStatus = 'อยู่ระหว่างปรับปรุง';
      dbMessage = 'Database connection failed';
      console.error('Database connection error:', dbError);
    }

    // Get total users count for specific customer
    const [userCountResult] = await pool.execute(
      'SELECT COUNT(*) as total_users FROM users WHERE customer_id = ?',
      [req.customer_id]
    );
    const totalUsers = userCountResult[0].total_users;

    // Get total sold items count (from transaction_items) for specific customer
    const [soldItemsResult] = await pool.execute(
      'SELECT COUNT(*) as total_sold FROM transaction_items WHERE customer_id = ?',
      [req.customer_id]
    );
    const totalSoldItems = soldItemsResult[0].total_sold;

    // Get unsold product stock count for specific customer
    const [unsoldStockResult] = await pool.execute(
      'SELECT COUNT(*) as total_unsold FROM product_stock WHERE customer_id = ? AND sold = 0',
      [req.customer_id]
    );
    const totalUnsoldStock = unsoldStockResult[0].total_unsold;

    res.json({
      success: true,
      message: 'Statistics retrieved successfully',
      stats: {
        total_users: totalUsers,
        total_sold_items: totalSoldItems,
        total_unsold_stock: totalUnsoldStock,
        database_status: {
          status: dbStatus,
          message: dbMessage,
          timestamp: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message,
      stats: {
        total_users: 0,
        total_sold_items: 0,
        total_unsold_stock: 0,
        database_status: {
          status: 'อยู่ระหว่างปรับปรุง',
          message: 'Unable to retrieve statistics',
          timestamp: new Date().toISOString()
        }
      }
    });
  }
});

// Get expired day endpoint
app.get('/getexpiredday', async (req, res) => {
  try {
    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    // Get expired day from auth_sites table for this customer
    const [sites] = await pool.execute(
      'SELECT expiredDay FROM auth_sites WHERE customer_id = ? ORDER BY id ASC LIMIT 1',
      [req.customer_id]
    );

    if (sites.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูลวันหมดอายุสำหรับลูกค้านี้'
      });
    }

    const expiredDay = sites[0].expiredDay;

    res.json({
      success: true,
      message: 'ดึงข้อมูลวันหมดอายุสำเร็จ',
      expiredDay: expiredDay,
      customer_id: req.customer_id
    });

  } catch (error) {
    console.error('Get expired day error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Check customer status and expiry endpoint
app.get('/check-customer-status', async (req, res) => {
  try {
    // Check if customer_id is available from multitenant middleware
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'ไม่มีข้อมูล customer_id',
        status: 'no_customer_id'
      });
    }

    // Get customer info and expired day from auth_sites table
    const [sites] = await pool.execute(
      'SELECT customer_id, website_name, expiredDay FROM auth_sites WHERE customer_id = ? ORDER BY id ASC LIMIT 1',
      [req.customer_id]
    );

    if (sites.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบข้อมูล customer_id',
        status: 'customer_not_found'
      });
    }

    const site = sites[0];
    const expiredDay = new Date(site.expiredDay);
    const currentDate = new Date();

    // Reset time to compare only dates
    currentDate.setHours(0, 0, 0, 0);
    expiredDay.setHours(0, 0, 0, 0);

    // Check if expired
    if (currentDate > expiredDay) {
      return res.json({
        success: true,
        message: 'หมดอายุ',
        status: 'expired',
        customer_id: req.customer_id,
        website_name: site.website_name,
        expiredDay: site.expiredDay,
        currentDate: currentDate.toISOString().split('T')[0],
        expiredDate: expiredDay.toISOString().split('T')[0]
      });
    }

    // Still valid
    return res.json({
      success: true,
      message: 'ยังไม่หมดอายุ',
      status: 'active',
      customer_id: req.customer_id,
      website_name: site.website_name,
      expiredDay: site.expiredDay,
      currentDate: currentDate.toISOString().split('T')[0],
      expiredDate: expiredDay.toISOString().split('T')[0]
    });

  } catch (error) {
    console.error('Check customer status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Redeem angpao endpoint
app.post('/redeem-angpao', authenticateToken, async (req, res) => {
  try {
    // Check if customer_id matches token
    if (req.user.customer_id !== req.customer_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - customer mismatch'
      });
    }

    const { link } = req.body;

    if (!link) {
      return res.status(400).json({ success: false, error: 'กรุณาระบุ link' });
    }

    // ดึงเบอร์โทรจากตาราง config สำหรับ customer นี้
    const [configRows] = await pool.execute(
      'SELECT owner_phone FROM config WHERE customer_id = ? ORDER BY id ASC LIMIT 1',
      [req.customer_id]
    );

    if (!configRows.length) {
      return res.status(400).json({ success: false, error: 'ไม่พบเบอร์โทรในตาราง config' });
    }

    const phone = configRows[0].owner_phone;

    // ดึงข้อมูลผู้ใช้ปัจจุบัน
    const [user] = await pool.execute(
      "SELECT id, money FROM users WHERE id = ? AND customer_id = ?",
      [req.user.id, req.customer_id]
    );

    if (user.length === 0) {
      return res.status(404).json({ success: false, error: 'ไม่พบผู้ใช้' });
    }

    // ดึง campaign ID จาก link
    let campaignId = link;

    if (link.includes('gift.truemoney.com/campaign/?v=')) {
      const urlParams = new URL(link).searchParams;
      campaignId = urlParams.get('v');
    } else if (link.includes('v=')) {
      const match = link.match(/[?&]v=([^&]+)/);
      if (match) {
        campaignId = match[1];
      }
    }

    if (!campaignId) {
      return res.status(400).json({ success: false, error: 'ไม่พบ campaign ID ในลิงก์' });
    }

    // เรียก API TrueMoney พร้อม retry
    let data;
    let lastError;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Calling TrueMoney API (attempt ${attempt}/${maxRetries}): https://api.xpluem.com/${campaignId}/${phone}`);

        const response = await axios.get(`https://api.xpluem.com/${campaignId}/${phone}`, {
          timeout: 15000, // เพิ่ม timeout เป็น 15 วินาที
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/json',
            'Cache-Control': 'no-cache'
          },
          validateStatus: function (status) {
            return status < 500; // รับ status code น้อยกว่า 500
          }
        });

        data = response.data;
        console.log(`TrueMoney API Response (attempt ${attempt}):`, data);

        // ถ้าได้ response แล้วให้ break ออกจาก loop
        break;

      } catch (error) {
        lastError = error;
        console.error(`TrueMoney API attempt ${attempt} failed:`, error.message);

        // ถ้าเป็น attempt สุดท้ายให้ throw error
        if (attempt === maxRetries) {
          throw error;
        }

        // รอ 2 วินาทีก่อนลองใหม่
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // ตรวจสอบ response data
      if (!data) {
        throw new Error('ไม่ได้รับข้อมูลจาก API');
      }

      const amount = data.data ? parseFloat(data.data.amount) : 0;
      const status = data.success ? 'success' : 'failed';

      // ตรวจสอบจำนวนเงิน
      if (amount <= 0) {
        throw new Error('จำนวนเงินไม่ถูกต้อง');
      }

      // ตรวจสอบว่ามีการเติมเงินซ้ำหรือไม่ (ตรวจสอบ campaign ID ใน 24 ชั่วโมงที่ผ่านมา)
      const [existingTopup] = await connection.execute(
        'SELECT id FROM topups WHERE user_id = ? AND customer_id = ? AND transaction_ref = ? AND created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)',
        [req.user.id, req.customer_id, `Campaign: ${campaignId}`]
      );

      if (existingTopup.length > 0) {
        throw new Error('ลิงก์นี้ถูกใช้แล้วใน 24 ชั่วโมงที่ผ่านมา');
      }

      // บันทึกลงตาราง topups
      const [topupResult] = await connection.execute(
        'INSERT INTO topups (customer_id, user_id, amount, method, transaction_ref, status) VALUES (?, ?, ?, ?, ?, ?)',
        [req.customer_id, req.user.id, amount, 'gift_card', `Campaign: ${campaignId}`, status]
      );

      // ถ้าสำเร็จ ให้บวกเงิน
      if (data.success && (data.message === 'รับเงินสำเร็จ' || data.message === 'success')) {
        const newMoney = parseFloat(user[0].money) + amount;

        // อัปเดตเงินผู้ใช้
        const [updateResult] = await connection.execute(
          'UPDATE users SET money = ? WHERE id = ? AND customer_id = ?',
          [newMoney, req.user.id, req.customer_id]
        );

        if (updateResult.affectedRows === 0) {
          throw new Error('ไม่สามารถอัปเดตเงินผู้ใช้ได้');
        }

        // อัปเดตสถานะ topup เป็น success
        await connection.execute(
          'UPDATE topups SET status = ? WHERE id = ?',
          ['success', topupResult.insertId]
        );

        await connection.commit();

        console.log(`Topup successful: Customer ${req.customer_id}, User ${req.user.id}, Amount: ${amount}, New Balance: ${newMoney}`);

        res.json({
          success: true,
          message: `เติมเงินสำเร็จ: +${amount} บาท`,
          amount: amount,
          new_balance: newMoney,
          topup_id: topupResult.insertId,
          campaign_id: campaignId
        });
      } else {
        // อัปเดตสถานะ topup เป็น failed
        await connection.execute(
          'UPDATE topups SET status = ? WHERE id = ?',
          ['failed', topupResult.insertId]
        );

        await connection.commit();

        console.log(`Topup failed: Customer ${req.customer_id}, User ${req.user.id}, Campaign: ${campaignId}, Message: ${data.message}`);

        res.json({
          success: false,
          message: data.message || 'การเติมเงินไม่สำเร็จ',
          amount: amount,
          topup_id: topupResult.insertId,
          campaign_id: campaignId
        });
      }

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (err) {
    console.error('Redeem angpao error:', err);

    // กรณีเรียก API ล้มเหลว
    if (err.response) {
      console.error('API Error Details:', {
        status: err.response.status,
        statusText: err.response.statusText,
        data: err.response.data,
        url: err.config?.url,
        user_id: req.user?.id,
        customer_id: req.customer_id,
        campaign_id: campaignId
      });

      let errorMessage = 'ไม่สามารถเชื่อมต่อ API ได้';

      if (err.response.status === 500) {
        errorMessage = 'API เกิดข้อผิดพลาดภายใน (500) - อาจเป็นเพราะ campaign ID ไม่ถูกต้องหรือ API มีปัญหา';
      } else if (err.response.status === 404) {
        errorMessage = 'ไม่พบ campaign ID ที่ระบุ - ลิงก์อาจหมดอายุหรือไม่ถูกต้อง';
      } else if (err.response.status === 400) {
        errorMessage = 'ข้อมูลที่ส่งไปไม่ถูกต้อง - ตรวจสอบลิงก์และเบอร์โทร';
      } else if (err.response.status === 403) {
        errorMessage = 'ไม่มีสิทธิ์เข้าถึง API - ลิงก์อาจถูกใช้แล้ว';
      } else if (err.response.status === 429) {
        errorMessage = 'เรียก API เกินขีดจำกัด - กรุณารอสักครู่แล้วลองใหม่';
      }

      return res.status(500).json({
        success: false,
        error: errorMessage,
        details: {
          status: err.response.status,
          message: err.response.data?.message || err.response.statusText,
          campaign_id: campaignId
        }
      });
    }

    // กรณี timeout หรือ network error
    if (err.code === 'ECONNABORTED') {
      return res.status(500).json({
        success: false,
        error: 'การเชื่อมต่อ API หมดเวลา - กรุณาลองใหม่อีกครั้ง',
        details: {
          code: err.code,
          campaign_id: campaignId
        }
      });
    }

    if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') {
      return res.status(500).json({
        success: false,
        error: 'ไม่สามารถเชื่อมต่อ API ได้ - ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
        details: {
          code: err.code,
          campaign_id: campaignId
        }
      });
    }

    // กรณี error อื่นๆ
    res.status(500).json({
      success: false,
      error: err.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
      details: {
        message: err.message,
        campaign_id: campaignId,
        user_id: req.user?.id,
        customer_id: req.customer_id
      }
    });
  }
});






// ==================== PRODUCT MANAGEMENT API ====================

// Get all products for admin (including inactive ones)
app.get('/admin/products', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const {
      includeInactive = false,
      categoryId = null,
      page = 1,
      limit = 50,
      search = '',
      sortBy = 'priority',
      sortOrder = 'desc'
    } = req.query;

    // Parse and validate pagination parameters
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 50;

    // Build base query
    let query = `
      SELECT 
        p.id, p.category_id, p.title, p.subtitle, p.price, p.reseller_price, 
        p.stock, p.duration, p.image, p.download_link, p.isSpecial, p.featured, 
        p.isActive, p.isWarrenty, p.warrenty_text, p.primary_color, p.secondary_color, 
        p.created_at, p.priority, p.discount_percent, p.customer_id,
        c.title as category_title, c.category as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.customer_id = ?
    `;

    const queryParams = [req.customer_id];

    // Add filters
    if (!includeInactive || includeInactive === 'false') {
      query += ' AND p.isActive = 1';
    }

    if (categoryId && !isNaN(categoryId)) {
      // Validate that category exists for this customer
      const [categoryCheck] = await pool.execute(
        'SELECT id, title FROM categories WHERE id = ? AND customer_id = ? AND isActive = 1',
        [parseInt(categoryId), req.customer_id]
      );

      if (categoryCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Category not found or inactive'
        });
      }

      query += ' AND p.category_id = ?';
      queryParams.push(parseInt(categoryId));
    }

    if (search && search.trim() !== '') {
      query += ' AND (p.title LIKE ? OR p.subtitle LIKE ? OR c.title LIKE ?)';
      const searchPattern = `%${search.trim()}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    // Add sorting
    const validSortFields = ['priority', 'title', 'price', 'stock', 'created_at', 'category_title'];
    const validSortOrders = ['asc', 'desc'];

    const sortField = validSortFields.includes(sortBy) ? sortBy : 'priority';
    const sortDirection = validSortOrders.includes(sortOrder.toLowerCase()) ? sortOrder.toUpperCase() : 'DESC';

    if (sortField === 'category_title') {
      query += ` ORDER BY c.title ${sortDirection}, p.title ASC`;
    } else {
      query += ` ORDER BY p.${sortField} ${sortDirection}, p.title ASC`;
    }

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.customer_id = ?
    `;
    const countParams = [req.customer_id];

    if (!includeInactive || includeInactive === 'false') {
      countQuery += ' AND p.isActive = 1';
    }

    if (categoryId && !isNaN(categoryId)) {
      countQuery += ' AND p.category_id = ?';
      countParams.push(parseInt(categoryId));
    }

    if (search && search.trim() !== '') {
      countQuery += ' AND (p.title LIKE ? OR p.subtitle LIKE ? OR c.title LIKE ?)';
      const searchPattern = `%${search.trim()}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
    }

    // Add pagination
    if (parsedLimit && parsedLimit > 0) {
      const offset = (parsedPage - 1) * parsedLimit;
      query += ` LIMIT ${parsedLimit} OFFSET ${offset}`;
      // Note: Using direct substitution instead of placeholders for LIMIT/OFFSET
      // because some MySQL2 versions have issues with prepared statements + LIMIT/OFFSET
    }

    // Debug logging
    console.log('Admin Products Query Debug:', {
      customer_id: req.customer_id,
      queryParams: queryParams,
      countParams: countParams,
      query: query,
      countQuery: countQuery,
      query_placeholders: (query.match(/\?/g) || []).length,
      countQuery_placeholders: (countQuery.match(/\?/g) || []).length
    });

    // Execute queries
    const [products] = await pool.execute(query, queryParams);
    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      message: 'Products retrieved successfully',
      products: products,
      total: total,
      page: parsedPage,
      limit: parsedLimit,
      totalPages: Math.ceil(total / parsedLimit),
      filters: {
        includeInactive: includeInactive === 'true',
        categoryId: categoryId ? parseInt(categoryId) : null,
        search: search,
        sortBy: sortField,
        sortOrder: sortDirection.toLowerCase()
      }
    });

  } catch (error) {
    console.error('Admin products error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get single product for admin
app.get('/admin/products/:productId', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const { productId } = req.params;

    // Validate product ID
    if (!productId || isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required'
      });
    }

    // Get product details
    const [products] = await pool.execute(
      `SELECT 
        p.id, p.category_id, p.title, p.subtitle, p.price, p.reseller_price, 
        p.stock, p.duration, p.image, p.download_link, p.isSpecial, p.featured, 
        p.isActive, p.isWarrenty, p.warrenty_text, p.primary_color, p.secondary_color, 
        p.created_at, p.priority, p.discount_percent, p.customer_id,
        c.title as category_title, c.category as category_slug, c.parent_id as category_parent_id
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.customer_id = ?`,
      [productId, req.customer_id]
    );

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const product = products[0];

    // Get category hierarchy if category exists
    if (product.category_id) {
      const categoryHierarchy = [];
      let currentCategoryId = product.category_id;

      // Build category hierarchy (breadcrumb)
      while (currentCategoryId) {
        const [categoryInfo] = await pool.execute(
          'SELECT id, title, parent_id FROM categories WHERE id = ? AND customer_id = ?',
          [currentCategoryId, req.customer_id]
        );

        if (categoryInfo.length > 0) {
          categoryHierarchy.unshift(categoryInfo[0]);
          currentCategoryId = categoryInfo[0].parent_id;
        } else {
          break;
        }
      }

      product.category_hierarchy = categoryHierarchy;
    }

    res.json({
      success: true,
      message: 'Product retrieved successfully',
      product: product
    });

  } catch (error) {
    console.error('Admin product detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get products by category for admin
app.get('/admin/categories/:categoryId/products', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const { categoryId } = req.params;
    const {
      includeInactive = false,
      page = 1,
      limit = 50
    } = req.query;

    // Validate category ID
    if (!categoryId || isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    // Check if category exists for this customer
    const [categoryCheck] = await pool.execute(
      'SELECT id, title FROM categories WHERE id = ? AND customer_id = ?',
      [categoryId, req.customer_id]
    );

    if (categoryCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // Build query
    let query = `
      SELECT 
        p.id, p.category_id, p.title, p.subtitle, p.price, p.reseller_price, 
        p.stock, p.duration, p.image, p.download_link, p.isSpecial, p.featured, 
        p.isActive, p.isWarrenty, p.warrenty_text, p.primary_color, p.secondary_color, 
        p.created_at, p.priority, p.discount_percent,
        c.title as category_title, c.category as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.category_id = ? AND p.customer_id = ?
    `;

    const queryParams = [categoryId, req.customer_id];

    if (!includeInactive || includeInactive === 'false') {
      query += ' AND p.isActive = 1';
    }

    query += ' ORDER BY p.priority DESC, p.title ASC';

    // Add pagination
    if (limit && !isNaN(limit)) {
      const parsedLimitLocal = parseInt(limit, 10);
      const parsedPageLocal = parseInt(page, 10) || 1;
      const offset = (parsedPageLocal - 1) * parsedLimitLocal;
      query += ` LIMIT ${parsedLimitLocal} OFFSET ${offset}`;
    }

    // Get products
    const [products] = await pool.execute(query, queryParams);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM products WHERE category_id = ? AND customer_id = ?';
    const countParams = [categoryId, req.customer_id];

    if (!includeInactive || includeInactive === 'false') {
      countQuery += ' AND isActive = 1';
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const total = countResult[0].total;

    res.json({
      success: true,
      message: 'Products retrieved successfully',
      category: categoryCheck[0],
      products: products,
      total: total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(total / parseInt(limit))
    });

  } catch (error) {
    console.error('Admin category products error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Create new product endpoint
app.post('/admin/products', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const {
      category_id,
      title,
      subtitle,
      price,
      reseller_price,
      stock,
      duration,
      image,
      download_link,
      isSpecial,
      featured,
      isWarrenty,
      warrenty_text,
      primary_color,
      secondary_color,
      priority,
      discount_percent
    } = req.body;

    // Validate required fields
    if (!category_id || !title || !price) {
      return res.status(400).json({
        success: false,
        message: 'Category ID, title, and price are required'
      });
    }

    // Check if category exists for this customer
    const [categoryCheck] = await pool.execute(
      'SELECT id FROM categories WHERE id = ? AND customer_id = ? AND isActive = 1',
      [category_id, req.customer_id]
    );

    if (categoryCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Category not found or inactive'
      });
    }

    // Insert new product
    const [result] = await pool.execute(
      `INSERT INTO products (
        customer_id, category_id, title, subtitle, price, reseller_price, 
        stock, duration, image, download_link, isSpecial, featured, 
        isWarrenty, warrenty_text, primary_color, secondary_color, 
        priority, discount_percent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.customer_id, category_id, title, subtitle || null, price,
        reseller_price || null, stock || 0, duration || null, image || null,
        download_link || null, isSpecial || 0, featured || 0, isWarrenty || 0,
        warrenty_text || null, primary_color || null, secondary_color || null,
        priority || 0, discount_percent || 0
      ]
    );

    // Get the created product
    const [newProduct] = await pool.execute(
      'SELECT * FROM products WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      product: newProduct[0]
    });

  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Duplicate product endpoint
app.post('/admin/products/:productId/duplicate', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const { productId } = req.params;

    // Validate product ID
    if (!productId || isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required'
      });
    }

    // Get the original product
    const [products] = await pool.execute(
      `SELECT 
        category_id, title, subtitle, price, reseller_price, 
        stock, duration, image, download_link, isSpecial, featured, 
        isWarrenty, warrenty_text, primary_color, secondary_color, 
        priority, discount_percent
      FROM products 
      WHERE id = ? AND customer_id = ?`,
      [productId, req.customer_id]
    );

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    const originalProduct = products[0];

    // Create a new title for the duplicated product
    const newTitle = `Copy of ${originalProduct.title}`;

    // Insert the duplicated product
    const [result] = await pool.execute(
      `INSERT INTO products (
        customer_id, category_id, title, subtitle, price, reseller_price, 
        stock, duration, image, download_link, isSpecial, featured, 
        isWarrenty, warrenty_text, primary_color, secondary_color, 
        priority, discount_percent
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.customer_id,
        originalProduct.category_id,
        newTitle,
        originalProduct.subtitle,
        originalProduct.price,
        originalProduct.reseller_price,
        originalProduct.stock,
        originalProduct.duration,
        originalProduct.image,
        originalProduct.download_link,
        originalProduct.isSpecial,
        originalProduct.featured,
        originalProduct.isWarrenty,
        originalProduct.warrenty_text,
        originalProduct.primary_color,
        originalProduct.secondary_color,
        originalProduct.priority,
        originalProduct.discount_percent
      ]
    );

    // Get the newly created product
    const [newProduct] = await pool.execute(
      'SELECT * FROM products WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Product duplicated successfully',
      product: newProduct[0]
    });

  } catch (error) {
    console.error('Duplicate product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update product endpoint
app.put('/admin/products/:productId', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const { productId } = req.params;
    const {
      category_id,
      title,
      subtitle,
      price,
      reseller_price,
      stock,
      duration,
      image,
      download_link,
      isSpecial,
      featured,
      isWarrenty,
      warrenty_text,
      primary_color,
      secondary_color,
      priority,
      discount_percent,
      isActive
    } = req.body;

    // Validate product ID
    if (!productId || isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required'
      });
    }

    // Check if product exists for this customer
    const [productCheck] = await pool.execute(
      'SELECT id FROM products WHERE id = ? AND customer_id = ?',
      [productId, req.customer_id]
    );

    if (productCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // If category_id is provided, check if it exists
    if (category_id) {
      const [categoryCheck] = await pool.execute(
        'SELECT id FROM categories WHERE id = ? AND customer_id = ? AND isActive = 1',
        [category_id, req.customer_id]
      );

      if (categoryCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Category not found or inactive'
        });
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (category_id !== undefined) {
      updateFields.push('category_id = ?');
      updateValues.push(category_id);
    }
    if (title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(title);
    }
    if (subtitle !== undefined) {
      updateFields.push('subtitle = ?');
      updateValues.push(subtitle);
    }
    if (price !== undefined) {
      updateFields.push('price = ?');
      updateValues.push(price);
    }
    if (reseller_price !== undefined) {
      updateFields.push('reseller_price = ?');
      updateValues.push(reseller_price);
    }
    if (stock !== undefined) {
      updateFields.push('stock = ?');
      updateValues.push(stock);
    }
    if (duration !== undefined) {
      updateFields.push('duration = ?');
      updateValues.push(duration);
    }
    if (image !== undefined) {
      updateFields.push('image = ?');
      updateValues.push(image);
    }
    if (download_link !== undefined) {
      updateFields.push('download_link = ?');
      updateValues.push(download_link);
    }
    if (isSpecial !== undefined) {
      updateFields.push('isSpecial = ?');
      updateValues.push(isSpecial);
    }
    if (featured !== undefined) {
      updateFields.push('featured = ?');
      updateValues.push(featured);
    }
    if (isWarrenty !== undefined) {
      updateFields.push('isWarrenty = ?');
      updateValues.push(isWarrenty);
    }
    if (warrenty_text !== undefined) {
      updateFields.push('warrenty_text = ?');
      updateValues.push(warrenty_text);
    }
    if (primary_color !== undefined) {
      updateFields.push('primary_color = ?');
      updateValues.push(primary_color);
    }
    if (secondary_color !== undefined) {
      updateFields.push('secondary_color = ?');
      updateValues.push(secondary_color);
    }
    if (priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(priority);
    }
    if (discount_percent !== undefined) {
      updateFields.push('discount_percent = ?');
      updateValues.push(discount_percent);
    }
    if (isActive !== undefined) {
      updateFields.push('isActive = ?');
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(productId);

    // Update product
    await pool.execute(
      `UPDATE products SET ${updateFields.join(', ')} WHERE id = ? AND customer_id = ?`,
      [...updateValues, req.customer_id]
    );

    // Get updated product
    const [updatedProduct] = await pool.execute(
      'SELECT * FROM products WHERE id = ? AND customer_id = ?',
      [productId, req.customer_id]
    );

    res.json({
      success: true,
      message: 'Product updated successfully',
      product: updatedProduct[0]
    });

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Delete product endpoint (force delete with all related data)
app.delete('/admin/products/:productId', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const { productId } = req.params;
    const { force = false } = req.query;

    // Validate product ID
    if (!productId || isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required'
      });
    }

    // Check if product exists for this customer
    const [productCheck] = await pool.execute(
      'SELECT id, title FROM products WHERE id = ? AND customer_id = ?',
      [productId, req.customer_id]
    );

    if (productCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    if (force === 'true' || force === true) {
      // Force delete - remove all related data first
      await deleteProductWithRelatedData(productId, req.customer_id);

      res.json({
        success: true,
        message: 'Product and all related data deleted successfully (force delete)',
        product: {
          id: productCheck[0].id,
          title: productCheck[0].title
        }
      });
    } else {
      // Normal delete with checks
      // Check if product has stock
      const [stockCheck] = await pool.execute(
        'SELECT COUNT(*) as count FROM product_stock WHERE product_id = ? AND customer_id = ?',
        [productId, req.customer_id]
      );

      if (stockCheck[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete product with stock. Use ?force=true to force delete or remove stock first.',
          stock_count: stockCheck[0].count
        });
      }

      // Normal delete (no stock)
      await pool.execute(
        'DELETE FROM products WHERE id = ? AND customer_id = ?',
        [productId, req.customer_id]
      );

      res.json({
        success: true,
        message: 'Product deleted successfully',
        product: {
          id: productCheck[0].id,
          title: productCheck[0].title
        }
      });
    }

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Helper function to delete product with all related data
async function deleteProductWithRelatedData(productId, customerId) {
  try {
    // Get all product_stock IDs for this product
    const [productStocks] = await pool.execute(
      'SELECT id FROM product_stock WHERE product_id = ? AND customer_id = ?',
      [productId, customerId]
    );

    // Delete transaction_items that reference these product_stock entries
    for (const stock of productStocks) {
      await pool.execute(
        'DELETE FROM transaction_items WHERE license_id = ?',
        [stock.id]
      );
    }

    // Now we can safely delete product_stock
    await pool.execute(
      'DELETE FROM product_stock WHERE product_id = ? AND customer_id = ?',
      [productId, customerId]
    );

    // Finally, delete the product itself
    await pool.execute(
      'DELETE FROM products WHERE id = ? AND customer_id = ?',
      [productId, customerId]
    );

  } catch (error) {
    console.error('Error in deleteProductWithRelatedData:', error);
    throw error;
  }
}

// ==================== CATEGORY MANAGEMENT API ====================

// Get all categories for admin (including inactive ones)
app.get('/admin/categories', authenticateToken, requirePermission('can_edit_categories'), async (req, res) => {
  try {
    const {
      includeInactive = false,
      flat = false,
      page = 1,
      limit = 50
    } = req.query;

    // Build query based on includeInactive parameter
    let query = `
      SELECT 
        id, parent_id, title, subtitle, image, category, featured, 
        isActive, priority, created_at, customer_id
      FROM categories 
      WHERE customer_id = ?
    `;

    if (!includeInactive || includeInactive === 'false') {
      query += ' AND isActive = 1';
    }

    query += ' ORDER BY priority DESC, title ASC';

    // Add pagination if not flat structure
    const queryParams = [req.customer_id];
    if (flat === 'true' && limit && !isNaN(limit)) {
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query += ' LIMIT ? OFFSET ?';
      queryParams.push(parseInt(limit), parseInt(offset));
    }

    const [categories] = await pool.execute(query, queryParams);

    // If flat structure requested, return simple array
    if (flat === 'true') {
      // Get total count for pagination
      let countQuery = 'SELECT COUNT(*) as total FROM categories WHERE customer_id = ?';
      const countParams = [req.customer_id];
      if (!includeInactive || includeInactive === 'false') {
        countQuery += ' AND isActive = 1';
      }

      const [countResult] = await pool.execute(countQuery, countParams);
      const total = countResult[0].total;

      return res.json({
        success: true,
        message: 'Categories retrieved successfully',
        categories: categories,
        total: total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      });
    }

    // Build hierarchical structure
    const categoryMap = new Map();
    const rootCategories = [];

    // First pass: create map of all categories
    categories.forEach(category => {
      categoryMap.set(category.id, {
        ...category,
        children: []
      });
    });

    // Second pass: build hierarchy
    categories.forEach(category => {
      const categoryObj = categoryMap.get(category.id);

      if (category.parent_id === null) {
        // Root category
        rootCategories.push(categoryObj);
      } else {
        // Child category
        const parent = categoryMap.get(category.parent_id);
        if (parent) {
          parent.children.push(categoryObj);
        }
      }
    });

    res.json({
      success: true,
      message: 'Categories retrieved successfully',
      categories: rootCategories,
      total: categories.length
    });

  } catch (error) {
    console.error('Admin categories error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get single category for admin
app.get('/admin/categories/:categoryId', authenticateToken, requirePermission('can_edit_categories'), async (req, res) => {
  try {
    const { categoryId } = req.params;

    // Validate category ID
    if (!categoryId || isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    // Get category details
    const [categories] = await pool.execute(
      `SELECT 
        id, parent_id, title, subtitle, image, category, featured, 
        isActive, priority, created_at, customer_id
      FROM categories 
      WHERE id = ? AND customer_id = ?`,
      [categoryId, req.customer_id]
    );

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    const category = categories[0];

    // Get parent category info if exists
    if (category.parent_id) {
      const [parentCategory] = await pool.execute(
        'SELECT id, title FROM categories WHERE id = ? AND customer_id = ?',
        [category.parent_id, req.customer_id]
      );

      if (parentCategory.length > 0) {
        category.parent_info = parentCategory[0];
      }
    }

    // Get child categories
    const [childCategories] = await pool.execute(
      'SELECT id, title, isActive FROM categories WHERE parent_id = ? AND customer_id = ? ORDER BY priority DESC, title ASC',
      [categoryId, req.customer_id]
    );

    category.children = childCategories;

    // Get products count in this category
    const [productCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM products WHERE category_id = ? AND customer_id = ?',
      [categoryId, req.customer_id]
    );

    category.products_count = productCount[0].count;

    res.json({
      success: true,
      message: 'Category retrieved successfully',
      category: category
    });

  } catch (error) {
    console.error('Admin category detail error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Create new category endpoint
app.post('/admin/categories', authenticateToken, requirePermission('can_edit_categories'), async (req, res) => {
  try {
    const {
      parent_id,
      title,
      subtitle,
      image,
      category,
      featured,
      priority
    } = req.body;

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    // If parent_id is provided, check if parent category exists
    if (parent_id) {
      const [parentCheck] = await pool.execute(
        'SELECT id FROM categories WHERE id = ? AND customer_id = ? AND isActive = 1',
        [parent_id, req.customer_id]
      );

      if (parentCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Parent category not found or inactive'
        });
      }
    }

    // Check if category slug already exists (if provided)
    if (category) {
      const [categoryCheck] = await pool.execute(
        'SELECT id FROM categories WHERE category = ? AND customer_id = ?',
        [category, req.customer_id]
      );

      if (categoryCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Category slug already exists'
        });
      }
    }

    // Insert new category
    const [result] = await pool.execute(
      `INSERT INTO categories (
        customer_id, parent_id, title, subtitle, image, category, 
        featured, priority
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.customer_id, parent_id || null, title, subtitle || null,
        image || null, category || null, featured || 0, priority || 0
      ]
    );

    // Get the created category
    const [newCategory] = await pool.execute(
      'SELECT * FROM categories WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      category: newCategory[0]
    });

  } catch (error) {
    console.error('Create category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update category endpoint
app.put('/admin/categories/:categoryId', authenticateToken, requirePermission('can_edit_categories'), async (req, res) => {
  try {
    const { categoryId } = req.params;
    const {
      parent_id,
      title,
      subtitle,
      image,
      category,
      featured,
      priority,
      isActive
    } = req.body;

    // Validate category ID
    if (!categoryId || isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    // Check if category exists for this customer
    const [categoryCheck] = await pool.execute(
      'SELECT id FROM categories WHERE id = ? AND customer_id = ?',
      [categoryId, req.customer_id]
    );

    if (categoryCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    // If parent_id is provided, check if parent category exists and prevent circular reference
    if (parent_id) {
      if (parent_id == categoryId) {
        return res.status(400).json({
          success: false,
          message: 'Category cannot be its own parent'
        });
      }

      const [parentCheck] = await pool.execute(
        'SELECT id FROM categories WHERE id = ? AND customer_id = ? AND isActive = 1',
        [parent_id, req.customer_id]
      );

      if (parentCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Parent category not found or inactive'
        });
      }
    }

    // If category slug is provided, check if it already exists
    if (category) {
      const [slugCheck] = await pool.execute(
        'SELECT id FROM categories WHERE category = ? AND customer_id = ? AND id != ?',
        [category, req.customer_id, categoryId]
      );

      if (slugCheck.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Category slug already exists'
        });
      }
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (parent_id !== undefined) {
      updateFields.push('parent_id = ?');
      updateValues.push(parent_id);
    }
    if (title !== undefined) {
      updateFields.push('title = ?');
      updateValues.push(title);
    }
    if (subtitle !== undefined) {
      updateFields.push('subtitle = ?');
      updateValues.push(subtitle);
    }
    if (image !== undefined) {
      updateFields.push('image = ?');
      updateValues.push(image);
    }
    if (category !== undefined) {
      updateFields.push('category = ?');
      updateValues.push(category);
    }
    if (featured !== undefined) {
      updateFields.push('featured = ?');
      updateValues.push(featured);
    }
    if (priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(priority);
    }
    if (isActive !== undefined) {
      updateFields.push('isActive = ?');
      updateValues.push(isActive);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(categoryId);

    // Update category
    await pool.execute(
      `UPDATE categories SET ${updateFields.join(', ')} WHERE id = ? AND customer_id = ?`,
      [...updateValues, req.customer_id]
    );

    // Get updated category
    const [updatedCategory] = await pool.execute(
      'SELECT * FROM categories WHERE id = ? AND customer_id = ?',
      [categoryId, req.customer_id]
    );

    res.json({
      success: true,
      message: 'Category updated successfully',
      category: updatedCategory[0]
    });

  } catch (error) {
    console.error('Update category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Delete category endpoint (force delete with all products and sub-categories)
app.delete('/admin/categories/:categoryId', authenticateToken, requirePermission('can_edit_categories'), async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { force = false } = req.query;

    // Validate category ID
    if (!categoryId || isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    // Check if category exists for this customer
    const [categoryCheck] = await pool.execute(
      'SELECT id, title FROM categories WHERE id = ? AND customer_id = ?',
      [categoryId, req.customer_id]
    );

    if (categoryCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found'
      });
    }

    if (force === 'true' || force === true) {
      // Force delete - remove everything recursively
      await deleteCategoryRecursive(categoryId, req.customer_id);

      res.json({
        success: true,
        message: 'Category and all related data deleted successfully (force delete)',
        category: {
          id: categoryCheck[0].id,
          title: categoryCheck[0].title
        }
      });
    } else {
      // Normal delete with checks
      // Check if category has products
      const [productsCheck] = await pool.execute(
        'SELECT COUNT(*) as count FROM products WHERE category_id = ? AND customer_id = ?',
        [categoryId, req.customer_id]
      );

      if (productsCheck[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete category with products. Use ?force=true to force delete or move products first.',
          products_count: productsCheck[0].count
        });
      }

      // Check if category has child categories
      const [childrenCheck] = await pool.execute(
        'SELECT COUNT(*) as count FROM categories WHERE parent_id = ? AND customer_id = ?',
        [categoryId, req.customer_id]
      );

      if (childrenCheck[0].count > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cannot delete category with child categories. Use ?force=true to force delete or move child categories first.',
          child_categories_count: childrenCheck[0].count
        });
      }

      // Normal delete (no products or children)
      await pool.execute(
        'DELETE FROM categories WHERE id = ? AND customer_id = ?',
        [categoryId, req.customer_id]
      );

      res.json({
        success: true,
        message: 'Category deleted successfully',
        category: {
          id: categoryCheck[0].id,
          title: categoryCheck[0].title
        }
      });
    }

  } catch (error) {
    console.error('Delete category error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Helper function to recursively delete category and all related data
async function deleteCategoryRecursive(categoryId, customerId) {
  try {
    // Get all child categories
    const [childCategories] = await pool.execute(
      'SELECT id FROM categories WHERE parent_id = ? AND customer_id = ?',
      [categoryId, customerId]
    );

    // Recursively delete all child categories
    for (const child of childCategories) {
      await deleteCategoryRecursive(child.id, customerId);
    }

    // Get all products in this category
    const [products] = await pool.execute(
      'SELECT id FROM products WHERE category_id = ? AND customer_id = ?',
      [categoryId, customerId]
    );

    // For each product, delete all related data in the correct order
    for (const product of products) {
      // Get all product_stock IDs for this product
      const [productStocks] = await pool.execute(
        'SELECT id FROM product_stock WHERE product_id = ? AND customer_id = ?',
        [product.id, customerId]
      );

      // Delete transaction_items that reference these product_stock entries
      for (const stock of productStocks) {
        await pool.execute(
          'DELETE FROM transaction_items WHERE license_id = ?',
          [stock.id]
        );
      }

      // Now we can safely delete product_stock
      await pool.execute(
        'DELETE FROM product_stock WHERE product_id = ? AND customer_id = ?',
        [product.id, customerId]
      );
    }

    // Delete all products in this category
    await pool.execute(
      'DELETE FROM products WHERE category_id = ? AND customer_id = ?',
      [categoryId, customerId]
    );

    // Finally, delete the category itself
    await pool.execute(
      'DELETE FROM categories WHERE id = ? AND customer_id = ?',
      [categoryId, customerId]
    );

  } catch (error) {
    console.error('Error in deleteCategoryRecursive:', error);
    throw error;
  }
}



















// ==================== ADMIN REPORTS API ====================

// Get comprehensive overview report for admin
app.get('/admin/reports/overview', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const { period = '30' } = req.query; // days
    const periodDays = parseInt(period) || 30;

    // Get date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Overall statistics
    const [overallStats] = await pool.execute(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE customer_id = ?) as total_users,
        (SELECT COUNT(*) FROM products WHERE customer_id = ?) as total_products,
        (SELECT COUNT(*) FROM categories WHERE customer_id = ?) as total_categories,
        (SELECT COUNT(*) FROM product_stock WHERE customer_id = ?) as total_stock,
        (SELECT COUNT(*) FROM product_stock WHERE customer_id = ? AND sold = 0) as available_stock,
        (SELECT COUNT(*) FROM product_stock WHERE customer_id = ? AND sold = 1) as sold_stock,
        (SELECT COUNT(*) FROM transactions WHERE customer_id = ?) as total_transactions,
        (SELECT COALESCE(SUM(total_price), 0) FROM transactions WHERE customer_id = ?) as total_revenue,
        (SELECT COUNT(*) FROM topups WHERE customer_id = ?) as total_topups,
        (SELECT COALESCE(SUM(amount), 0) FROM topups WHERE customer_id = ? AND status = 'success') as total_topup_amount
    `, Array(10).fill(req.customer_id));

    // Recent period statistics
    const [periodStats] = await pool.execute(`
      SELECT 
        (SELECT COUNT(*) FROM users WHERE customer_id = ? AND created_at >= ?) as new_users,
        (SELECT COUNT(*) FROM transactions WHERE customer_id = ? AND created_at >= ?) as period_transactions,
        (SELECT COALESCE(SUM(total_price), 0) FROM transactions WHERE customer_id = ? AND created_at >= ?) as period_revenue,
        (SELECT COUNT(*) FROM topups WHERE customer_id = ? AND created_at >= ?) as period_topups,
        (SELECT COALESCE(SUM(amount), 0) FROM topups WHERE customer_id = ? AND status = 'success' AND created_at >= ?) as period_topup_amount,
        (SELECT COUNT(*) FROM product_stock WHERE customer_id = ? AND created_at >= ?) as period_stock_added
    `, [
      req.customer_id, startDate,
      req.customer_id, startDate,
      req.customer_id, startDate,
      req.customer_id, startDate,
      req.customer_id, startDate,
      req.customer_id, startDate
    ]);

    // Top selling products
    const [topProducts] = await pool.execute(`
      SELECT 
        p.id,
        p.title,
        COUNT(ti.id) as sales_count,
        SUM(ti.quantity) as total_quantity,
        SUM(ti.price * ti.quantity) as total_revenue
      FROM products p
      LEFT JOIN transaction_items ti ON p.id = ti.product_id
      LEFT JOIN transactions t ON ti.transaction_id = t.id
      WHERE p.customer_id = ? AND t.customer_id = ?
      GROUP BY p.id, p.title
      ORDER BY sales_count DESC, total_revenue DESC
      LIMIT 10
    `, [req.customer_id, req.customer_id]);

    // Recent transactions
    const [recentTransactions] = await pool.execute(`
      SELECT 
        t.id,
        t.bill_number,
        u.fullname as username,
        t.total_price as total_amount,
        'completed' as status,
        t.created_at
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.customer_id = ?
      ORDER BY t.created_at DESC
      LIMIT 10
    `, [req.customer_id]);

    // Daily revenue for the period (for charts)
    const [dailyRevenue] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as transaction_count,
        COALESCE(SUM(total_price), 0) as revenue
      FROM transactions 
      WHERE customer_id = ? AND created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, [req.customer_id, startDate]);

    res.json({
      success: true,
      period_days: periodDays,
      overview: {
        ...overallStats[0],
        ...periodStats[0]
      },
      top_products: topProducts,
      recent_transactions: recentTransactions,
      daily_revenue: dailyRevenue
    });

  } catch (error) {
    console.error('Admin overview report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// ==================== CHART/GRAPH ENDPOINTS ====================

// Get revenue chart data (daily/monthly)
app.get('/admin/charts/revenue', authenticateToken, requirePermission('can_view_reports'), async (req, res) => {
  try {
    const { period = 'daily', days = 30 } = req.query;
    const parsedDays = parseInt(days) || 30;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parsedDays);

    let dateFormat, groupBy;
    if (period === 'monthly') {
      dateFormat = '%Y-%m';
      groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
    } else {
      dateFormat = '%Y-%m-%d';
      groupBy = 'DATE(created_at)';
    }

    const [revenueData] = await pool.execute(`
      SELECT 
        DATE_FORMAT(created_at, ?) as date,
        COUNT(*) as transaction_count,
        COALESCE(SUM(total_price), 0) as revenue
      FROM transactions 
      WHERE customer_id = ? AND created_at >= ?
      GROUP BY ${groupBy}
      ORDER BY date ASC
    `, [dateFormat, req.customer_id, startDate]);

    res.json({
      success: true,
      period,
      days: parsedDays,
      data: revenueData.map(item => ({
        date: item.date,
        revenue: parseFloat(item.revenue),
        transaction_count: parseInt(item.transaction_count)
      }))
    });

  } catch (error) {
    console.error('Revenue chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get top selling products chart data
app.get('/admin/charts/top-products', authenticateToken, requirePermission('can_view_reports'), async (req, res) => {
  try {
    const { limit = 10, days } = req.query;
    const parsedLimit = Math.min(parseInt(limit) || 10, 50);

    let dateCondition = '';
    let params = [req.customer_id, req.customer_id];
    
    if (days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      dateCondition = 'AND t.created_at >= ?';
      params.push(startDate);
    }

    const [topProducts] = await pool.execute(`
      SELECT 
        p.id,
        p.title,
        p.image,
        COUNT(ti.id) as sales_count,
        SUM(ti.quantity) as total_quantity,
        SUM(ti.price * ti.quantity) as total_revenue
      FROM products p
      INNER JOIN transaction_items ti ON p.id = ti.product_id
      INNER JOIN transactions t ON ti.transaction_id = t.id
      WHERE p.customer_id = ? AND t.customer_id = ? ${dateCondition}
      GROUP BY p.id, p.title, p.image
      ORDER BY sales_count DESC, total_revenue DESC
      LIMIT ${parsedLimit}
    `, params);

    res.json({
      success: true,
      limit: parsedLimit,
      data: topProducts.map(item => ({
        id: item.id,
        name: item.title,
        image: item.image,
        sales_count: parseInt(item.sales_count),
        total_quantity: parseInt(item.total_quantity),
        total_revenue: parseFloat(item.total_revenue)
      }))
    });

  } catch (error) {
    console.error('Top products chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get new users chart data
app.get('/admin/charts/new-users', authenticateToken, requirePermission('can_view_reports'), async (req, res) => {
  try {
    const { period = 'daily', days = 30 } = req.query;
    const parsedDays = parseInt(days) || 30;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parsedDays);

    let dateFormat, groupBy;
    if (period === 'monthly') {
      dateFormat = '%Y-%m';
      groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
    } else {
      dateFormat = '%Y-%m-%d';
      groupBy = 'DATE(created_at)';
    }

    const [usersData] = await pool.execute(`
      SELECT 
        DATE_FORMAT(created_at, ?) as date,
        COUNT(*) as user_count
      FROM users 
      WHERE customer_id = ? AND created_at >= ?
      GROUP BY ${groupBy}
      ORDER BY date ASC
    `, [dateFormat, req.customer_id, startDate]);

    res.json({
      success: true,
      period,
      days: parsedDays,
      data: usersData.map(item => ({
        date: item.date,
        user_count: parseInt(item.user_count)
      }))
    });

  } catch (error) {
    console.error('New users chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get topup chart data
app.get('/admin/charts/topups', authenticateToken, requirePermission('can_view_reports'), async (req, res) => {
  try {
    const { period = 'daily', days = 30 } = req.query;
    const parsedDays = parseInt(days) || 30;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parsedDays);

    let dateFormat, groupBy;
    if (period === 'monthly') {
      dateFormat = '%Y-%m';
      groupBy = 'DATE_FORMAT(created_at, "%Y-%m")';
    } else {
      dateFormat = '%Y-%m-%d';
      groupBy = 'DATE(created_at)';
    }

    const [topupData] = await pool.execute(`
      SELECT 
        DATE_FORMAT(created_at, ?) as date,
        COUNT(*) as topup_count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM topups 
      WHERE customer_id = ? AND created_at >= ? AND status = 'success'
      GROUP BY ${groupBy}
      ORDER BY date ASC
    `, [dateFormat, req.customer_id, startDate]);

    res.json({
      success: true,
      period,
      days: parsedDays,
      data: topupData.map(item => ({
        date: item.date,
        topup_count: parseInt(item.topup_count),
        total_amount: parseFloat(item.total_amount)
      }))
    });

  } catch (error) {
    console.error('Topup chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get category sales distribution chart
app.get('/admin/charts/category-sales', authenticateToken, requirePermission('can_view_reports'), async (req, res) => {
  try {
    const { days } = req.query;

    let dateCondition = '';
    let params = [req.customer_id, req.customer_id];
    
    if (days) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - parseInt(days));
      dateCondition = 'AND t.created_at >= ?';
      params.push(startDate);
    }

    const [categoryData] = await pool.execute(`
      SELECT 
        c.id,
        c.title as category_name,
        COUNT(ti.id) as sales_count,
        SUM(ti.quantity) as total_quantity,
        SUM(ti.price * ti.quantity) as total_revenue
      FROM categories c
      INNER JOIN products p ON c.id = p.category_id
      INNER JOIN transaction_items ti ON p.id = ti.product_id
      INNER JOIN transactions t ON ti.transaction_id = t.id
      WHERE c.customer_id = ? AND t.customer_id = ? ${dateCondition}
      GROUP BY c.id, c.title
      ORDER BY total_revenue DESC
    `, params);

    res.json({
      success: true,
      data: categoryData.map(item => ({
        id: item.id,
        category_name: item.category_name,
        sales_count: parseInt(item.sales_count),
        total_quantity: parseInt(item.total_quantity),
        total_revenue: parseFloat(item.total_revenue)
      }))
    });

  } catch (error) {
    console.error('Category sales chart error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get comprehensive dashboard data (all charts in one call)
app.get('/admin/charts/dashboard', authenticateToken, requirePermission('can_view_reports'), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const parsedDays = parseInt(days) || 30;
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parsedDays);

    // Daily Revenue
    const [revenueData] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as transaction_count,
        COALESCE(SUM(total_price), 0) as revenue
      FROM transactions 
      WHERE customer_id = ? AND created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [req.customer_id, startDate]);

    // Top Products
    const [topProducts] = await pool.execute(`
      SELECT 
        p.id,
        p.title,
        p.image,
        COUNT(ti.id) as sales_count,
        SUM(ti.price * ti.quantity) as total_revenue
      FROM products p
      INNER JOIN transaction_items ti ON p.id = ti.product_id
      INNER JOIN transactions t ON ti.transaction_id = t.id
      WHERE p.customer_id = ? AND t.customer_id = ? AND t.created_at >= ?
      GROUP BY p.id, p.title, p.image
      ORDER BY sales_count DESC
      LIMIT 10
    `, [req.customer_id, req.customer_id, startDate]);

    // New Users
    const [usersData] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as user_count
      FROM users 
      WHERE customer_id = ? AND created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [req.customer_id, startDate]);

    // Topups
    const [topupData] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as topup_count,
        COALESCE(SUM(amount), 0) as total_amount
      FROM topups 
      WHERE customer_id = ? AND created_at >= ? AND status = 'success'
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `, [req.customer_id, startDate]);

    // Category Distribution
    const [categoryData] = await pool.execute(`
      SELECT 
        c.id,
        c.title as category_name,
        COUNT(ti.id) as sales_count,
        SUM(ti.price * ti.quantity) as total_revenue
      FROM categories c
      INNER JOIN products p ON c.id = p.category_id
      INNER JOIN transaction_items ti ON p.id = ti.product_id
      INNER JOIN transactions t ON ti.transaction_id = t.id
      WHERE c.customer_id = ? AND t.customer_id = ? AND t.created_at >= ?
      GROUP BY c.id, c.title
      ORDER BY total_revenue DESC
    `, [req.customer_id, req.customer_id, startDate]);

    res.json({
      success: true,
      days: parsedDays,
      charts: {
        revenue: revenueData.map(item => ({
          date: item.date,
          revenue: parseFloat(item.revenue),
          transaction_count: parseInt(item.transaction_count)
        })),
        top_products: topProducts.map(item => ({
          id: item.id,
          name: item.title,
          image: item.image,
          sales_count: parseInt(item.sales_count),
          total_revenue: parseFloat(item.total_revenue)
        })),
        new_users: usersData.map(item => ({
          date: item.date,
          user_count: parseInt(item.user_count)
        })),
        topups: topupData.map(item => ({
          date: item.date,
          topup_count: parseInt(item.topup_count),
          total_amount: parseFloat(item.total_amount)
        })),
        category_distribution: categoryData.map(item => ({
          id: item.id,
          category_name: item.category_name,
          sales_count: parseInt(item.sales_count),
          total_revenue: parseFloat(item.total_revenue)
        }))
      }
    });

  } catch (error) {
    console.error('Dashboard charts error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// ==================== END CHART/GRAPH ENDPOINTS ====================

// Get detailed sales report
app.get('/admin/reports/sales', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const {
      start_date = null,
      end_date = null,
      page = 1,
      limit = 50
    } = req.query;

    const parsedPage = parseInt(page) || 1;
    const parsedLimit = Math.min(parseInt(limit) || 50, 100);
    const offset = (parsedPage - 1) * parsedLimit;

    // Build date filters
    let dateFilter = '';
    const queryParams = [req.customer_id];

    if (start_date) {
      dateFilter += ' AND t.created_at >= ?';
      queryParams.push(new Date(start_date));
    }

    if (end_date) {
      dateFilter += ' AND t.created_at <= ?';
      queryParams.push(new Date(end_date));
    }


    // Get detailed sales data
    const [salesData] = await pool.execute(`
      SELECT 
        t.id,
        t.bill_number,
        u.fullname as username,
        u.email,
        t.total_price as total_amount,
        t.created_at,
        GROUP_CONCAT(
          CONCAT(p.title, ' (', ti.quantity, 'x', ti.price, ')')
          SEPARATOR '; '
        ) as items
      FROM transactions t
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN transaction_items ti ON t.id = ti.transaction_id
      LEFT JOIN products p ON ti.product_id = p.id
      WHERE t.customer_id = ? ${dateFilter}
      GROUP BY t.id
      ORDER BY t.created_at DESC
      LIMIT ${parsedLimit} OFFSET ${offset}
    `, queryParams);

    // Get summary statistics
    const [summary] = await pool.execute(`
      SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(total_price), 0) as total_revenue
      FROM transactions t
      WHERE t.customer_id = ? ${dateFilter}
    `, queryParams); // Use same queryParams without limit/offset

    const totalItems = summary[0].total_transactions;
    const totalPages = Math.ceil(totalItems / parsedLimit);

    res.json({
      success: true,
      data: salesData,
      summary: summary[0],
      pagination: {
        currentPage: parsedPage,
        totalPages,
        totalItems,
        itemsPerPage: parsedLimit,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1
      }
    });

  } catch (error) {
    console.error('Sales report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get products performance report
app.get('/admin/reports/products', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const {
      category_id = null,
      sort_by = 'sales',
      period = '30'
    } = req.query;

    const periodDays = parseInt(period) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    let categoryFilter = '';
    const queryParams = [req.customer_id];

    if (category_id) {
      categoryFilter = ' AND p.category_id = ?';
      queryParams.push(category_id);
    }

    // Get products with sales data
    const [productsData] = await pool.execute(`
      SELECT 
        p.id,
        p.title,
        p.price,
        p.reseller_price,
        p.stock,
        p.isActive,
        c.title as category_title,
        COALESCE(sales.total_sales, 0) as total_sales,
        COALESCE(sales.total_quantity, 0) as total_quantity,
        COALESCE(sales.total_revenue, 0) as total_revenue,
        COALESCE(period_sales.period_sales, 0) as period_sales,
        COALESCE(period_sales.period_revenue, 0) as period_revenue,
        COALESCE(stock_info.total_stock, 0) as total_license_keys,
        COALESCE(stock_info.available_stock, 0) as available_license_keys,
        COALESCE(stock_info.sold_stock, 0) as sold_license_keys
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN (
        SELECT 
          ti.product_id,
          COUNT(t.id) as total_sales,
          SUM(ti.quantity) as total_quantity,
          SUM(ti.price * ti.quantity) as total_revenue
        FROM transaction_items ti
        LEFT JOIN transactions t ON ti.transaction_id = t.id
        WHERE t.customer_id = ?
        GROUP BY ti.product_id
      ) sales ON p.id = sales.product_id
      LEFT JOIN (
        SELECT 
          ti.product_id,
          COUNT(t.id) as period_sales,
          SUM(ti.price * ti.quantity) as period_revenue
        FROM transaction_items ti
        LEFT JOIN transactions t ON ti.transaction_id = t.id
        WHERE t.customer_id = ? AND t.created_at >= ?
        GROUP BY ti.product_id
      ) period_sales ON p.id = period_sales.product_id
      LEFT JOIN (
        SELECT 
          product_id,
          COUNT(*) as total_stock,
          SUM(CASE WHEN sold = 0 THEN 1 ELSE 0 END) as available_stock,
          SUM(CASE WHEN sold = 1 THEN 1 ELSE 0 END) as sold_stock
        FROM product_stock
        WHERE customer_id = ?
        GROUP BY product_id
      ) stock_info ON p.id = stock_info.product_id
      WHERE p.customer_id = ? ${categoryFilter}
      ORDER BY ${sort_by === 'revenue' ? 'total_revenue' :
        sort_by === 'stock' ? 'available_license_keys' :
          'total_sales'} DESC
    `, [req.customer_id, req.customer_id, startDate, req.customer_id, req.customer_id]);

    // Get categories summary
    const [categoriesData] = await pool.execute(`
      SELECT 
        c.id,
        c.title,
        COUNT(p.id) as products_count,
        COALESCE(SUM(sales.total_sales), 0) as total_sales,
        COALESCE(SUM(sales.total_revenue), 0) as total_revenue
      FROM categories c
      LEFT JOIN products p ON c.id = p.category_id AND p.customer_id = ?
      LEFT JOIN (
        SELECT 
          ti.product_id,
          COUNT(t.id) as total_sales,
          SUM(ti.price * ti.quantity) as total_revenue
        FROM transaction_items ti
        LEFT JOIN transactions t ON ti.transaction_id = t.id
        WHERE t.customer_id = ?
        GROUP BY ti.product_id
      ) sales ON p.id = sales.product_id
      WHERE c.customer_id = ?
      GROUP BY c.id, c.title
      ORDER BY total_revenue DESC
    `, [req.customer_id, req.customer_id, req.customer_id]);

    res.json({
      success: true,
      period_days: periodDays,
      products: productsData,
      categories: categoriesData
    });

  } catch (error) {
    console.error('Products report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get users activity report
app.get('/admin/reports/users', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const {
      period = '30',
      page = 1,
      limit = 50
    } = req.query;

    const periodDays = parseInt(period) || 30;
    const parsedPage = parseInt(page) || 1;
    const parsedLimit = Math.min(parseInt(limit) || 50, 100);
    const offset = (parsedPage - 1) * parsedLimit;

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Get users with activity data
    const usersQueryParams = [startDate, startDate, req.customer_id, req.customer_id, req.customer_id];
    const [usersData] = await pool.execute(`
      SELECT 
        u.id,
        u.fullname as username,
        u.email,
        u.money as balance,
        CASE WHEN u.role = 'reseller' THEN 1 ELSE 0 END as is_reseller,
        u.created_at,
        COALESCE(stats.total_transactions, 0) as total_transactions,
        COALESCE(stats.total_spent, 0) as total_spent,
        COALESCE(stats.period_transactions, 0) as period_transactions,
        COALESCE(stats.period_spent, 0) as period_spent,
        COALESCE(topup_stats.total_topups, 0) as total_topups,
        COALESCE(topup_stats.total_topup_amount, 0) as total_topup_amount,
        stats.last_transaction_date
      FROM users u
      LEFT JOIN (
        SELECT 
          user_id,
          COUNT(*) as total_transactions,
          SUM(total_price) as total_spent,
          SUM(CASE WHEN created_at >= ? THEN 1 ELSE 0 END) as period_transactions,
          SUM(CASE WHEN created_at >= ? THEN total_price ELSE 0 END) as period_spent,
          MAX(created_at) as last_transaction_date
        FROM transactions 
        WHERE customer_id = ?
        GROUP BY user_id
      ) stats ON u.id = stats.user_id
      LEFT JOIN (
        SELECT 
          user_id,
          COUNT(*) as total_topups,
          SUM(amount) as total_topup_amount
        FROM topups 
        WHERE customer_id = ?
        GROUP BY user_id
      ) topup_stats ON u.id = topup_stats.user_id
      WHERE u.customer_id = ?
      ORDER BY total_spent DESC
      LIMIT ${parsedLimit} OFFSET ${offset}
    `, usersQueryParams);

    // Get total count
    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM users WHERE customer_id = ?',
      [req.customer_id]
    );

    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / parsedLimit);

    // Get summary statistics
    const [summary] = await pool.execute(`
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN created_at >= ? THEN 1 END) as new_users_period,
        COUNT(CASE WHEN role = 'reseller' THEN 1 END) as total_resellers,
        COALESCE(SUM(money), 0) as total_balance
      FROM users
      WHERE customer_id = ?
    `, [startDate, req.customer_id]);

    res.json({
      success: true,
      period_days: periodDays,
      data: usersData,
      summary: summary[0],
      pagination: {
        currentPage: parsedPage,
        totalPages,
        totalItems,
        itemsPerPage: parsedLimit,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1
      }
    });

  } catch (error) {
    console.error('Users report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get topups report
app.get('/admin/reports/topups', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const {
      start_date = null,
      end_date = null,
      status = null,
      method = null,
      page = 1,
      limit = 50
    } = req.query;

    const parsedPage = parseInt(page) || 1;
    const parsedLimit = Math.min(parseInt(limit) || 50, 100);
    const offset = (parsedPage - 1) * parsedLimit;

    // Build filters
    let filters = '';
    const queryParams = [req.customer_id, req.customer_id];

    if (start_date) {
      filters += ' AND t.created_at >= ?';
      queryParams.push(new Date(start_date));
    }

    if (end_date) {
      filters += ' AND t.created_at <= ?';
      queryParams.push(new Date(end_date));
    }

    if (status) {
      filters += ' AND t.status = ?';
      queryParams.push(status);
    }

    if (method) {
      filters += ' AND t.method = ?';
      queryParams.push(method);
    }

    // Get topups data
    const [topupsData] = await pool.execute(`
      SELECT 
        t.id,
        u.fullname as username,
        u.email,
        t.amount,
        t.method,
        t.transaction_ref,
        t.created_at,
        t.updated_at
      FROM topups t
      LEFT JOIN users u ON t.user_id = u.id AND u.customer_id = ?
      WHERE t.customer_id = ? ${filters}
      ORDER BY t.created_at DESC
      LIMIT ${parsedLimit} OFFSET ${offset}
    `, queryParams);

    // Get summary statistics
    const [summary] = await pool.execute(`
      SELECT 
        COUNT(*) as total_topups,
        COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) as total_success_amount,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as total_pending_amount,
        COALESCE(SUM(CASE WHEN status = 'failed' THEN amount ELSE 0 END), 0) as total_failed_amount,
        COUNT(CASE WHEN status = 'success' THEN 1 END) as success_count,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_count,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_count
      FROM topups t
      WHERE t.customer_id = ? ${filters}
    `, [req.customer_id, ...queryParams.slice(2)]); // Use customer_id + the filter params

    // Get payment methods summary
    const [methodsSummary] = await pool.execute(`
      SELECT 
        method,
        COUNT(*) as count,
        COALESCE(SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END), 0) as success_amount
      FROM topups t
      WHERE t.customer_id = ? ${filters}
      GROUP BY method
      ORDER BY success_amount DESC
    `, [req.customer_id, ...queryParams.slice(2)]); // Use customer_id + the filter params

    const totalItems = summary[0].total_topups;
    const totalPages = Math.ceil(totalItems / parsedLimit);

    res.json({
      success: true,
      data: topupsData,
      summary: summary[0],
      methods_summary: methodsSummary,
      pagination: {
        currentPage: parsedPage,
        totalPages,
        totalItems,
        itemsPerPage: parsedLimit,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1
      }
    });

  } catch (error) {
    console.error('Topups report error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// ==================== STOCK MANAGEMENT API ====================

// Get all product stock with pagination and filters
app.get('/admin/stock', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const {
      productId = null,
      soldStatus = null, // 'sold', 'unsold', or null for all
      page = 1,
      limit = 50,
      search = '',
      sortBy = 'created_at',
      sortOrder = 'desc'
    } = req.query;

    // Parse and validate pagination parameters
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = Math.min(parseInt(limit, 10) || 50, 100); // Max 100 per page
    const offset = (parsedPage - 1) * parsedLimit;

    // Build base query
    let query = `
      SELECT 
        ps.id, ps.product_id, ps.license_key, ps.sold, ps.created_at,
        p.title as product_title, p.price, p.category_id,
        c.title as category_title
      FROM product_stock ps
      LEFT JOIN products p ON ps.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;

    const queryParams = [req.customer_id];

    // Add filters
    if (productId && !isNaN(productId)) {
      query += ' AND ps.product_id = ?';
      queryParams.push(parseInt(productId));
    }

    if (soldStatus === 'sold') {
      query += ' AND ps.sold = 1';
    } else if (soldStatus === 'unsold') {
      query += ' AND ps.sold = 0';
    }

    if (search && search.trim() !== '') {
      query += ' AND (ps.license_key LIKE ? OR p.title LIKE ? OR c.title LIKE ?)';
      const searchPattern = `%${search.trim()}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern);
    }

    // Add sorting
    const validSortFields = ['created_at', 'license_key', 'product_title', 'sold'];
    const validSortOrders = ['asc', 'desc'];

    const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'created_at';
    const finalSortOrder = validSortOrders.includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : 'desc';

    if (finalSortBy === 'product_title') {
      query += ` ORDER BY p.title ${finalSortOrder}`;
    } else {
      query += ` ORDER BY ps.${finalSortBy} ${finalSortOrder}`;
    }

    // Add pagination
    query += ' LIMIT ? OFFSET ?';
    queryParams.push(parsedLimit, offset);

    // Get stock data
    const [stocks] = await pool.execute(query, queryParams);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total 
      FROM product_stock ps
      LEFT JOIN products p ON ps.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE 1=1
    `;

    const countParams = [req.customer_id];

    if (productId && !isNaN(productId)) {
      countQuery += ' AND ps.product_id = ?';
      countParams.push(parseInt(productId));
    }

    if (soldStatus === 'sold') {
      countQuery += ' AND ps.sold = 1';
    } else if (soldStatus === 'unsold') {
      countQuery += ' AND ps.sold = 0';
    }

    if (search && search.trim() !== '') {
      countQuery += ' AND (ps.license_key LIKE ? OR p.title LIKE ? OR c.title LIKE ?)';
      const searchPattern = `%${search.trim()}%`;
      countParams.push(searchPattern, searchPattern, searchPattern);
    }

    const [countResult] = await pool.execute(countQuery, countParams);
    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / parsedLimit);

    res.json({
      success: true,
      data: stocks,
      pagination: {
        currentPage: parsedPage,
        totalPages,
        totalItems,
        itemsPerPage: parsedLimit,
        hasNextPage: parsedPage < totalPages,
        hasPrevPage: parsedPage > 1
      }
    });

  } catch (error) {
    console.error('Get stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get stock for specific product
app.get('/admin/stock/:productId', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const { productId } = req.params;

    // Validate product ID
    if (!productId || isNaN(productId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid product ID is required'
      });
    }

    // Check if product exists for this customer
    const [productCheck] = await pool.execute(
      'SELECT id, title FROM products WHERE id = ? AND customer_id = ?',
      [productId, req.customer_id]
    );

    if (productCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Get stock for this product
    const [stocks] = await pool.execute(`
      SELECT 
        ps.id, ps.product_id, ps.license_key, ps.sold, ps.created_at,
        p.title as product_title, p.price
      FROM product_stock ps
      LEFT JOIN products p ON ps.product_id = p.id
      WHERE ps.product_id = ? AND ps.customer_id = ?
      ORDER BY ps.created_at DESC
    `, [productId, req.customer_id]);

    // Get summary
    const [summary] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN sold = 0 THEN 1 ELSE 0 END) as available,
        SUM(CASE WHEN sold = 1 THEN 1 ELSE 0 END) as sold
      FROM product_stock 
      WHERE product_id = ? AND customer_id = ?
    `, [productId, req.customer_id]);

    res.json({
      success: true,
      product: productCheck[0],
      stocks,
      summary: summary[0]
    });

  } catch (error) {
    console.error('Get product stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Add new license key to stock
app.post('/admin/stock', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const { product_id, license_key } = req.body;

    // Validate required fields
    if (!product_id || !license_key) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and license key are required'
      });
    }

    // Check if product exists for this customer
    const [productCheck] = await pool.execute(
      'SELECT id, title FROM products WHERE id = ? AND customer_id = ?',
      [product_id, req.customer_id]
    );

    if (productCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // License key validation removed - allowing duplicates

    // Insert new stock
    const [result] = await pool.execute(
      'INSERT INTO product_stock (product_id, license_key, customer_id) VALUES (?, ?, ?)',
      [product_id, license_key, req.customer_id]
    );

    // Update product stock count
    await pool.execute(
      'UPDATE products SET stock = stock + 1 WHERE id = ? AND customer_id = ?',
      [product_id, req.customer_id]
    );

    // Get created stock with product details
    const [newStock] = await pool.execute(`
      SELECT 
        ps.id, ps.product_id, ps.license_key, ps.sold, ps.created_at,
        p.title as product_title, p.price, p.stock
      FROM product_stock ps
      LEFT JOIN products p ON ps.product_id = p.id
      WHERE ps.id = ?
    `, [result.insertId]);

    res.status(201).json({
      success: true,
      message: 'License key added successfully',
      stock: newStock[0]
    });

  } catch (error) {
    console.error('Add stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update license key
app.put('/admin/stock/:stockId', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const { stockId } = req.params;
    const { license_key, sold } = req.body;

    // Validate stock ID
    if (!stockId || isNaN(stockId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid stock ID is required'
      });
    }

    // Check if stock exists for this customer's products
    const [stockCheck] = await pool.execute(`
      SELECT ps.id, ps.product_id, ps.license_key, ps.sold, p.title as product_title
      FROM product_stock ps
      LEFT JOIN products p ON ps.product_id = p.id
      WHERE ps.id = ? AND ps.customer_id = ?
    `, [stockId, req.customer_id]);

    if (stockCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found'
      });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (license_key !== undefined) {
      // License key validation removed - allowing duplicates
      updateFields.push('license_key = ?');
      updateValues.push(license_key);
    }

    if (sold !== undefined) {
      updateFields.push('sold = ?');
      updateValues.push(sold ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    updateValues.push(stockId);

    // Update stock
    await pool.execute(
      `UPDATE product_stock SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    // Get updated stock
    const [updatedStock] = await pool.execute(`
      SELECT 
        ps.id, ps.product_id, ps.license_key, ps.sold, ps.created_at,
        p.title as product_title, p.price
      FROM product_stock ps
      LEFT JOIN products p ON ps.product_id = p.id
      WHERE ps.id = ?
    `, [stockId]);

    res.json({
      success: true,
      message: 'Stock updated successfully',
      stock: updatedStock[0]
    });

  } catch (error) {
    console.error('Update stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Delete license key from stock
app.delete('/admin/stock/:stockId', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const { stockId } = req.params;

    // Validate stock ID
    if (!stockId || isNaN(stockId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid stock ID is required'
      });
    }

    // Check if stock exists for this customer's products
    const [stockCheck] = await pool.execute(`
      SELECT ps.id, ps.product_id, ps.license_key, ps.sold, p.title as product_title
      FROM product_stock ps
      LEFT JOIN products p ON ps.product_id = p.id
      WHERE ps.id = ? AND ps.customer_id = ?
    `, [stockId, req.customer_id]);

    if (stockCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Stock not found'
      });
    }

    // Check if license key has been sold
    if (stockCheck[0].sold === 1) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete sold license key'
      });
    }

    // Delete stock
    await pool.execute(
      'DELETE FROM product_stock WHERE id = ?',
      [stockId]
    );

    // Update product stock count (decrease by 1)
    await pool.execute(
      'UPDATE products SET stock = GREATEST(stock - 1, 0) WHERE id = ? AND customer_id = ?',
      [stockCheck[0].product_id, req.customer_id]
    );

    res.json({
      success: true,
      message: 'Stock deleted successfully',
      stock: {
        id: stockCheck[0].id,
        license_key: stockCheck[0].license_key,
        product_title: stockCheck[0].product_title
      }
    });

  } catch (error) {
    console.error('Delete stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Bulk add license keys
app.post('/admin/stock/bulk', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const { product_id, license_keys } = req.body;

    // Validate required fields
    if (!product_id || !license_keys || !Array.isArray(license_keys) || license_keys.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Product ID and array of license keys are required'
      });
    }

    // Check if product exists for this customer
    const [productCheck] = await pool.execute(
      'SELECT id, title FROM products WHERE id = ? AND customer_id = ?',
      [product_id, req.customer_id]
    );

    if (productCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    // Filter out empty license keys (allow duplicates)
    const cleanKeys = license_keys.filter(key => key && key.trim());

    if (cleanKeys.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid license keys provided'
      });
    }

    // Bulk insert all license keys (duplicates allowed)
    const insertValues = cleanKeys.map(key => [product_id, key, req.customer_id]);

    await pool.execute(
      `INSERT INTO product_stock (product_id, license_key, customer_id) VALUES ${insertValues.map(() => '(?, ?, ?)').join(', ')}`,
      insertValues.flat()
    );

    // Update product stock count by the number of keys added
    await pool.execute(
      'UPDATE products SET stock = stock + ? WHERE id = ? AND customer_id = ?',
      [cleanKeys.length, product_id, req.customer_id]
    );

    res.status(201).json({
      success: true,
      message: `Successfully added ${cleanKeys.length} license keys`,
      added_count: cleanKeys.length,
      added_keys: cleanKeys
    });

  } catch (error) {
    console.error('Bulk add stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Sync product stock counts with actual license keys
app.post('/admin/stock/sync', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const { product_id = null } = req.body;

    let whereClause = 'WHERE p.customer_id = ?';
    let queryParams = [req.customer_id];

    if (product_id) {
      whereClause += ' AND p.id = ?';
      queryParams.push(product_id);
    }

    // Calculate actual stock counts from product_stock table
    const [stockCounts] = await pool.execute(`
      SELECT 
        p.id as product_id,
        p.title as product_title,
        p.stock as current_stock,
        COALESCE(stock_count.actual_count, 0) as actual_stock,
        COALESCE(stock_count.available_count, 0) as available_stock,
        COALESCE(stock_count.sold_count, 0) as sold_stock
      FROM products p
      LEFT JOIN (
        SELECT 
          ps.product_id,
          COUNT(*) as actual_count,
          SUM(CASE WHEN ps.sold = 0 THEN 1 ELSE 0 END) as available_count,
          SUM(CASE WHEN ps.sold = 1 THEN 1 ELSE 0 END) as sold_count
        FROM product_stock ps
        GROUP BY ps.product_id
      ) stock_count ON p.id = stock_count.product_id
      ${whereClause}
    `, queryParams);

    // Update products with correct stock counts
    const updates = [];
    for (const product of stockCounts) {
      if (product.current_stock !== product.actual_stock) {
        await pool.execute(
          'UPDATE products SET stock = ? WHERE id = ? AND customer_id = ?',
          [product.actual_stock, product.product_id, req.customer_id]
        );
        updates.push({
          product_id: product.product_id,
          product_title: product.product_title,
          old_stock: product.current_stock,
          new_stock: product.actual_stock,
          available: product.available_stock,
          sold: product.sold_stock
        });
      }
    }

    res.json({
      success: true,
      message: `Stock counts synchronized for ${updates.length} products`,
      updates,
      total_products_checked: stockCounts.length
    });

  } catch (error) {
    console.error('Sync stock error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get stock analytics
app.get('/admin/stock/analytics', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    // Get overall stock statistics
    const [overallStats] = await pool.execute(`
      SELECT 
        COUNT(*) as total_stock,
        SUM(CASE WHEN sold = 0 THEN 1 ELSE 0 END) as available_stock,
        SUM(CASE WHEN sold = 1 THEN 1 ELSE 0 END) as sold_stock
      FROM product_stock 
      WHERE customer_id = ?
    `, []);

    // Get stock by product
    const [productStats] = await pool.execute(`
      SELECT 
        p.id as product_id,
        p.title as product_title,
        COUNT(*) as total_stock,
        SUM(CASE WHEN ps.sold = 0 THEN 1 ELSE 0 END) as available_stock,
        SUM(CASE WHEN ps.sold = 1 THEN 1 ELSE 0 END) as sold_stock,
        ROUND((SUM(CASE WHEN ps.sold = 1 THEN 1 ELSE 0 END) / COUNT(*)) * 100, 2) as sold_percentage
      FROM product_stock ps
      LEFT JOIN products p ON ps.product_id = p.id
      WHERE ps.customer_id = ?
      GROUP BY p.id, p.title
      ORDER BY total_stock DESC
    `, []);

    // Get recent stock activity (last 30 days)
    const [recentActivity] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as keys_added
      FROM product_stock 
      WHERE customer_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, []);

    // Calculate overall statistics
    const overall = overallStats[0];
    const soldPercentage = overall.total_stock > 0
      ? Math.round((overall.sold_stock / overall.total_stock) * 100)
      : 0;

    res.json({
      success: true,
      analytics: {
        overall: {
          ...overall,
          sold_percentage: soldPercentage
        },
        by_product: productStats,
        recent_activity: recentActivity
      }
    });

  } catch (error) {
    console.error('Stock analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// ====================================
// ADMIN USER MANAGEMENT APIs
// ====================================

// Get all users (Admin only)
app.get('/admin/users', authenticateToken, requirePermission('can_edit_users'), async (req, res) => {
  try {
    const { page = 1, limit = 10, search = '', role = '' } = req.query;

    // Parse pagination parameters first
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 10;
    const parsedOffset = (parsedPage - 1) * parsedLimit;

    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    // Build search conditions
    let searchConditions = 'WHERE u.customer_id = ?';
    let searchParams = [req.customer_id];

    if (search) {
      searchConditions += ' AND (u.fullname LIKE ? OR u.email LIKE ?)';
      searchParams.push(`%${search}%`, `%${search}%`);
    }

    if (role) {
      searchConditions += ' AND u.role = ?';
      searchParams.push(role);
    }

    // Get total count
    const [totalResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM users u ${searchConditions}`,
      searchParams
    );
    const total = totalResult[0].total;

    // Get users with pagination
    // Sanitize LIMIT and OFFSET values for direct SQL interpolation
    const limitSafe = Math.min(Math.max(parseInt(parsedLimit, 10) || 10, 1), 100);
    const offsetSafe = Math.max(parseInt(parsedOffset, 10) || 0, 0);

    console.log('Admin Users Query Debug:', {
      searchConditions,
      searchParams,
      limitSafe,
      offsetSafe,
      paramCount: searchParams.length,
      placeholderCount: (searchConditions + ' ORDER BY u.created_at DESC').match(/\?/g)?.length || 0
    });

    const [users] = await pool.execute(
      `SELECT 
        u.id,
        u.fullname,
        u.email,
        u.role,
        u.money,
        u.points,
        u.discord_id,
        u.created_at,
        r.can_edit_categories,
        r.can_edit_products,
        r.can_edit_users,
        r.can_edit_orders,
        r.can_manage_keys,
        r.can_view_reports,
        r.can_manage_promotions,
        r.can_manage_settings,
        r.can_access_reseller_price
      FROM users u
      LEFT JOIN roles r ON u.role = r.rank_name
      ${searchConditions}
      ORDER BY u.created_at DESC
      LIMIT ${limitSafe} OFFSET ${offsetSafe}`,
      searchParams
    );

    res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users: users.map(user => ({
          id: user.id,
          fullname: user.fullname,
          email: user.email,
          role: user.role,
          money: user.money,
          points: user.points,
          discord_id: user.discord_id,
          created_at: user.created_at,
          permissions: {
            can_edit_categories: Boolean(user.can_edit_categories),
            can_edit_products: Boolean(user.can_edit_products),
            can_edit_users: Boolean(user.can_edit_users),
            can_edit_orders: Boolean(user.can_edit_orders),
            can_manage_keys: Boolean(user.can_manage_keys),
            can_view_reports: Boolean(user.can_view_reports),
            can_manage_promotions: Boolean(user.can_manage_promotions),
            can_manage_settings: Boolean(user.can_manage_settings),
            can_access_reseller_price: Boolean(user.can_access_reseller_price)
          }
        })),
        pagination: {
          page: parsedPage,
          limit: limitSafe,
          total: total,
          totalPages: Math.ceil(total / limitSafe)
        }
      }
    });

  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Create new user (Admin only)
app.post('/admin/users', authenticateToken, requirePermission('can_edit_users'), async (req, res) => {
  try {
    const { fullname, email, password, role = 'member', money = 0, points = 0, discord_id } = req.body;

    // Validate required fields
    if (!fullname || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Fullname, email, and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    // Check if user already exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ? AND customer_id = ?',
      [email, req.customer_id]
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Validate role exists
    const [roleCheck] = await pool.execute(
      'SELECT id FROM roles WHERE rank_name = ?',
      [role]
    );

    if (roleCheck.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role. Available roles: member, moderator, admin, super_admin, reseller'
      });
    }

    // Hash password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert new user
    const [result] = await pool.execute(
      'INSERT INTO users (customer_id, fullname, email, password, role, money, points, discord_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [req.customer_id, fullname, email, hashedPassword, role, money, points, discord_id || null]
    );

    // Get the created user with role info
    const [newUser] = await pool.execute(
      `SELECT 
        u.id,
        u.fullname,
        u.email,
        u.role,
        u.money,
        u.points,
        u.discord_id,
        u.created_at,
        r.can_edit_categories,
        r.can_edit_products,
        r.can_edit_users,
        r.can_edit_orders,
        r.can_manage_keys,
        r.can_view_reports,
        r.can_manage_promotions,
        r.can_manage_settings,
        r.can_access_reseller_price
      FROM users u
      LEFT JOIN roles r ON u.role = r.rank_name
      WHERE u.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        user: {
          id: newUser[0].id,
          fullname: newUser[0].fullname,
          email: newUser[0].email,
          role: newUser[0].role,
          money: newUser[0].money,
          points: newUser[0].points,
          discord_id: newUser[0].discord_id,
          created_at: newUser[0].created_at,
          permissions: {
            can_edit_categories: Boolean(newUser[0].can_edit_categories),
            can_edit_products: Boolean(newUser[0].can_edit_products),
            can_edit_users: Boolean(newUser[0].can_edit_users),
            can_edit_orders: Boolean(newUser[0].can_edit_orders),
            can_manage_keys: Boolean(newUser[0].can_manage_keys),
            can_view_reports: Boolean(newUser[0].can_view_reports),
            can_manage_promotions: Boolean(newUser[0].can_manage_promotions),
            can_manage_settings: Boolean(newUser[0].can_manage_settings),
            can_access_reseller_price: Boolean(newUser[0].can_access_reseller_price)
          }
        }
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update user (Admin only)
app.put('/admin/users/:id', authenticateToken, requirePermission('can_edit_users'), async (req, res) => {
  try {
    const { id } = req.params;
    const { fullname, email, password, role, money, points, discord_id } = req.body;

    // Check if user exists
    const [existingUser] = await pool.execute(
      'SELECT id, email FROM users WHERE id = ? AND customer_id = ?',
      [id, req.customer_id]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (fullname !== undefined) {
      updateFields.push('fullname = ?');
      updateValues.push(fullname);
    }

    if (email !== undefined) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email format'
        });
      }

      // Check if email is already taken by another user
      if (email !== existingUser[0].email) {
        const [emailCheck] = await pool.execute(
          'SELECT id FROM users WHERE email = ? AND customer_id = ? AND id != ?',
          [email, req.customer_id, id]
        );

        if (emailCheck.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'Email is already taken by another user'
          });
        }
      }

      updateFields.push('email = ?');
      updateValues.push(email);
    }

    if (password !== undefined) {
      // Hash new password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(password, saltRounds);
      updateFields.push('password = ?');
      updateValues.push(hashedPassword);
    }

    if (role !== undefined) {
      // Validate role exists
      const [roleCheck] = await pool.execute(
        'SELECT id FROM roles WHERE rank_name = ?',
        [role]
      );

      if (roleCheck.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Invalid role. Available roles: member, moderator, admin, super_admin, reseller'
        });
      }

      updateFields.push('role = ?');
      updateValues.push(role);
    }

    if (money !== undefined) {
      updateFields.push('money = ?');
      updateValues.push(money);
    }

    if (points !== undefined) {
      updateFields.push('points = ?');
      updateValues.push(points);
    }

    if (discord_id !== undefined) {
      updateFields.push('discord_id = ?');
      updateValues.push(discord_id || null);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    // Update user
    updateValues.push(id, req.customer_id);
    await pool.execute(
      `UPDATE users SET ${updateFields.join(', ')} WHERE id = ? AND customer_id = ?`,
      updateValues
    );

    // Get updated user
    const [updatedUser] = await pool.execute(
      `SELECT 
        u.id,
        u.fullname,
        u.email,
        u.role,
        u.money,
        u.points,
        u.discord_id,
        u.created_at,
        r.can_edit_categories,
        r.can_edit_products,
        r.can_edit_users,
        r.can_edit_orders,
        r.can_manage_keys,
        r.can_view_reports,
        r.can_manage_promotions,
        r.can_manage_settings,
        r.can_access_reseller_price
      FROM users u
      LEFT JOIN roles r ON u.role = r.rank_name
      WHERE u.id = ? AND u.customer_id = ?`,
      [id, req.customer_id]
    );

    res.json({
      success: true,
      message: 'User updated successfully',
      data: {
        user: {
          id: updatedUser[0].id,
          fullname: updatedUser[0].fullname,
          email: updatedUser[0].email,
          role: updatedUser[0].role,
          money: updatedUser[0].money,
          points: updatedUser[0].points,
          discord_id: updatedUser[0].discord_id,
          created_at: updatedUser[0].created_at,
          permissions: {
            can_edit_categories: Boolean(updatedUser[0].can_edit_categories),
            can_edit_products: Boolean(updatedUser[0].can_edit_products),
            can_edit_users: Boolean(updatedUser[0].can_edit_users),
            can_edit_orders: Boolean(updatedUser[0].can_edit_orders),
            can_manage_keys: Boolean(updatedUser[0].can_manage_keys),
            can_view_reports: Boolean(updatedUser[0].can_view_reports),
            can_manage_promotions: Boolean(updatedUser[0].can_manage_promotions),
            can_manage_settings: Boolean(updatedUser[0].can_manage_settings),
            can_access_reseller_price: Boolean(updatedUser[0].can_access_reseller_price)
          }
        }
      }
    });

  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Delete user (Admin only)
app.delete('/admin/users/:id', authenticateToken, requirePermission('can_edit_users'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if user exists
    const [existingUser] = await pool.execute(
      'SELECT id, fullname, email FROM users WHERE id = ? AND customer_id = ?',
      [id, req.customer_id]
    );

    if (existingUser.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Prevent self-deletion
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete your own account'
      });
    }

    // Delete user (CASCADE will handle related records)
    await pool.execute(
      'DELETE FROM users WHERE id = ? AND customer_id = ?',
      [id, req.customer_id]
    );

    res.json({
      success: true,
      message: 'User deleted successfully',
      deleted_user: {
        id: existingUser[0].id,
        fullname: existingUser[0].fullname,
        email: existingUser[0].email
      }
    });

  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// ====================================
// ADMIN ROLES MANAGEMENT APIs
// ====================================

// Get all roles (Admin only)
app.get('/admin/roles', authenticateToken, requirePermission('can_edit_users'), async (req, res) => {
  try {
    // Check if customer_id is available
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const [roles] = await pool.execute(
      `SELECT 
        id,
        rank_name,
        can_edit_categories,
        can_edit_products,
        can_edit_users,
        can_edit_orders,
        can_manage_keys,
        can_view_reports,
        can_manage_promotions,
        can_manage_settings,
        can_access_reseller_price,
        created_at
      FROM roles 
      WHERE customer_id = ?
      ORDER BY id ASC`,
      [req.customer_id]
    );

    res.json({
      success: true,
      message: 'Roles retrieved successfully',
      data: {
        roles: roles.map(role => ({
          ...role,
          permissions: {
            can_edit_categories: Boolean(role.can_edit_categories),
            can_edit_products: Boolean(role.can_edit_products),
            can_edit_users: Boolean(role.can_edit_users),
            can_edit_orders: Boolean(role.can_edit_orders),
            can_manage_keys: Boolean(role.can_manage_keys),
            can_view_reports: Boolean(role.can_view_reports),
            can_manage_promotions: Boolean(role.can_manage_promotions),
            can_manage_settings: Boolean(role.can_manage_settings),
            can_access_reseller_price: Boolean(role.can_access_reseller_price)
          }
        }))
      }
    });

  } catch (error) {
    console.error('Get roles error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Create new role (Admin only)
app.post('/admin/roles', authenticateToken, requirePermission('can_edit_users'), async (req, res) => {
  try {
    const {
      rank_name,
      can_edit_categories = false,
      can_edit_products = false,
      can_edit_users = false,
      can_edit_orders = false,
      can_manage_keys = false,
      can_view_reports = false,
      can_manage_promotions = false,
      can_manage_settings = false,
      can_access_reseller_price = false
    } = req.body;

    // Validate required fields
    if (!rank_name) {
      return res.status(400).json({
        success: false,
        message: 'Role name is required'
      });
    }

    // Validate role name format (alphanumeric and underscore only)
    const roleNameRegex = /^[a-zA-Z0-9_]+$/;
    if (!roleNameRegex.test(rank_name)) {
      return res.status(400).json({
        success: false,
        message: 'Role name can only contain letters, numbers, and underscores'
      });
    }

    // Check if role already exists
    const [existingRole] = await pool.execute(
      'SELECT id FROM roles WHERE rank_name = ? AND customer_id = ?',
      [rank_name, req.customer_id]
    );

    if (existingRole.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Role with this name already exists'
      });
    }

    // Insert new role
    const [result] = await pool.execute(
      `INSERT INTO roles (
        customer_id,
        rank_name, 
        can_edit_categories, 
        can_edit_products, 
        can_edit_users, 
        can_edit_orders, 
        can_manage_keys, 
        can_view_reports, 
        can_manage_promotions, 
        can_manage_settings, 
        can_access_reseller_price
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.customer_id,
        rank_name,
        can_edit_categories ? 1 : 0,
        can_edit_products ? 1 : 0,
        can_edit_users ? 1 : 0,
        can_edit_orders ? 1 : 0,
        can_manage_keys ? 1 : 0,
        can_view_reports ? 1 : 0,
        can_manage_promotions ? 1 : 0,
        can_manage_settings ? 1 : 0,
        can_access_reseller_price ? 1 : 0
      ]
    );

    // Get the created role
    const [newRole] = await pool.execute(
      `SELECT 
        id,
        rank_name,
        can_edit_categories,
        can_edit_products,
        can_edit_users,
        can_edit_orders,
        can_manage_keys,
        can_view_reports,
        can_manage_promotions,
        can_manage_settings,
        can_access_reseller_price,
        created_at
      FROM roles 
      WHERE id = ? AND customer_id = ?`,
      [result.insertId, req.customer_id]
    );

    res.status(201).json({
      success: true,
      message: 'Role created successfully',
      data: {
        role: {
          ...newRole[0],
          permissions: {
            can_edit_categories: Boolean(newRole[0].can_edit_categories),
            can_edit_products: Boolean(newRole[0].can_edit_products),
            can_edit_users: Boolean(newRole[0].can_edit_users),
            can_edit_orders: Boolean(newRole[0].can_edit_orders),
            can_manage_keys: Boolean(newRole[0].can_manage_keys),
            can_view_reports: Boolean(newRole[0].can_view_reports),
            can_manage_promotions: Boolean(newRole[0].can_manage_promotions),
            can_manage_settings: Boolean(newRole[0].can_manage_settings),
            can_access_reseller_price: Boolean(newRole[0].can_access_reseller_price)
          }
        }
      }
    });

  } catch (error) {
    console.error('Create role error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Update role (Admin only)
app.put('/admin/roles/:id', authenticateToken, requirePermission('can_edit_users'), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      rank_name,
      can_edit_categories,
      can_edit_products,
      can_edit_users,
      can_edit_orders,
      can_manage_keys,
      can_view_reports,
      can_manage_promotions,
      can_manage_settings,
      can_access_reseller_price
    } = req.body;

    // Check if role exists
    const [existingRole] = await pool.execute(
      'SELECT id, rank_name FROM roles WHERE id = ? AND customer_id = ?',
      [id, req.customer_id]
    );

    if (existingRole.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Build update query dynamically
    const updateFields = [];
    const updateValues = [];

    if (rank_name !== undefined) {
      // Validate role name format
      const roleNameRegex = /^[a-zA-Z0-9_]+$/;
      if (!roleNameRegex.test(rank_name)) {
        return res.status(400).json({
          success: false,
          message: 'Role name can only contain letters, numbers, and underscores'
        });
      }

      // Check if role name is already taken by another role
      if (rank_name !== existingRole[0].rank_name) {
        const [nameCheck] = await pool.execute(
          'SELECT id FROM roles WHERE rank_name = ? AND id != ? AND customer_id = ?',
          [rank_name, id, req.customer_id]
        );

        if (nameCheck.length > 0) {
          return res.status(409).json({
            success: false,
            message: 'Role name is already taken by another role'
          });
        }
      }

      updateFields.push('rank_name = ?');
      updateValues.push(rank_name);
    }

    // Add permission fields
    if (can_edit_categories !== undefined) {
      updateFields.push('can_edit_categories = ?');
      updateValues.push(can_edit_categories ? 1 : 0);
    }

    if (can_edit_products !== undefined) {
      updateFields.push('can_edit_products = ?');
      updateValues.push(can_edit_products ? 1 : 0);
    }

    if (can_edit_users !== undefined) {
      updateFields.push('can_edit_users = ?');
      updateValues.push(can_edit_users ? 1 : 0);
    }

    if (can_edit_orders !== undefined) {
      updateFields.push('can_edit_orders = ?');
      updateValues.push(can_edit_orders ? 1 : 0);
    }

    if (can_manage_keys !== undefined) {
      updateFields.push('can_manage_keys = ?');
      updateValues.push(can_manage_keys ? 1 : 0);
    }

    if (can_view_reports !== undefined) {
      updateFields.push('can_view_reports = ?');
      updateValues.push(can_view_reports ? 1 : 0);
    }

    if (can_manage_promotions !== undefined) {
      updateFields.push('can_manage_promotions = ?');
      updateValues.push(can_manage_promotions ? 1 : 0);
    }

    if (can_manage_settings !== undefined) {
      updateFields.push('can_manage_settings = ?');
      updateValues.push(can_manage_settings ? 1 : 0);
    }

    if (can_access_reseller_price !== undefined) {
      updateFields.push('can_access_reseller_price = ?');
      updateValues.push(can_access_reseller_price ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields to update'
      });
    }

    // Update role
    updateValues.push(id, req.customer_id);
    await pool.execute(
      `UPDATE roles SET ${updateFields.join(', ')} WHERE id = ? AND customer_id = ?`,
      updateValues
    );

    // Get updated role
    const [updatedRole] = await pool.execute(
      `SELECT 
        id,
        rank_name,
        can_edit_categories,
        can_edit_products,
        can_edit_users,
        can_edit_orders,
        can_manage_keys,
        can_view_reports,
        can_manage_promotions,
        can_manage_settings,
        can_access_reseller_price,
        created_at
      FROM roles 
      WHERE id = ? AND customer_id = ?`,
      [id, req.customer_id]
    );

    res.json({
      success: true,
      message: 'Role updated successfully',
      data: {
        role: {
          ...updatedRole[0],
          permissions: {
            can_edit_categories: Boolean(updatedRole[0].can_edit_categories),
            can_edit_products: Boolean(updatedRole[0].can_edit_products),
            can_edit_users: Boolean(updatedRole[0].can_edit_users),
            can_edit_orders: Boolean(updatedRole[0].can_edit_orders),
            can_manage_keys: Boolean(updatedRole[0].can_manage_keys),
            can_view_reports: Boolean(updatedRole[0].can_view_reports),
            can_manage_promotions: Boolean(updatedRole[0].can_manage_promotions),
            can_manage_settings: Boolean(updatedRole[0].can_manage_settings),
            can_access_reseller_price: Boolean(updatedRole[0].can_access_reseller_price)
          }
        }
      }
    });

  } catch (error) {
    console.error('Update role error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Delete role (Admin only)
app.delete('/admin/roles/:id', authenticateToken, requirePermission('can_edit_users'), async (req, res) => {
  try {
    const { id } = req.params;

    // Check if role exists
    const [existingRole] = await pool.execute(
      'SELECT id, rank_name FROM roles WHERE id = ? AND customer_id = ?',
      [id, req.customer_id]
    );

    if (existingRole.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Role not found'
      });
    }

    // Check if any users are using this role
    const [usersWithRole] = await pool.execute(
      'SELECT COUNT(*) as count FROM users WHERE role = ? AND customer_id = ?',
      [existingRole[0].rank_name, req.customer_id]
    );

    if (usersWithRole[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete role "${existingRole[0].rank_name}" because ${usersWithRole[0].count} user(s) are currently using this role`
      });
    }

    // Delete role
    await pool.execute(
      'DELETE FROM roles WHERE id = ? AND customer_id = ?',
      [id, req.customer_id]
    );

    res.json({
      success: true,
      message: 'Role deleted successfully',
      data: {
        deleted_role: {
          id: existingRole[0].id,
          rank_name: existingRole[0].rank_name
        }
      }
    });

  } catch (error) {
    console.error('Delete role error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});






// ==================== SALES STATISTICS API ====================

// Get sales statistics (daily, weekly, monthly)
app.get('/stats', authenticateToken, requirePermission('can_edit_products'), async (req, res) => {
  try {
    const {
      period = 'daily', // 'daily', 'weekly', 'monthly'
      start_date = null,
      end_date = null,
      limit = 30 // จำนวนช่วงเวลาที่ต้องการดึง
    } = req.query;

    const customer_id = req.customer_id;

    // Ensure parsedLimit is a valid integer
    let parsedLimit = parseInt(limit, 10);
    if (isNaN(parsedLimit) || parsedLimit <= 0) {
      parsedLimit = 30;
    }
    parsedLimit = Math.min(parsedLimit, 365);

    // Build date filters
    let dateFilter = '';
    const dateParams = [];

    if (start_date) {
      dateFilter += ' AND t.created_at >= ?';
      dateParams.push(new Date(start_date));
    }

    if (end_date) {
      dateFilter += ' AND t.created_at <= ?';
      dateParams.push(new Date(end_date));
    }

    // สร้าง query ตาม period ที่เลือก
    let groupByClause = '';
    let selectDateFormat = '';

    if (period === 'daily') {
      selectDateFormat = 'DATE(t.created_at) as period_date';
      groupByClause = 'DATE(t.created_at)';
    } else if (period === 'weekly') {
      selectDateFormat = 'YEARWEEK(t.created_at, 1) as period_date';
      groupByClause = 'YEARWEEK(t.created_at, 1)';
    } else if (period === 'monthly') {
      selectDateFormat = 'DATE_FORMAT(t.created_at, "%Y-%m") as period_date';
      groupByClause = 'DATE_FORMAT(t.created_at, "%Y-%m")';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid period. Must be "daily", "weekly", or "monthly"'
      });
    }

    // Query สำหรับสถิติการขาย
    const statsQuery = `
      SELECT 
        ${selectDateFormat},
        COUNT(DISTINCT t.id) as total_transactions,
        COUNT(DISTINCT t.user_id) as unique_customers,
        COALESCE(SUM(t.total_price), 0) as total_revenue,
        COALESCE(AVG(t.total_price), 0) as average_order_value,
        COUNT(ti.id) as total_items_sold,
        COALESCE(SUM(ti.quantity), 0) as total_quantity_sold,
        MIN(t.created_at) as period_start,
        MAX(t.created_at) as period_end
      FROM transactions t
      LEFT JOIN transaction_items ti ON t.id = ti.transaction_id AND ti.customer_id = ?
      WHERE t.customer_id = ? ${dateFilter}
      GROUP BY ${groupByClause}
      ORDER BY period_date DESC
      LIMIT ?
    `;

    // Build parameters in correct order
    const statsParams = [customer_id, customer_id, ...dateParams, parsedLimit];

    // ใช้ .query() แทน .execute() เพราะ LIMIT ? ไม่รองรับใน prepared statements ของ MySQL2
    const [stats] = await pool.query(statsQuery, statsParams);

    // Query สำหรับ top selling products ในช่วงเวลาที่เลือก
    const topProductsQuery = `
      SELECT 
        p.id,
        p.title,
        p.image,
        p.price,
        COUNT(DISTINCT ti.transaction_id) as times_sold,
        COALESCE(SUM(ti.quantity), 0) as total_quantity_sold,
        COALESCE(SUM(ti.price * ti.quantity), 0) as total_revenue
      FROM transaction_items ti
      LEFT JOIN products p ON ti.product_id = p.id
      LEFT JOIN transactions t ON ti.transaction_id = t.id
      WHERE ti.customer_id = ? AND t.customer_id = ? ${dateFilter}
      GROUP BY p.id, p.title, p.image, p.price
      ORDER BY total_revenue DESC
      LIMIT 10
    `;

    const topProductsParams = [customer_id, customer_id, ...dateParams];

    const [topProducts] = await pool.query(topProductsQuery, topProductsParams);

    // Query สำหรับ overall summary
    const summaryQuery = `
      SELECT 
        COUNT(DISTINCT t.id) as total_transactions,
        COUNT(DISTINCT t.user_id) as total_customers,
        COALESCE(SUM(t.total_price), 0) as total_revenue,
        COALESCE(AVG(t.total_price), 0) as average_order_value,
        COUNT(ti.id) as total_items_sold,
        COALESCE(SUM(ti.quantity), 0) as total_quantity_sold
      FROM transactions t
      LEFT JOIN transaction_items ti ON t.id = ti.transaction_id AND ti.customer_id = ?
      WHERE t.customer_id = ? ${dateFilter}
    `;

    const summaryParams = [customer_id, customer_id, ...dateParams];

    const [summary] = await pool.query(summaryQuery, summaryParams);

    // Format response
    res.json({
      success: true,
      message: 'Statistics retrieved successfully',
      data: {
        period: period,
        customer_id: customer_id,
        summary: summary[0],
        statistics: stats.map(stat => ({
          period_date: stat.period_date,
          period_start: stat.period_start,
          period_end: stat.period_end,
          total_transactions: parseInt(stat.total_transactions),
          unique_customers: parseInt(stat.unique_customers),
          total_revenue: parseFloat(stat.total_revenue),
          average_order_value: parseFloat(stat.average_order_value),
          total_items_sold: parseInt(stat.total_items_sold),
          total_quantity_sold: parseInt(stat.total_quantity_sold)
        })),
        top_products: topProducts.map(product => ({
          id: product.id,
          title: product.title,
          image: product.image,
          price: parseFloat(product.price),
          times_sold: parseInt(product.times_sold),
          total_quantity_sold: parseInt(product.total_quantity_sold),
          total_revenue: parseFloat(product.total_revenue)
        }))
      },
      filters: {
        start_date: start_date,
        end_date: end_date,
        limit: parsedLimit
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});



// Health check page with API status
app.get('/health', async (req, res) => {
  const endpoints = [
    { name: 'Home Page', path: '/', method: 'GET', public: true },
    { name: 'Get Categories', path: '/categories', method: 'GET', public: true },
    { name: 'Get Nested Categories', path: '/categories/nested', method: 'GET', public: true },
    { name: 'Get Products', path: '/products', method: 'GET', public: true },
    { name: 'Get Theme Settings', path: '/theme-settings', method: 'GET', public: true },
    { name: 'Get Web Config', path: '/get-web-config', method: 'GET', public: true },
    { name: 'Search Products', path: '/search?query=test', method: 'GET', public: true },
    { name: 'Get All Reviews', path: '/reviews/all', method: 'GET', public: true },
    { name: 'Get Store Last Transactions', path: '/store/last-transactions?limit=10', method: 'GET', public: true },
    { name: 'Get Expired Day', path: '/getexpiredday', method: 'GET', public: true },
  ];

  const html = `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>API Health Check</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @keyframes pulse-slow {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }
    .pulse-slow {
      animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    @keyframes spin-slow {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .spin-slow {
      animation: spin-slow 3s linear infinite;
    }
  </style>
</head>
<body class="bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 min-h-screen text-white">
  <div class="container mx-auto px-4 py-8 max-w-6xl">
    <!-- Header -->
    <div class="text-center mb-8">
      <div class="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-blue-500 rounded-full mb-4 spin-slow">
        <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
      </div>
      <h1 class="text-5xl font-bold bg-gradient-to-r from-green-400 via-blue-500 to-purple-600 bg-clip-text text-transparent mb-2">
        API Health Check
      </h1>
      <p class="text-gray-400 text-lg">ระบบตรวจสอบสถานะ API แบบเรียลไทม์</p>
      <div class="mt-4">
        <span class="px-4 py-2 bg-gray-800 rounded-full text-sm">
          <span class="text-gray-400">Server Time:</span>
          <span class="text-green-400 font-mono ml-2" id="server-time">${new Date().toLocaleString('th-TH')}</span>
        </span>
      </div>
    </div>

    <!-- Status Overview -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-green-500 transition-all duration-300">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-400 text-sm mb-1">Total APIs</p>
            <p class="text-3xl font-bold text-white" id="total-apis">${endpoints.length}</p>
          </div>
          <div class="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path>
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-green-500 transition-all duration-300">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-400 text-sm mb-1">Healthy</p>
            <p class="text-3xl font-bold text-green-400" id="healthy-count">-</p>
          </div>
          <div class="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
          </div>
        </div>
      </div>

      <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 border border-gray-700 hover:border-red-500 transition-all duration-300">
        <div class="flex items-center justify-between">
          <div>
            <p class="text-gray-400 text-sm mb-1">Failed</p>
            <p class="text-3xl font-bold text-red-400" id="failed-count">-</p>
          </div>
          <div class="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
            <svg class="w-6 h-6 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
          </div>
        </div>
      </div>
    </div>

    <!-- API Endpoints -->
    <div class="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 overflow-hidden">
      <div class="px-6 py-4 bg-gray-800/80 border-b border-gray-700">
        <h2 class="text-2xl font-bold text-white flex items-center">
          <svg class="w-6 h-6 mr-2 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
          </svg>
          API Endpoints Status
        </h2>
      </div>
      <div class="p-6">
        <div class="space-y-4" id="endpoints-list">
          ${endpoints.map((endpoint, index) => `
          <div class="bg-gray-900/50 rounded-lg p-5 border border-gray-700 hover:border-purple-500 transition-all duration-300" data-endpoint="${index}">
            <div class="flex items-center justify-between mb-3">
              <div class="flex-1">
                <div class="flex items-center space-x-3 mb-2">
                  <span class="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-md text-sm font-mono">${endpoint.method}</span>
                  <h3 class="text-lg font-semibold text-white">${endpoint.name}</h3>
                  ${endpoint.public ? '<span class="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">Public</span>' : '<span class="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">Auth Required</span>'}
                </div>
                <p class="text-gray-400 font-mono text-sm">${endpoint.path}</p>
              </div>
              <div class="flex items-center space-x-3">
                <div class="status-indicator pulse-slow">
                  <svg class="w-6 h-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                    <circle cx="10" cy="10" r="8"></circle>
                  </svg>
                </div>
                <span class="status-text text-gray-500 font-medium">Testing...</span>
              </div>
            </div>
            <div class="status-details hidden mt-3 pt-3 border-t border-gray-700">
              <div class="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span class="text-gray-400">Status Code:</span>
                  <span class="status-code ml-2 font-mono text-white">-</span>
                </div>
                <div>
                  <span class="text-gray-400">Response Time:</span>
                  <span class="response-time ml-2 font-mono text-white">-</span>
                </div>
              </div>
            </div>
          </div>
          `).join('')}
        </div>
      </div>
    </div>

    <!-- Refresh Button -->
    <div class="text-center mt-8">
      <button onclick="testAllEndpoints()" class="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 rounded-lg font-semibold transition-all duration-300 transform hover:scale-105 shadow-lg">
        <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
        </svg>
        Refresh Tests
      </button>
    </div>
  </div>

  <script>
    const endpoints = ${JSON.stringify(endpoints)};
    
    async function testEndpoint(endpoint, index) {
      const container = document.querySelector(\`[data-endpoint="\${index}"]\`);
      const indicator = container.querySelector('.status-indicator svg');
      const statusText = container.querySelector('.status-text');
      const statusDetails = container.querySelector('.status-details');
      const statusCode = container.querySelector('.status-code');
      const responseTime = container.querySelector('.response-time');

      try {
        const startTime = Date.now();
        const response = await fetch(endpoint.path);
        const endTime = Date.now();
        const responseTimeMs = endTime - startTime;

        statusDetails.classList.remove('hidden');
        statusCode.textContent = response.status;
        responseTime.textContent = responseTimeMs + 'ms';

        if (response.ok) {
          indicator.classList.remove('text-gray-500', 'text-red-500', 'pulse-slow');
          indicator.classList.add('text-green-500');
          statusText.textContent = 'Healthy';
          statusText.classList.remove('text-gray-500', 'text-red-500');
          statusText.classList.add('text-green-500');
          container.classList.remove('border-gray-700');
          container.classList.add('border-green-500/50');
          return true;
        } else {
          throw new Error('Not OK');
        }
      } catch (error) {
        const indicator = container.querySelector('.status-indicator svg');
        indicator.classList.remove('text-gray-500', 'text-green-500', 'pulse-slow');
        indicator.classList.add('text-red-500');
        statusText.textContent = 'Failed';
        statusText.classList.remove('text-gray-500', 'text-green-500');
        statusText.classList.add('text-red-500');
        container.classList.remove('border-gray-700');
        container.classList.add('border-red-500/50');
        statusDetails.classList.remove('hidden');
        statusCode.textContent = 'Error';
        responseTime.textContent = '-';
        return false;
      }
    }

    async function testAllEndpoints() {
      const results = await Promise.all(
        endpoints.map((endpoint, index) => testEndpoint(endpoint, index))
      );

      const healthyCount = results.filter(r => r).length;
      const failedCount = results.filter(r => !r).length;

      document.getElementById('healthy-count').textContent = healthyCount;
      document.getElementById('failed-count').textContent = failedCount;
    }

    // Run tests on page load
    testAllEndpoints();

    // Update time every second
    setInterval(() => {
      document.getElementById('server-time').textContent = new Date().toLocaleString('th-TH');
    }, 1000);
  </script>
</body>
</html>
  `;

  res.send(html);
});


// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Test database connection at: http://localhost:${PORT}/test-db`);
  console.log(`Health check available at: http://localhost:${PORT}/health`);
});

// ==================== PROMPTPAY PAYMENT SYSTEM ====================

// Helper function to generate PromptPay QR code
async function generatePromptPayQR(promptpayNumber, amount) {
  try {
    // Generate PromptPay payload
    const payload = generatePayload(promptpayNumber, { amount: amount });

    // Generate QR Code as base64 image
    const qrCodeDataURL = await QRCode.toDataURL(payload);

    return {
      payload: payload,
      qrCodeImage: qrCodeDataURL
    };
  } catch (error) {
    console.error('Error generating PromptPay QR:', error);
    throw new Error('ไม่สามารถสร้าง QR Code ได้');
  }
}

// Helper function to parse LINE transaction data
function parseLineTransactionData(jsonString, targetAmount) {
  try {
    const data = JSON.parse(jsonString);
    if (!Array.isArray(data)) {
      return { status: 'error', message: 'รูปแบบข้อมูลไม่ถูกต้อง' };
    }

    const matchedTransactions = [];

    for (const transaction of data) {
      if (!transaction?.contentMetadata?.FLEX_JSON) {
        continue;
      }

      try {
        const flexJson = JSON.parse(transaction.contentMetadata.FLEX_JSON);
        if (!flexJson?.contents?.[0]?.body?.contents) {
          continue;
        }

        // Extract amount from transaction
        const amountText = flexJson.contents[0].body.contents[2]?.contents[1]?.contents[1]?.text || '';
        const cleanAmount = amountText.replace(/[บาท,]/g, '').trim();

        if (!isNumeric(cleanAmount)) {
          continue;
        }

        const amount = parseFloat(cleanAmount);
        if (amount === targetAmount) {
          const formattedAmount = amount.toFixed(2);
          const [whole, fractional] = formattedAmount.split('.');

          matchedTransactions.push({
            transactionid: transaction.id || null,
            amount: formattedAmount,
            whole_part: whole,
            fractional_part: fractional,
            time: flexJson.contents[0].body.contents[0]?.contents[1]?.contents[1]?.text || 'ไม่ระบุเวลา'
          });
        }
      } catch (parseError) {
        console.error('Error parsing FLEX_JSON:', parseError);
        continue;
      }
    }

    return {
      status: 'success',
      message: 'ดึงจำนวนเงินที่ตรงกันเรียบร้อย',
      matched_transactions: matchedTransactions
    };
  } catch (error) {
    return { status: 'error', message: 'รูปแบบข้อมูลไม่ถูกต้อง' };
  }
}

// Helper function to check if string is numeric
function isNumeric(str) {
  return !isNaN(str) && !isNaN(parseFloat(str));
}

// Create PromptPay payment request
app.post('/api/promptpay/create', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุจำนวนเงิน'
      });
    }

    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูลร้านค้า'
      });
    }

    // Check if customer_id matches token
    if (req.user.customer_id !== req.customer_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - customer mismatch'
      });
    }

    // Get PromptPay configuration
    const [configRows] = await pool.execute(
      'SELECT promptpay_number, promptpay_name FROM config WHERE customer_id = ?',
      [req.customer_id]
    );

    if (configRows.length === 0 || !configRows[0].promptpay_number) {
      return res.status(400).json({
        success: false,
        message: 'ยังไม่ได้ตั้งค่าพร้อมเพย์'
      });
    }

    const config = configRows[0];
    const qrData = await generatePromptPayQR(config.promptpay_number, parseFloat(amount));

    // Set expiration time (15 minutes from now)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Create payment record
    const [result] = await pool.execute(
      'INSERT INTO promptpay_payments (customer_id, user_id, amount, qr_code, expires_at) VALUES (?, ?, ?, ?, ?)',
      [req.customer_id, req.user.id, amount, qrData.payload, expiresAt]
    );

    res.json({
      success: true,
      message: 'สร้าง QR Code สำเร็จ',
      data: {
        payment_id: result.insertId,
        qr_code: qrData.payload,
        qr_image: qrData.qrCodeImage,
        amount: amount,
        promptpay_name: config.promptpay_name,
        expires_at: expiresAt
      }
    });

  } catch (error) {
    console.error('Error creating PromptPay payment:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้าง QR Code'
    });
  }
});

// Verify PromptPay payment using LINE API
app.post('/api/promptpay/verify', authenticateToken, async (req, res) => {
  try {
    const { payment_id, amount } = req.body;

    if (!payment_id || !amount) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุรหัสการชำระเงินและจำนวนเงิน'
      });
    }

    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูลร้านค้า'
      });
    }

    // Check if customer_id matches token
    if (req.user.customer_id !== req.customer_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - customer mismatch'
      });
    }

    // Get payment record
    const [paymentRows] = await pool.execute(
      'SELECT * FROM promptpay_payments WHERE id = ? AND customer_id = ? AND user_id = ? AND status = "pending"',
      [payment_id, req.customer_id, req.user.id]
    );

    if (paymentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบรายการชำระเงินหรือชำระเงินแล้ว'
      });
    }

    const payment = paymentRows[0];

    // Check if payment has expired
    if (new Date() > new Date(payment.expires_at)) {
      await pool.execute(
        'UPDATE promptpay_payments SET status = "expired" WHERE id = ?',
        [payment_id]
      );
      return res.status(400).json({
        success: false,
        message: 'QR Code หมดอายุแล้ว'
      });
    }

    // Get LINE configuration
    const [configRows] = await pool.execute(
      'SELECT line_cookie, line_mac FROM config WHERE customer_id = ?',
      [req.customer_id]
    );

    if (configRows.length === 0 || !configRows[0].line_cookie || !configRows[0].line_mac) {
      return res.status(400).json({
        success: false,
        message: 'ยังไม่ได้ตั้งค่า LINE API'
      });
    }

    const config = configRows[0];

    // Call LINE API to get recent messages
    const lineResponse = await axios.post(
      'https://line-chrome-gw.line-apps.com/api/talk/thrift/Talk/TalkService/getRecentMessagesV2',
      '["UhtGarPE25BUuiorh3UnzO1ATI6kNy1PJIhciE587DBg",50]',
      {
        headers: {
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'en-US',
          'content-type': 'application/json',
          'origin': 'chrome-extension://ophjlpahpchlmihnnnihgmmeilfjmjjc',
          'priority': 'u=1, i',
          'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"Windows"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'none',
          'sec-fetch-storage-access': 'active',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
          'x-hmac': config.line_mac,
          'x-lal': 'en_US',
          'x-line-access': config.line_cookie,
          'x-line-chrome-version': '3.7.1',
          'Cookie': `lct=${config.line_cookie}`
        }
      }
    );

    // Parse LINE transaction data
    const jsonString = JSON.stringify(lineResponse.data.data);
    const parseResult = parseLineTransactionData(jsonString, parseFloat(amount));

    if (parseResult.status === 'success' && parseResult.matched_transactions.length > 0) {
      // Payment verified
      const transaction = parseResult.matched_transactions[0];

      await pool.execute(
        'UPDATE promptpay_payments SET status = "verified", transaction_id = ?, verified_at = NOW() WHERE id = ?',
        [transaction.transactionid, payment_id]
      );

      // Update last check time
      await pool.execute(
        'UPDATE config SET last_check = NOW() WHERE customer_id = ?',
        [req.customer_id]
      );

      res.json({
        success: true,
        message: 'ยืนยันการชำระเงินสำเร็จ',
        data: {
          payment_id: payment_id,
          transaction_id: transaction.transactionid,
          amount: transaction.amount,
          verified_at: new Date()
        }
      });
    } else {
      res.json({
        success: false,
        message: 'ยังไม่พบการชำระเงิน กรุณาลองใหม่อีกครั้ง',
        data: {
          payment_id: payment_id,
          amount: amount
        }
      });
    }

  } catch (error) {
    console.error('Error verifying PromptPay payment:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการตรวจสอบการชำระเงิน'
    });
  }
});

// Get payment status
app.get('/api/promptpay/status/:payment_id', authenticateToken, async (req, res) => {
  try {
    const { payment_id } = req.params;

    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูลร้านค้า'
      });
    }

    // Check if customer_id matches token
    if (req.user.customer_id !== req.customer_id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied - customer mismatch'
      });
    }

    const [paymentRows] = await pool.execute(
      'SELECT * FROM promptpay_payments WHERE id = ? AND customer_id = ? AND user_id = ?',
      [payment_id, req.customer_id, req.user.id]
    );

    if (paymentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบรายการชำระเงิน'
      });
    }

    const payment = paymentRows[0];

    // Check if payment has expired
    if (payment.status === 'pending' && new Date() > new Date(payment.expires_at)) {
      await pool.execute(
        'UPDATE promptpay_payments SET status = "expired" WHERE id = ?',
        [payment_id]
      );
      payment.status = 'expired';
    }

    res.json({
      success: true,
      data: {
        payment_id: payment.id,
        status: payment.status,
        amount: payment.amount,
        created_at: payment.created_at,
        expires_at: payment.expires_at,
        verified_at: payment.verified_at,
        transaction_id: payment.transaction_id
      }
    });

  } catch (error) {
    console.error('Error getting payment status:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงสถานะการชำระเงิน'
    });
  }
});

// Update PromptPay configuration
app.post('/api/admin/promptpay/config', async (req, res) => {
  try {
    const {
      promptpay_number,
      promptpay_name,
      line_cookie,
      line_mac,
      verify_token,
      auto_verify_enabled
    } = req.body;

    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูลร้านค้า'
      });
    }

    // Check if config exists
    const [existingConfig] = await pool.execute(
      'SELECT id FROM config WHERE customer_id = ?',
      [req.customer_id]
    );

    if (existingConfig.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการตั้งค่าร้านค้า'
      });
    }

    // Update configuration
    await pool.execute(
      `UPDATE config SET 
       promptpay_number = ?, 
       promptpay_name = ?, 
       line_cookie = ?, 
       line_mac = ?, 
       verify_token = ?, 
       auto_verify_enabled = ?,
       updated_at = NOW()
       WHERE customer_id = ?`,
      [
        promptpay_number || null,
        promptpay_name || null,
        line_cookie || null,
        line_mac || null,
        verify_token || null,
        auto_verify_enabled !== undefined ? auto_verify_enabled : 1,
        req.customer_id
      ]
    );

    res.json({
      success: true,
      message: 'อัปเดตการตั้งค่าพร้อมเพย์สำเร็จ'
    });

  } catch (error) {
    console.error('Error updating PromptPay config:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตการตั้งค่า'
    });
  }
});

// Get PromptPay configuration
app.get('/api/admin/promptpay/config', async (req, res) => {
  try {
    if (!req.customer_id) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูลร้านค้า'
      });
    }

    const [configRows] = await pool.execute(
      'SELECT promptpay_number, promptpay_name, line_cookie, line_mac, verify_token, auto_verify_enabled, last_check FROM config WHERE customer_id = ?',
      [req.customer_id]
    );

    if (configRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการตั้งค่าร้านค้า'
      });
    }

    const config = configRows[0];

    // Don't expose sensitive data
    res.json({
      success: true,
      data: {
        promptpay_number: config.promptpay_number,
        promptpay_name: config.promptpay_name,
        auto_verify_enabled: config.auto_verify_enabled,
        last_check: config.last_check,
        has_line_config: !!(config.line_cookie && config.line_mac),
        has_verify_token: !!config.verify_token
      }
    });

  } catch (error) {
    console.error('Error getting PromptPay config:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงการตั้งค่า'
    });
  }
});

// ==================== CONFIG MANAGEMENT ENDPOINTS ====================

// ดึง PromptPay Config เฉพาะ
app.get('/api/config/promptpay', authenticateToken, async (req, res) => {
  try {
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const [configs] = await pool.execute(
      `SELECT promptpay_number, promptpay_name, line_cookie, line_mac, 
              verify_token, last_check, auto_verify_enabled 
       FROM config WHERE customer_id = ? LIMIT 1`,
      [customerId]
    );

    if (configs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการตั้งค่า PromptPay'
      });
    }

    res.json({
      success: true,
      message: 'ดึงการตั้งค่า PromptPay สำเร็จ',
      data: {
        promptpay_number: configs[0].promptpay_number,
        promptpay_name: configs[0].promptpay_name,
        line_cookie: configs[0].line_cookie,
        line_mac: configs[0].line_mac,
        verify_token: configs[0].verify_token,
        last_check: configs[0].last_check,
        auto_verify_enabled: configs[0].auto_verify_enabled
      }
    });

  } catch (error) {
    console.error('Error fetching PromptPay config:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงการตั้งค่า PromptPay',
      error: error.message
    });
  }
});

// อัปเดต PromptPay Config
app.put('/api/config/promptpay', authenticateToken, requirePermission('can_manage_settings'), async (req, res) => {
  try {
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const {
      promptpay_number,
      promptpay_name,
      line_cookie,
      line_mac,
      verify_token,
      auto_verify_enabled
    } = req.body;

    // ตรวจสอบว่ามี config อยู่แล้วหรือไม่
    const [existingConfigs] = await pool.execute(
      'SELECT id FROM config WHERE customer_id = ?',
      [customerId]
    );

    if (existingConfigs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการตั้งค่า'
      });
    }

    // สร้าง dynamic query สำหรับอัปเดตเฉพาะฟิลด์ที่ส่งมา
    const updateFields = [];
    const updateValues = [];

    if (promptpay_number !== undefined) {
      updateFields.push('promptpay_number = ?');
      updateValues.push(promptpay_number);
    }
    if (promptpay_name !== undefined) {
      updateFields.push('promptpay_name = ?');
      updateValues.push(promptpay_name);
    }
    if (line_cookie !== undefined) {
      updateFields.push('line_cookie = ?');
      updateValues.push(line_cookie);
    }
    if (line_mac !== undefined) {
      updateFields.push('line_mac = ?');
      updateValues.push(line_mac);
    }
    if (verify_token !== undefined) {
      updateFields.push('verify_token = ?');
      updateValues.push(verify_token);
    }
    if (auto_verify_enabled !== undefined) {
      updateFields.push('auto_verify_enabled = ?');
      updateValues.push(auto_verify_enabled ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ไม่มีข้อมูลที่จะอัปเดต'
      });
    }

    // อัปเดต last_check เป็นเวลาปัจจุบัน
    updateFields.push('last_check = NOW()');

    // เพิ่ม customer_id ในตัวแปรสุดท้าย
    updateValues.push(customerId);

    const updateQuery = `UPDATE config SET ${updateFields.join(', ')} WHERE customer_id = ?`;
    await pool.execute(updateQuery, updateValues);

    // ดึงข้อมูลที่อัปเดตแล้ว
    const [updatedConfigs] = await pool.execute(
      `SELECT promptpay_number, promptpay_name, line_cookie, line_mac, 
              verify_token, last_check, auto_verify_enabled 
       FROM config WHERE customer_id = ? LIMIT 1`,
      [customerId]
    );

    res.json({
      success: true,
      message: 'อัปเดตการตั้งค่า PromptPay สำเร็จ',
      data: {
        promptpay_number: updatedConfigs[0].promptpay_number,
        promptpay_name: updatedConfigs[0].promptpay_name,
        line_cookie: updatedConfigs[0].line_cookie,
        line_mac: updatedConfigs[0].line_mac,
        verify_token: updatedConfigs[0].verify_token,
        last_check: updatedConfigs[0].last_check,
        auto_verify_enabled: updatedConfigs[0].auto_verify_enabled
      }
    });

  } catch (error) {
    console.error('Error updating PromptPay config:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตการตั้งค่า PromptPay',
      error: error.message
    });
  }
});

// ดึง Bank Config เฉพาะ
app.get('/api/config/bank', authenticateToken, async (req, res) => {
  try {
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const [configs] = await pool.execute(
      `SELECT bank_account_name, bank_account_number, bank_account_name_thai, bank_name
       FROM config WHERE customer_id = ? LIMIT 1`,
      [customerId]
    );

    if (configs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการตั้งค่าบัญชีธนาคาร'
      });
    }

    res.json({
      success: true,
      message: 'ดึงการตั้งค่าบัญชีธนาคารสำเร็จ',
      data: {
        bank_account_name: configs[0].bank_account_name,
        bank_account_number: configs[0].bank_account_number,
        bank_account_name_thai: configs[0].bank_account_name_thai,
        bank_name: configs[0].bank_name
      }
    });

  } catch (error) {
    console.error('Error fetching bank config:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงการตั้งค่าบัญชีธนาคาร',
      error: error.message
    });
  }
});

// อัปเดต Bank Config
app.put('/api/config/bank', authenticateToken, requirePermission('can_manage_settings'), async (req, res) => {
  try {
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const {
      bank_account_name,
      bank_account_number,
      bank_account_name_thai,
      bank_name
    } = req.body;

    // ตรวจสอบว่ามี config อยู่แล้วหรือไม่
    const [existingConfigs] = await pool.execute(
      'SELECT id FROM config WHERE customer_id = ?',
      [customerId]
    );

    if (existingConfigs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการตั้งค่า'
      });
    }

    // สร้าง dynamic query
    const updateFields = [];
    const updateValues = [];

    if (bank_account_name !== undefined) {
      updateFields.push('bank_account_name = ?');
      updateValues.push(bank_account_name);
    }
    if (bank_account_number !== undefined) {
      updateFields.push('bank_account_number = ?');
      updateValues.push(bank_account_number);
    }
    if (bank_account_name_thai !== undefined) {
      updateFields.push('bank_account_name_thai = ?');
      updateValues.push(bank_account_name_thai);
    }
    if (bank_name !== undefined) {
      updateFields.push('bank_name = ?');
      updateValues.push(bank_name);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ไม่มีข้อมูลที่จะอัปเดต'
      });
    }

    updateValues.push(customerId);

    const updateQuery = `UPDATE config SET ${updateFields.join(', ')} WHERE customer_id = ?`;
    await pool.execute(updateQuery, updateValues);

    // ดึงข้อมูลที่อัปเดตแล้ว
    const [updatedConfigs] = await pool.execute(
      `SELECT bank_account_name, bank_account_number, bank_account_name_thai, bank_name
       FROM config WHERE customer_id = ? LIMIT 1`,
      [customerId]
    );

    res.json({
      success: true,
      message: 'อัปเดตการตั้งค่าบัญชีธนาคารสำเร็จ',
      data: {
        bank_account_name: updatedConfigs[0].bank_account_name,
        bank_account_number: updatedConfigs[0].bank_account_number,
        bank_account_name_thai: updatedConfigs[0].bank_account_name_thai,
        bank_name: updatedConfigs[0].bank_name
      }
    });

  } catch (error) {
    console.error('Error updating bank config:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตการตั้งค่าบัญชีธนาคาร',
      error: error.message
    });
  }
});

// ดึง Site Config เฉพาะ (ข้อมูลเว็บไซต์พื้นฐาน)
app.get('/api/config/site', authenticateToken, async (req, res) => {
  try {
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const [configs] = await pool.execute(
      `SELECT owner_phone, site_name, site_logo, meta_title, meta_description, 
              meta_keywords, meta_author, discord_link, discord_webhook, 
              theme, font_select, review, transac
       FROM config WHERE customer_id = ? LIMIT 1`,
      [customerId]
    );

    if (configs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการตั้งค่าเว็บไซต์'
      });
    }

    res.json({
      success: true,
      message: 'ดึงการตั้งค่าเว็บไซต์สำเร็จ',
      data: {
        owner_phone: configs[0].owner_phone,
        site_name: configs[0].site_name,
        site_logo: configs[0].site_logo,
        meta_title: configs[0].meta_title,
        meta_description: configs[0].meta_description,
        meta_keywords: configs[0].meta_keywords,
        meta_author: configs[0].meta_author,
        discord_link: configs[0].discord_link,
        discord_webhook: configs[0].discord_webhook,
        theme: configs[0].theme,
        font_select: configs[0].font_select,
        review: configs[0].review,
        transac: configs[0].transac
      }
    });

  } catch (error) {
    console.error('Error fetching site config:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงการตั้งค่าเว็บไซต์',
      error: error.message
    });
  }
});

// อัปเดต Site Config
app.put('/api/config/site', authenticateToken, requirePermission('can_manage_settings'), async (req, res) => {
  try {
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const {
      owner_phone,
      site_name,
      site_logo,
      meta_title,
      meta_description,
      meta_keywords,
      meta_author,
      discord_link,
      discord_webhook,
      theme,
      font_select,
      review,
      transac
    } = req.body;

    // ตรวจสอบว่ามี config อยู่แล้วหรือไม่
    const [existingConfigs] = await pool.execute(
      'SELECT id FROM config WHERE customer_id = ?',
      [customerId]
    );

    if (existingConfigs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการตั้งค่า'
      });
    }

    // สร้าง dynamic query
    const updateFields = [];
    const updateValues = [];

    if (owner_phone !== undefined) {
      updateFields.push('owner_phone = ?');
      updateValues.push(owner_phone);
    }
    if (site_name !== undefined) {
      updateFields.push('site_name = ?');
      updateValues.push(site_name);
    }
    if (site_logo !== undefined) {
      updateFields.push('site_logo = ?');
      updateValues.push(site_logo);
    }
    if (meta_title !== undefined) {
      updateFields.push('meta_title = ?');
      updateValues.push(meta_title);
    }
    if (meta_description !== undefined) {
      updateFields.push('meta_description = ?');
      updateValues.push(meta_description);
    }
    if (meta_keywords !== undefined) {
      updateFields.push('meta_keywords = ?');
      updateValues.push(meta_keywords);
    }
    if (meta_author !== undefined) {
      updateFields.push('meta_author = ?');
      updateValues.push(meta_author);
    }
    if (discord_link !== undefined) {
      updateFields.push('discord_link = ?');
      updateValues.push(discord_link);
    }
    if (discord_webhook !== undefined) {
      updateFields.push('discord_webhook = ?');
      updateValues.push(discord_webhook);
    }
    if (theme !== undefined) {
      updateFields.push('theme = ?');
      updateValues.push(theme);
    }
    if (font_select !== undefined) {
      updateFields.push('font_select = ?');
      updateValues.push(font_select);
    }
    if (review !== undefined) {
      updateFields.push('review = ?');
      updateValues.push(review ? 1 : 0);
    }
    if (transac !== undefined) {
      updateFields.push('transac = ?');
      updateValues.push(transac ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ไม่มีข้อมูลที่จะอัปเดต'
      });
    }

    updateValues.push(customerId);

    const updateQuery = `UPDATE config SET ${updateFields.join(', ')} WHERE customer_id = ?`;
    await pool.execute(updateQuery, updateValues);

    // ดึงข้อมูลที่อัปเดตแล้ว
    const [updatedConfigs] = await pool.execute(
      `SELECT owner_phone, site_name, site_logo, meta_title, meta_description, 
              meta_keywords, meta_author, discord_link, discord_webhook, 
              theme, font_select, review, transac
       FROM config WHERE customer_id = ? LIMIT 1`,
      [customerId]
    );

    res.json({
      success: true,
      message: 'อัปเดตการตั้งค่าเว็บไซต์สำเร็จ',
      data: {
        owner_phone: updatedConfigs[0].owner_phone,
        site_name: updatedConfigs[0].site_name,
        site_logo: updatedConfigs[0].site_logo,
        meta_title: updatedConfigs[0].meta_title,
        meta_description: updatedConfigs[0].meta_description,
        meta_keywords: updatedConfigs[0].meta_keywords,
        meta_author: updatedConfigs[0].meta_author,
        discord_link: updatedConfigs[0].discord_link,
        discord_webhook: updatedConfigs[0].discord_webhook,
        theme: updatedConfigs[0].theme,
        font_select: updatedConfigs[0].font_select,
        review: updatedConfigs[0].review,
        transac: updatedConfigs[0].transac
      }
    });

  } catch (error) {
    console.error('Error updating site config:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตการตั้งค่าเว็บไซต์',
      error: error.message
    });
  }
});

// ดึง Banner Config เฉพาะ
app.get('/api/config/banners', authenticateToken, async (req, res) => {
  try {
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const [configs] = await pool.execute(
      `SELECT banner_link, banner2_link, banner3_link, 
              navigation_banner_1, navigation_link_1,
              navigation_banner_2, navigation_link_2,
              navigation_banner_3, navigation_link_3,
              navigation_banner_4, navigation_link_4,
              background_image, footer_image, load_logo, footer_logo, ad_banner
       FROM config WHERE customer_id = ? LIMIT 1`,
      [customerId]
    );

    if (configs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการตั้งค่าแบนเนอร์'
      });
    }

    res.json({
      success: true,
      message: 'ดึงการตั้งค่าแบนเนอร์สำเร็จ',
      data: {
        banner_link: configs[0].banner_link,
        banner2_link: configs[0].banner2_link,
        banner3_link: configs[0].banner3_link,
        navigation_banner_1: configs[0].navigation_banner_1,
        navigation_link_1: configs[0].navigation_link_1,
        navigation_banner_2: configs[0].navigation_banner_2,
        navigation_link_2: configs[0].navigation_link_2,
        navigation_banner_3: configs[0].navigation_banner_3,
        navigation_link_3: configs[0].navigation_link_3,
        navigation_banner_4: configs[0].navigation_banner_4,
        navigation_link_4: configs[0].navigation_link_4,
        background_image: configs[0].background_image,
        footer_image: configs[0].footer_image,
        load_logo: configs[0].load_logo,
        footer_logo: configs[0].footer_logo,
        ad_banner: configs[0].ad_banner
      }
    });

  } catch (error) {
    console.error('Error fetching banner config:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงการตั้งค่าแบนเนอร์',
      error: error.message
    });
  }
});

// อัปเดต Banner Config
app.put('/api/config/banners', authenticateToken, requirePermission('can_manage_settings'), async (req, res) => {
  try {
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'Customer context required'
      });
    }

    const {
      banner_link,
      banner2_link,
      banner3_link,
      navigation_banner_1,
      navigation_link_1,
      navigation_banner_2,
      navigation_link_2,
      navigation_banner_3,
      navigation_link_3,
      navigation_banner_4,
      navigation_link_4,
      background_image,
      footer_image,
      load_logo,
      footer_logo,
      ad_banner
    } = req.body;

    // ตรวจสอบว่ามี config อยู่แล้วหรือไม่
    const [existingConfigs] = await pool.execute(
      'SELECT id FROM config WHERE customer_id = ?',
      [customerId]
    );

    if (existingConfigs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบการตั้งค่า'
      });
    }

    // สร้าง dynamic query
    const updateFields = [];
    const updateValues = [];

    if (banner_link !== undefined) {
      updateFields.push('banner_link = ?');
      updateValues.push(banner_link);
    }
    if (banner2_link !== undefined) {
      updateFields.push('banner2_link = ?');
      updateValues.push(banner2_link);
    }
    if (banner3_link !== undefined) {
      updateFields.push('banner3_link = ?');
      updateValues.push(banner3_link);
    }
    if (navigation_banner_1 !== undefined) {
      updateFields.push('navigation_banner_1 = ?');
      updateValues.push(navigation_banner_1);
    }
    if (navigation_link_1 !== undefined) {
      updateFields.push('navigation_link_1 = ?');
      updateValues.push(navigation_link_1);
    }
    if (navigation_banner_2 !== undefined) {
      updateFields.push('navigation_banner_2 = ?');
      updateValues.push(navigation_banner_2);
    }
    if (navigation_link_2 !== undefined) {
      updateFields.push('navigation_link_2 = ?');
      updateValues.push(navigation_link_2);
    }
    if (navigation_banner_3 !== undefined) {
      updateFields.push('navigation_banner_3 = ?');
      updateValues.push(navigation_banner_3);
    }
    if (navigation_link_3 !== undefined) {
      updateFields.push('navigation_link_3 = ?');
      updateValues.push(navigation_link_3);
    }
    if (navigation_banner_4 !== undefined) {
      updateFields.push('navigation_banner_4 = ?');
      updateValues.push(navigation_banner_4);
    }
    if (navigation_link_4 !== undefined) {
      updateFields.push('navigation_link_4 = ?');
      updateValues.push(navigation_link_4);
    }
    if (background_image !== undefined) {
      updateFields.push('background_image = ?');
      updateValues.push(background_image);
    }
    if (footer_image !== undefined) {
      updateFields.push('footer_image = ?');
      updateValues.push(footer_image);
    }
    if (load_logo !== undefined) {
      updateFields.push('load_logo = ?');
      updateValues.push(load_logo);
    }
    if (footer_logo !== undefined) {
      updateFields.push('footer_logo = ?');
      updateValues.push(footer_logo);
    }
    if (ad_banner !== undefined) {
      updateFields.push('ad_banner = ?');
      updateValues.push(ad_banner);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ไม่มีข้อมูลที่จะอัปเดต'
      });
    }

    updateValues.push(customerId);

    const updateQuery = `UPDATE config SET ${updateFields.join(', ')} WHERE customer_id = ?`;
    await pool.execute(updateQuery, updateValues);

    // ดึงข้อมูลที่อัปเดตแล้ว
    const [updatedConfigs] = await pool.execute(
      `SELECT banner_link, banner2_link, banner3_link, 
              navigation_banner_1, navigation_link_1,
              navigation_banner_2, navigation_link_2,
              navigation_banner_3, navigation_link_3,
              navigation_banner_4, navigation_link_4,
              background_image, footer_image, load_logo, footer_logo, ad_banner
       FROM config WHERE customer_id = ? LIMIT 1`,
      [customerId]
    );

    res.json({
      success: true,
      message: 'อัปเดตการตั้งค่าแบนเนอร์สำเร็จ',
      data: {
        banner_link: updatedConfigs[0].banner_link,
        banner2_link: updatedConfigs[0].banner2_link,
        banner3_link: updatedConfigs[0].banner3_link,
        navigation_banner_1: updatedConfigs[0].navigation_banner_1,
        navigation_link_1: updatedConfigs[0].navigation_link_1,
        navigation_banner_2: updatedConfigs[0].navigation_banner_2,
        navigation_link_2: updatedConfigs[0].navigation_link_2,
        navigation_banner_3: updatedConfigs[0].navigation_banner_3,
        navigation_link_3: updatedConfigs[0].navigation_link_3,
        navigation_banner_4: updatedConfigs[0].navigation_banner_4,
        navigation_link_4: updatedConfigs[0].navigation_link_4,
        background_image: updatedConfigs[0].background_image,
        footer_image: updatedConfigs[0].footer_image,
        load_logo: updatedConfigs[0].load_logo,
        footer_logo: updatedConfigs[0].footer_logo,
        ad_banner: updatedConfigs[0].ad_banner
      }
    });

  } catch (error) {
    console.error('Error updating banner config:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดตการตั้งค่าแบนเนอร์',
      error: error.message
    });
  }
});

// ==================== PROMPTPAY QR CODE SYSTEM ====================

// สร้าง PromptPay QR Code
app.post("/api/promptpay-qr", authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;
    const customerId = req.customer_id;

    // ตรวจสอบ customer_id
    if (!customerId) {
      return res.status(400).json({
        error: "ไม่พบข้อมูล customer_id"
      });
    }

    // ดึงข้อมูล PromptPay จาก config
    const [configs] = await pool.execute(
      'SELECT promptpay_number, promptpay_name FROM config WHERE customer_id = ?',
      [customerId]
    );

    if (configs.length === 0 || !configs[0].promptpay_number) {
      return res.status(404).json({
        error: "ไม่พบการตั้งค่า PromptPay หรือหมายเลข PromptPay ยังไม่ได้ตั้งค่า"
      });
    }

    const config = configs[0];
    const promptpayNumber = config.promptpay_number;

    // ตรวจสอบจำนวนเงิน
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({
        error: "กรุณาระบุจำนวนเงินที่ถูกต้อง (ต้องเป็นตัวเลขที่มากกว่า 0)"
      });
    }

    const qrAmount = amount;

    // ลบ QR Code เก่าของผู้ใช้ก่อนสร้างใหม่ (ถ้ามี QR Code ที่ยังไม่ได้ใช้)
    await pool.query(
      "DELETE FROM promptpay_qr_code WHERE customer_id = ? AND user_id = ?",
      [customerId, userId]
    );

    // สร้าง PromptPay QR Code
    const qrData = await generatePromptPayQR(promptpayNumber, qrAmount);

    // บันทึกลงฐานข้อมูล
    const [result] = await pool.query(
      "INSERT INTO promptpay_qr_code (customer_id, user_id, phone_number, amount, qr_payload) VALUES (?, ?, ?, ?, ?)",
      [customerId, userId, promptpayNumber, qrAmount, qrData.payload]
    );

    const qrCodeData = {
      id: result.insertId,
      customer_id: customerId,
      user_id: userId,
      phone_number: promptpayNumber,
      promptpay_name: config.promptpay_name,
      amount: qrAmount,
      qr_payload: qrData.payload,
      qr_image: qrData.qrCodeImage,
      created_at: new Date().toISOString()
    };

    res.status(201).json({
      message: "สร้าง PromptPay QR Code สำเร็จ",
      data: qrCodeData
    });

  } catch (err) {
    console.error("PromptPay QR creation error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการสร้าง QR Code" });
  }
});

// ดึงค่า amount ทั้งหมดจากตาราง promptpay_qr_code
app.get("/api/promptpay-amounts", authenticateToken, async (req, res) => {
  try {
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        error: "ไม่พบข้อมูล customer_id"
      });
    }

    const [rows] = await pool.query(
      "SELECT amount FROM promptpay_qr_code WHERE customer_id = ?",
      [customerId]
    );

    const amounts = rows.map(row => row.amount);

    res.status(200).json({
      message: "ดึงค่า amount ทั้งหมดสำเร็จ",
      data: amounts
    });

  } catch (err) {
    console.error("Get amounts error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล amount" });
  }
});

// Webhook สำหรับรับข้อมูลการเติมเงินจากระบบภายนอก
app.post("/api/webhook/promptpay-payment", express.json(), async (req, res) => {
  try {
    // Debug: ดูข้อมูลที่เข้ามา
    console.log("Webhook received:", {
      body: req.body,
      bodyType: typeof req.body,
      headers: req.headers,
      method: req.method
    });

    // ตรวจสอบว่า req.body มีข้อมูลหรือไม่
    if (!req.body) {
      return res.status(400).json({
        error: "ไม่พบข้อมูลใน request body"
      });
    }

    const { amount, customer_id } = req.body;

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!amount) {
      return res.status(400).json({
        error: "กรุณาระบุจำนวนเงิน"
      });
    }

    if (!customer_id) {
      return res.status(400).json({
        error: "กรุณาระบุ customer_id"
      });
    }

    // แปลง amount เป็นตัวเลข
    const numericAmount = parseFloat(amount);

    // ตรวจสอบรูปแบบจำนวนเงิน
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        error: "จำนวนเงินต้องเป็นตัวเลขที่มากกว่า 0"
      });
    }

    // ค้นหา QR Code ที่มี amount และ customer_id ตรงกัน
    const [qrCodes] = await pool.query(
      "SELECT id, customer_id, user_id, amount, phone_number FROM promptpay_qr_code WHERE customer_id = ? AND amount = ? ORDER BY created_at ASC",
      [customer_id, numericAmount]
    );

    if (qrCodes.length === 0) {
      return res.status(404).json({
        error: "ไม่พบ QR Code ที่ตรงกับจำนวนเงินและ customer_id ที่ระบุ",
        amount: numericAmount,
        customer_id: customer_id
      });
    }

    // ถ้ามีหลาย QR Code ที่ amount ตรงกัน ให้ใช้ตัวแรก
    const qrCode = qrCodes[0];
    const userId = qrCode.user_id;

    // เริ่ม transaction เพื่อให้การอัปเดตข้อมูลเป็นไปอย่างปลอดภัย
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    let topupResult;

    try {
      // อัปเดตยอดเงินของผู้ใช้ทันที
      const [updateResult] = await connection.query(
        "UPDATE users SET money = money + ? WHERE id = ? AND customer_id = ?",
        [numericAmount, userId, customer_id]
      );

      if (updateResult.affectedRows === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({
          error: "ไม่พบผู้ใช้ที่ระบุ"
        });
      }

      // บันทึกลงตาราง topups
      [topupResult] = await connection.query(
        'INSERT INTO topups (customer_id, user_id, amount, method, transaction_ref, status) VALUES (?, ?, ?, ?, ?, ?)',
        [customer_id, userId, numericAmount, 'promptpay', `QR_${qrCode.id}`, 'success']
      );

      // ลบ QR Code ที่ใช้แล้ว
      await connection.query(
        "DELETE FROM promptpay_qr_code WHERE id = ? AND customer_id = ?",
        [qrCode.id, customer_id]
      );

      await connection.commit();
      connection.release();

    } catch (error) {
      await connection.rollback();
      connection.release();
      throw error;
    }

    // ดึงข้อมูลผู้ใช้หลังอัปเดต
    const [userResult] = await pool.query(
      "SELECT id, fullname, email, money FROM users WHERE id = ? AND customer_id = ?",
      [userId, customer_id]
    );

    console.log(`Webhook processed successfully for user ${userId}, amount: ${numericAmount}`);

    res.status(200).json({
      message: "Webhook ประมวลผลสำเร็จ",
      success: true,
      data: {
        user: userResult[0],
        amount_added: numericAmount,
        qr_code_id: qrCode.id,
        topup_id: topupResult.insertId,
        method: 'promptpay'
      }
    });

  } catch (err) {
    console.error("Webhook processing error:", err);
    console.error("Error details:", {
      message: err.message,
      stack: err.stack,
      body: req.body,
      headers: req.headers
    });

    res.status(500).json({
      error: "เกิดข้อผิดพลาดในการประมวลผล webhook",
      success: false,
      details: err.message
    });
  }
});

// ดึงรายการ PromptPay QR Code ของผู้ใช้
app.get("/api/promptpay-qr", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const customerId = req.customer_id;
    const { page = 1, limit = 10 } = req.query;

    if (!customerId) {
      return res.status(400).json({
        error: "ไม่พบข้อมูล customer_id"
      });
    }

    const offset = (page - 1) * limit;

    // ดึงข้อมูล QR Code ของผู้ใช้
    const [qrCodes] = await pool.query(
      `SELECT id, customer_id, user_id, phone_number, amount, qr_payload, created_at 
       FROM promptpay_qr_code 
       WHERE customer_id = ? AND user_id = ? 
       ORDER BY created_at DESC 
       LIMIT ? OFFSET ?`,
      [customerId, userId, parseInt(limit), parseInt(offset)]
    );

    // นับจำนวนทั้งหมด
    const [countResult] = await pool.query(
      "SELECT COUNT(*) as total FROM promptpay_qr_code WHERE customer_id = ? AND user_id = ?",
      [customerId, userId]
    );

    const total = countResult[0].total;
    const totalPages = Math.ceil(total / limit);

    res.json({
      message: "ดึงข้อมูล PromptPay QR Code สำเร็จ",
      data: qrCodes,
      pagination: {
        current_page: parseInt(page),
        total_pages: totalPages,
        total_items: total,
        items_per_page: parseInt(limit)
      }
    });

  } catch (err) {
    console.error("PromptPay QR fetch error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล QR Code" });
  }
});

// ดึง PromptPay QR Code ตาม ID
app.get("/api/promptpay-qr/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        error: "ไม่พบข้อมูล customer_id"
      });
    }

    const [qrCodes] = await pool.query(
      "SELECT id, customer_id, user_id, phone_number, amount, qr_payload, created_at FROM promptpay_qr_code WHERE id = ? AND customer_id = ? AND user_id = ?",
      [id, customerId, userId]
    );

    if (qrCodes.length === 0) {
      return res.status(404).json({ error: "ไม่พบ QR Code ที่ระบุ" });
    }

    res.json({
      message: "ดึงข้อมูล PromptPay QR Code สำเร็จ",
      data: qrCodes[0]
    });

  } catch (err) {
    console.error("PromptPay QR fetch by ID error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการดึงข้อมูล QR Code" });
  }
});

// ยืนยันการเติมเงิน PromptPay
app.get("/api/promptpay-confirm/:amount", async (req, res) => {
  try {
    const { amount } = req.params;
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        error: "ไม่พบข้อมูล customer_id"
      });
    }

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!amount) {
      return res.status(400).json({
        error: "กรุณาระบุจำนวนเงินที่เติม"
      });
    }

    // แปลง amount เป็นตัวเลข
    const numericAmount = parseFloat(amount);

    // ตรวจสอบรูปแบบจำนวนเงิน
    if (isNaN(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        error: "จำนวนเงินต้องเป็นตัวเลขที่มากกว่า 0"
      });
    }

    // ค้นหา QR Code ที่มี amount และ customer_id ตรงกัน
    const [qrCodes] = await pool.query(
      "SELECT id, customer_id, user_id, amount, phone_number FROM promptpay_qr_code WHERE customer_id = ? AND amount = ?",
      [customerId, numericAmount]
    );

    if (qrCodes.length === 0) {
      return res.status(404).json({
        error: "ไม่พบ QR Code ที่ตรงกับจำนวนเงินที่ระบุ"
      });
    }

    // ถ้ามีหลาย QR Code ที่ amount ตรงกัน ให้ใช้ตัวแรก
    const qrCode = qrCodes[0];
    const userId = qrCode.user_id;

    // เริ่ม transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      // อัปเดตยอดเงินของผู้ใช้
      const [updateResult] = await connection.query(
        "UPDATE users SET money = money + ? WHERE id = ? AND customer_id = ?",
        [numericAmount, userId, customerId]
      );

      if (updateResult.affectedRows === 0) {
        throw new Error("ไม่พบผู้ใช้ที่ระบุ");
      }

      // ลบ QR Code ที่ใช้แล้ว
      await connection.query(
        "DELETE FROM promptpay_qr_code WHERE id = ? AND customer_id = ?",
        [qrCode.id, customerId]
      );

      // บันทึกประวัติการเติมเงิน
      await connection.query(
        "INSERT INTO topups (customer_id, user_id, amount, method, transaction_ref, status) VALUES (?, ?, ?, 'PromptPay', ?, 'success')",
        [customerId, userId, numericAmount, `QR-${qrCode.id}`]
      );

      // commit transaction
      await connection.commit();
      connection.release();

      // ดึงข้อมูลผู้ใช้หลังอัปเดต
      const [userResult] = await pool.query(
        "SELECT id, fullname, email, money FROM users WHERE id = ? AND customer_id = ?",
        [userId, customerId]
      );

      res.status(200).json({
        message: "ยืนยันการเติมเงินสำเร็จ",
        data: {
          user: userResult[0],
          amount_added: numericAmount,
          qr_code_id: qrCode.id
        }
      });

    } catch (transactionErr) {
      // rollback transaction
      await connection.rollback();
      connection.release();
      throw transactionErr;
    }

  } catch (err) {
    console.error("PromptPay confirm error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการยืนยันการเติมเงิน" });
  }
});

// ลบ PromptPay QR Code
app.delete("/api/promptpay-qr/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        error: "ไม่พบข้อมูล customer_id"
      });
    }

    // ตรวจสอบว่า QR Code เป็นของผู้ใช้หรือไม่
    const [existingQr] = await pool.query(
      "SELECT id FROM promptpay_qr_code WHERE id = ? AND customer_id = ? AND user_id = ?",
      [id, customerId, userId]
    );

    if (existingQr.length === 0) {
      return res.status(404).json({ error: "ไม่พบ QR Code ที่ระบุ" });
    }

    // ลบ QR Code
    await pool.query(
      "DELETE FROM promptpay_qr_code WHERE id = ? AND customer_id = ? AND user_id = ?",
      [id, customerId, userId]
    );

    res.json({
      message: "ลบ PromptPay QR Code สำเร็จ"
    });

  } catch (err) {
    console.error("PromptPay QR deletion error:", err);
    res.status(500).json({ error: "เกิดข้อผิดพลาดในการลบ QR Code" });
  }
});

// Auto verification system (runs every 30 seconds)
setInterval(async () => {
  try {
    // Get all pending payments that haven't expired
    const [pendingPayments] = await pool.execute(
      'SELECT pp.*, c.line_cookie, c.line_mac FROM promptpay_payments pp JOIN config c ON pp.customer_id = c.customer_id WHERE pp.status = "pending" AND pp.expires_at > NOW() AND c.auto_verify_enabled = 1 AND c.line_cookie IS NOT NULL AND c.line_mac IS NOT NULL'
    );

    for (const payment of pendingPayments) {
      try {
        // Call LINE API
        const lineResponse = await axios.post(
          'https://line-chrome-gw.line-apps.com/api/talk/thrift/Talk/TalkService/getRecentMessagesV2',
          '["UhtGarPE25BUuiorh3UnzO1ATI6kNy1PJIhciE587DBg",50]',
          {
            headers: {
              'accept': 'application/json, text/plain, */*',
              'accept-language': 'en-US',
              'content-type': 'application/json',
              'origin': 'chrome-extension://ophjlpahpchlmihnnnihgmmeilfjmjjc',
              'priority': 'u=1, i',
              'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
              'sec-ch-ua-mobile': '?0',
              'sec-ch-ua-platform': '"Windows"',
              'sec-fetch-dest': 'empty',
              'sec-fetch-mode': 'cors',
              'sec-fetch-site': 'none',
              'sec-fetch-storage-access': 'active',
              'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
              'x-hmac': payment.line_mac,
              'x-lal': 'en_US',
              'x-line-access': payment.line_cookie,
              'x-line-chrome-version': '3.7.1',
              'Cookie': `lct=${payment.line_cookie}`
            }
          }
        );

        // Parse LINE transaction data
        const jsonString = JSON.stringify(lineResponse.data.data);
        const parseResult = parseLineTransactionData(jsonString, parseFloat(payment.amount));

        if (parseResult.status === 'success' && parseResult.matched_transactions.length > 0) {
          const transaction = parseResult.matched_transactions[0];

          // Update payment status
          await pool.execute(
            'UPDATE promptpay_payments SET status = "verified", transaction_id = ?, verified_at = NOW() WHERE id = ?',
            [transaction.transactionid, payment.id]
          );

          // Update last check time
          await pool.execute(
            'UPDATE config SET last_check = NOW() WHERE customer_id = ?',
            [payment.customer_id]
          );

          console.log(`Auto-verified payment ${payment.id} for amount ${payment.amount}`);
        }
      } catch (error) {
        console.error(`Error auto-verifying payment ${payment.id}:`, error);
      }
    }

    // Mark expired payments
    await pool.execute(
      'UPDATE promptpay_payments SET status = "expired" WHERE status = "pending" AND expires_at <= NOW()'
    );

  } catch (error) {
    console.error('Error in auto verification system:', error);
  }
}, 30000); // Run every 30 seconds

app.post('/api/slip', authenticateToken, async (req, res) => {
  try {
    const { img } = req.body;

    if (!img) {
      return res.status(400).json({
        success: false,
        message: 'Image data is required'
      });
    }

    // Debug: Log image data info
    console.log('Image data length:', img.length);
    console.log('Image data starts with:', img.substring(0, 50));

    // Validate and clean image data
    let cleanImg = img;

    // Remove data URL prefix if present
    if (img.startsWith('data:image/')) {
      const base64Index = img.indexOf(',');
      if (base64Index !== -1) {
        cleanImg = img.substring(base64Index + 1);
        console.log('Removed data URL prefix, new length:', cleanImg.length);
      }
    }

    // Validate base64 format
    const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    if (!base64Regex.test(cleanImg)) {
      console.log('Invalid base64 format');
      return res.status(400).json({
        success: false,
        message: 'รูปแบบข้อมูลรูปภาพไม่ถูกต้อง'
      });
    }

    console.log('Sending to API with clean image data length:', cleanImg.length);

    // Try different approaches for API call
    let slipResponse;

    try {
      // First try: Send as base64 string
      slipResponse = await axios.post('https://slip-c.oiioioiiioooioio.download/api/slip', {
        img: cleanImg
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.log('First attempt failed, trying with data URL format...');

      // Second try: Send with data URL format
      slipResponse = await axios.post('https://slip-c.oiioioiiioooioio.download/api/slip', {
        img: img
      }, {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const slipData = slipResponse.data;
    console.log('API Response:', JSON.stringify(slipData, null, 2));

    // Check if API response is successful (different structure)
    if (!slipData.data || slipData.message !== 'Slip processed successfully.') {
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถประมวลผลสลิปได้',
        error: slipData.error || slipData.message || 'Invalid slip data',
        details: slipData
      });
    }

    const { ref, amount, receiver_name, receiver_id, date, timestamp } = slipData.data;

    console.log('Slip data extracted:', {
      ref,
      amount,
      receiver_name,
      receiver_id,
      date,
      timestamp
    });

    // Check if slip is older than 15 minutes
    let slipTime;
    if (timestamp) {
      slipTime = new Date(timestamp);
    } else if (date) {
      slipTime = new Date(date);
    }

    if (slipTime && !isNaN(slipTime.getTime())) {
      const currentTime = new Date();
      const timeDifferenceMinutes = (currentTime - slipTime) / (1000 * 60);
      
      console.log('Time validation:', {
        slipTime: slipTime.toISOString(),
        currentTime: currentTime.toISOString(),
        differenceMinutes: timeDifferenceMinutes
      });

      if (timeDifferenceMinutes > 15) {
        return res.status(400).json({
          success: false,
          message: 'สลิปนี้เกินกำหนดเวลา (เกิน 15 นาที)',
          slip_time: slipTime.toISOString(),
          time_difference_minutes: Math.floor(timeDifferenceMinutes)
        });
      }
    } else {
      console.log('Warning: Could not extract timestamp from slip data');
    }

    // Check if transaction_ref already exists in topups
    const [existingTopup] = await pool.execute(
      'SELECT id FROM topups WHERE transaction_ref = ? AND customer_id = ?',
      [ref, req.customer_id]
    );

    if (existingTopup.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'สลิปนี้ถูกใช้แล้ว',
        transaction_ref: ref
      });
    }

    // Get config to check receiver_name and bank_account_number
    const [configs] = await pool.execute(
      'SELECT bank_account_name, bank_account_number, bank_account_name_thai FROM config WHERE customer_id = ?',
      [req.customer_id]
    );

    if (configs.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูลการตั้งค่าธนาคาร'
      });
    }

    const config = configs[0];

    // Priority 1: Check bank account number first
    const idMatch = config.bank_account_number &&
      (receiver_id.includes(config.bank_account_number) ||
        config.bank_account_number.includes(receiver_id));

    // Priority 2: Check English name if number doesn't match
    const englishNameMatch = !idMatch && config.bank_account_name &&
      (receiver_name.toLowerCase().includes(config.bank_account_name.toLowerCase()) ||
        config.bank_account_name.toLowerCase().includes(receiver_name.toLowerCase()));

    // Priority 3: Check Thai name if number and English name don't match
    const thaiNameMatch = !idMatch && !englishNameMatch && config.bank_account_name_thai &&
      (receiver_name.toLowerCase().includes(config.bank_account_name_thai.toLowerCase()) ||
        config.bank_account_name_thai.toLowerCase().includes(receiver_name.toLowerCase()));

    console.log('Validation checks:', {
      config_number: config.bank_account_number,
      slip_id: receiver_id,
      id_match: idMatch,
      config_english_name: config.bank_account_name,
      slip_name: receiver_name,
      english_name_match: englishNameMatch,
      config_thai_name: config.bank_account_name_thai,
      thai_name_match: thaiNameMatch
    });

    // Check if any validation passes
    if (!idMatch && !englishNameMatch && !thaiNameMatch) {
      console.log('Validation failed - no match found');
      return res.status(400).json({
        success: false,
        message: 'ข้อมูลผู้รับเงินไม่ตรงกับบัญชีธนาคารที่ตั้งค่าไว้',
        expected: {
          number: config.bank_account_number,
          english_name: config.bank_account_name,
          thai_name: config.bank_account_name_thai
        },
        received: {
          name: receiver_name,
          id: receiver_id
        }
      });
    }

    console.log('Validation passed - proceeding with topup');

    // Validate amount
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'จำนวนเงินไม่ถูกต้อง'
      });
    }

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      console.log('Starting topup process:', {
        customer_id: req.customer_id,
        user_id: req.user.id,
        amount: amount,
        ref: ref
      });

      // Insert into topups table
      const [topupResult] = await connection.execute(
        'INSERT INTO topups (customer_id, user_id, amount, method, transaction_ref, status) VALUES (?, ?, ?, ?, ?, ?)',
        [req.customer_id, req.user.id, amount, 'bank_transfer', ref, 'success']
      );

      console.log('Topup record inserted:', topupResult.insertId);

      // Update user balance
      const [updateResult] = await connection.execute(
        'UPDATE users SET money = money + ? WHERE id = ? AND customer_id = ?',
        [amount, req.user.id, req.customer_id]
      );

      console.log('User balance update result:', updateResult.affectedRows);

      if (updateResult.affectedRows === 0) {
        throw new Error('ไม่สามารถอัปเดตเงินผู้ใช้ได้');
      }

      // Get new balance
      const [userResult] = await connection.execute(
        'SELECT money FROM users WHERE id = ? AND customer_id = ?',
        [req.user.id, req.customer_id]
      );

      const newBalance = userResult[0].money;

      await connection.commit();

      console.log(`Slip topup successful: Customer ${req.customer_id}, User ${req.user.id}, Amount: ${amount}, Ref: ${ref}, New Balance: ${newBalance}`);

      res.json({
        success: true,
        message: 'เติมเงินสำเร็จ',
        data: {
          amount: amount,
          new_balance: newBalance,
          topup_id: topupResult.insertId,
          transaction_ref: ref,
          slip_data: slipData.data
        }
      });

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('Slip processing error:', error);

    if (error.response) {
      // API error
      return res.status(500).json({
        success: false,
        message: 'ไม่สามารถประมวลผลสลิปได้',
        error: error.response.data?.message || 'API error'
      });
    }

    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการประมวลผลสลิป',
      error: error.message
    });
  }
});

// ==================== CONTACT CHANNELS SYSTEM ====================

// ดึงรายการช่องทางติดต่อทั้งหมด (Public - สำหรับแสดงในหน้า Contact Us)
app.get('/api/contacts', async (req, res) => {
  try {
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูล customer_id'
      });
    }

    // ดึงเฉพาะที่ is_active = 1 และเรียงตาม priority
    const [contacts] = await pool.execute(
      `SELECT id, contact_name, contact_link, contact_photo, priority
       FROM contacts 
       WHERE customer_id = ? AND is_active = 1
       ORDER BY priority ASC, created_at ASC`,
      [customerId]
    );

    res.json({
      success: true,
      message: 'ดึงข้อมูลช่องทางติดต่อสำเร็จ',
      data: contacts
    });

  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
      error: error.message
    });
  }
});

// ดึงรายการช่องทางติดต่อทั้งหมด (สำหรับ Admin - รวมที่ไม่ active)
app.get('/api/admin/contacts', authenticateToken, requirePermission('can_manage_settings'), async (req, res) => {
  try {
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูล customer_id'
      });
    }

    const [contacts] = await pool.execute(
      `SELECT * FROM contacts 
       WHERE customer_id = ?
       ORDER BY priority ASC, created_at ASC`,
      [customerId]
    );

    res.json({
      success: true,
      message: 'ดึงข้อมูลช่องทางติดต่อสำเร็จ',
      data: contacts
    });

  } catch (error) {
    console.error('Error fetching contacts:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
      error: error.message
    });
  }
});

// สร้างช่องทางติดต่อใหม่ (Admin only)
app.post('/api/admin/contacts', authenticateToken, requirePermission('can_manage_settings'), async (req, res) => {
  try {
    const { contact_name, contact_link, contact_photo, priority, is_active } = req.body;
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูล customer_id'
      });
    }

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!contact_name || !contact_link) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน (ชื่อช่องทาง, ลิงก์/ข้อมูลติดต่อ)'
      });
    }

    // บันทึกลงฐานข้อมูล
    const [result] = await pool.execute(
      `INSERT INTO contacts (customer_id, contact_name, contact_link, contact_photo, priority, is_active) 
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        customerId,
        contact_name,
        contact_link,
        contact_photo || null,
        priority !== undefined ? priority : 0,
        is_active !== undefined ? (is_active ? 1 : 0) : 1
      ]
    );

    // ดึงข้อมูลที่สร้างแล้ว
    const [newContact] = await pool.execute(
      'SELECT * FROM contacts WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'สร้างช่องทางติดต่อสำเร็จ',
      data: newContact[0]
    });

  } catch (error) {
    console.error('Error creating contact:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างช่องทางติดต่อ',
      error: error.message
    });
  }
});

// ดึงช่องทางติดต่อตาม ID
app.get('/api/admin/contacts/:id', authenticateToken, requirePermission('can_manage_settings'), async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูล customer_id'
      });
    }

    const [contacts] = await pool.execute(
      'SELECT * FROM contacts WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );

    if (contacts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบช่องทางติดต่อที่ระบุ'
      });
    }

    res.json({
      success: true,
      message: 'ดึงข้อมูลช่องทางติดต่อสำเร็จ',
      data: contacts[0]
    });

  } catch (error) {
    console.error('Error fetching contact:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
      error: error.message
    });
  }
});

// อัปเดตช่องทางติดต่อ (Admin only)
app.put('/api/admin/contacts/:id', authenticateToken, requirePermission('can_manage_settings'), async (req, res) => {
  try {
    const { id } = req.params;
    const { contact_name, contact_link, contact_photo, priority, is_active } = req.body;
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูล customer_id'
      });
    }

    // ตรวจสอบว่ามีช่องทางติดต่ออยู่หรือไม่
    const [existingContacts] = await pool.execute(
      'SELECT id FROM contacts WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );

    if (existingContacts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบช่องทางติดต่อที่ระบุ'
      });
    }

    // สร้าง dynamic query
    const updateFields = [];
    const updateValues = [];

    if (contact_name !== undefined) {
      updateFields.push('contact_name = ?');
      updateValues.push(contact_name);
    }
    if (contact_link !== undefined) {
      updateFields.push('contact_link = ?');
      updateValues.push(contact_link);
    }
    if (contact_photo !== undefined) {
      updateFields.push('contact_photo = ?');
      updateValues.push(contact_photo);
    }
    if (priority !== undefined) {
      updateFields.push('priority = ?');
      updateValues.push(priority);
    }
    if (is_active !== undefined) {
      updateFields.push('is_active = ?');
      updateValues.push(is_active ? 1 : 0);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ไม่มีข้อมูลที่จะอัปเดต'
      });
    }

    updateValues.push(id, customerId);

    const updateQuery = `UPDATE contacts SET ${updateFields.join(', ')} WHERE id = ? AND customer_id = ?`;
    await pool.execute(updateQuery, updateValues);

    // ดึงข้อมูลที่อัปเดตแล้ว
    const [updatedContacts] = await pool.execute(
      'SELECT * FROM contacts WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );

    res.json({
      success: true,
      message: 'อัปเดตช่องทางติดต่อสำเร็จ',
      data: updatedContacts[0]
    });

  } catch (error) {
    console.error('Error updating contact:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดต',
      error: error.message
    });
  }
});

// ลบช่องทางติดต่อ (Admin only)
app.delete('/api/admin/contacts/:id', authenticateToken, requirePermission('can_manage_settings'), async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูล customer_id'
      });
    }

    // ตรวจสอบว่ามีช่องทางติดต่ออยู่หรือไม่
    const [existingContacts] = await pool.execute(
      'SELECT id FROM contacts WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );

    if (existingContacts.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบช่องทางติดต่อที่ระบุ'
      });
    }

    // ลบช่องทางติดต่อ
    await pool.execute(
      'DELETE FROM contacts WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );

    res.json({
      success: true,
      message: 'ลบช่องทางติดต่อสำเร็จ'
    });

  } catch (error) {
    console.error('Error deleting contact:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบช่องทางติดต่อ',
      error: error.message
    });
  }
});

// ==================== ADBANNER SYSTEM ====================

// ดึงรายการ adbanner ทั้งหมด (Public - สำหรับแสดงในหน้าหลัก)
app.get('/api/adbanner', async (req, res) => {
  try {
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูล customer_id'
      });
    }

    const [adbanners] = await pool.execute(
      `SELECT id, ad_img, description, created_at
       FROM adbanner 
       WHERE customer_id = ?
       ORDER BY created_at DESC`,
      [customerId]
    );

    res.json({
      success: true,
      message: 'ดึงข้อมูล adbanner สำเร็จ',
      data: adbanners
    });

  } catch (error) {
    console.error('Error fetching adbanners:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
      error: error.message
    });
  }
});

// ดึงรายการ adbanner ทั้งหมด (สำหรับ Admin)
app.get('/api/admin/adbanner', authenticateToken, requirePermission('can_manage_settings'), async (req, res) => {
  try {
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูล customer_id'
      });
    }

    const [adbanners] = await pool.execute(
      `SELECT * FROM adbanner 
       WHERE customer_id = ?
       ORDER BY created_at DESC`,
      [customerId]
    );

    res.json({
      success: true,
      message: 'ดึงข้อมูล adbanner สำเร็จ',
      data: adbanners
    });

  } catch (error) {
    console.error('Error fetching adbanners:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
      error: error.message
    });
  }
});

// สร้าง adbanner ใหม่ (Admin only)
app.post('/api/admin/adbanner', authenticateToken, requirePermission('can_manage_settings'), async (req, res) => {
  try {
    const { ad_img, description } = req.body;
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูล customer_id'
      });
    }

    // ตรวจสอบข้อมูลที่จำเป็น
    if (!ad_img) {
      return res.status(400).json({
        success: false,
        message: 'กรุณากรอก URL รูปภาพโฆษณา'
      });
    }

    // บันทึกลงฐานข้อมูล
    const [result] = await pool.execute(
      `INSERT INTO adbanner (customer_id, ad_img, description) 
       VALUES (?, ?, ?)`,
      [
        customerId,
        ad_img,
        description || null
      ]
    );

    // ดึงข้อมูลที่สร้างแล้ว
    const [newAdbanner] = await pool.execute(
      'SELECT * FROM adbanner WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'สร้าง adbanner สำเร็จ',
      data: newAdbanner[0]
    });

  } catch (error) {
    console.error('Error creating adbanner:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้าง adbanner',
      error: error.message
    });
  }
});

// ดึง adbanner ตาม ID
app.get('/api/admin/adbanner/:id', authenticateToken, requirePermission('can_manage_settings'), async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูล customer_id'
      });
    }

    const [adbanners] = await pool.execute(
      'SELECT * FROM adbanner WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );

    if (adbanners.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบ adbanner ที่ระบุ'
      });
    }

    res.json({
      success: true,
      message: 'ดึงข้อมูล adbanner สำเร็จ',
      data: adbanners[0]
    });

  } catch (error) {
    console.error('Error fetching adbanner:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
      error: error.message
    });
  }
});

// อัปเดต adbanner (Admin only)
app.put('/api/admin/adbanner/:id', authenticateToken, requirePermission('can_manage_settings'), async (req, res) => {
  try {
    const { id } = req.params;
    const { ad_img, description } = req.body;
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูล customer_id'
      });
    }

    // ตรวจสอบว่ามี adbanner อยู่หรือไม่
    const [existingAdbanners] = await pool.execute(
      'SELECT id FROM adbanner WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );

    if (existingAdbanners.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบ adbanner ที่ระบุ'
      });
    }

    // สร้าง dynamic query
    const updateFields = [];
    const updateValues = [];

    if (ad_img !== undefined) {
      updateFields.push('ad_img = ?');
      updateValues.push(ad_img);
    }
    if (description !== undefined) {
      updateFields.push('description = ?');
      updateValues.push(description);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ไม่มีข้อมูลที่จะอัปเดต'
      });
    }

    updateValues.push(id, customerId);

    const updateQuery = `UPDATE adbanner SET ${updateFields.join(', ')} WHERE id = ? AND customer_id = ?`;
    await pool.execute(updateQuery, updateValues);

    // ดึงข้อมูลที่อัปเดตแล้ว
    const [updatedAdbanners] = await pool.execute(
      'SELECT * FROM adbanner WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );

    res.json({
      success: true,
      message: 'อัปเดต adbanner สำเร็จ',
      data: updatedAdbanners[0]
    });

  } catch (error) {
    console.error('Error updating adbanner:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดต',
      error: error.message
    });
  }
});

// ลบ adbanner (Admin only)
app.delete('/api/admin/adbanner/:id', authenticateToken, requirePermission('can_manage_settings'), async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = req.customer_id;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        message: 'ไม่พบข้อมูล customer_id'
      });
    }

    // ตรวจสอบว่ามี adbanner อยู่หรือไม่
    const [existingAdbanners] = await pool.execute(
      'SELECT id FROM adbanner WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );

    if (existingAdbanners.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบ adbanner ที่ระบุ'
      });
    }

    // ลบ adbanner
    await pool.execute(
      'DELETE FROM adbanner WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );

    res.json({
      success: true,
      message: 'ลบ adbanner สำเร็จ'
    });

  } catch (error) {
    console.error('Error deleting adbanner:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบ adbanner',
      error: error.message
    });
  }
});

// ==================== TOPUP ENDPOINTS ====================

// Get user's topup history
app.get('/api/topups', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const customerId = req.customer_id;

    const [topups] = await pool.execute(
      `SELECT 
        id,
        amount,
        method,
        transaction_ref,
        status,
        created_at,
        updated_at
      FROM topups
      WHERE user_id = ? AND customer_id = ?
      ORDER BY created_at DESC`,
      [userId, customerId]
    );

    res.json({
      success: true,
      message: 'ดึงประวัติการเติมเงินสำเร็จ',
      data: topups,
      total: topups.length
    });

  } catch (error) {
    console.error('Error fetching topups:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
      error: error.message
    });
  }
});

// Get single topup details
app.get('/api/topups/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const customerId = req.customer_id;

    const [topups] = await pool.execute(
      `SELECT 
        t.*,
        u.fullname,
        u.email
      FROM topups t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.id = ? AND t.user_id = ? AND t.customer_id = ?`,
      [id, userId, customerId]
    );

    if (topups.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบรายการเติมเงินที่ระบุ'
      });
    }

    res.json({
      success: true,
      message: 'ดึงข้อมูลรายการเติมเงินสำเร็จ',
      data: topups[0]
    });

  } catch (error) {
    console.error('Error fetching topup:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
      error: error.message
    });
  }
});

// Create new topup request
app.post('/api/topups', authenticateToken, async (req, res) => {
  try {
    const { amount, method, transaction_ref } = req.body;
    const userId = req.user.id;
    const customerId = req.customer_id;

    // Validate required fields
    if (!amount || !method) {
      return res.status(400).json({
        success: false,
        message: 'กรุณาระบุจำนวนเงินและวิธีการชำระเงิน'
      });
    }

    // Validate amount
    if (parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'จำนวนเงินต้องมากกว่า 0'
      });
    }

    // Validate method
    const validMethods = ['bank_transfer', 'promptpay', 'truewallet', 'credit_card'];
    if (!validMethods.includes(method)) {
      return res.status(400).json({
        success: false,
        message: 'วิธีการชำระเงินไม่ถูกต้อง'
      });
    }

    // Insert topup request
    const [result] = await pool.execute(
      `INSERT INTO topups (customer_id, user_id, amount, method, transaction_ref, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      [customerId, userId, amount, method, transaction_ref || null]
    );

    // Get the created topup
    const [topups] = await pool.execute(
      'SELECT * FROM topups WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'สร้างคำขอเติมเงินสำเร็จ',
      data: topups[0]
    });

  } catch (error) {
    console.error('Error creating topup:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการสร้างคำขอเติมเงิน',
      error: error.message
    });
  }
});

// ==================== ADMIN TOPUP ENDPOINTS ====================

// Get all topups (Admin only)
app.get('/api/admin/topups', authenticateToken, requirePermission('can_view_reports'), async (req, res) => {
  try {
    const customerId = req.customer_id;
    const { status, method, limit = 100, offset = 0 } = req.query;

    let query = `
      SELECT 
        t.*,
        u.fullname,
        u.email
      FROM topups t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.customer_id = ?
    `;
    const queryParams = [customerId];

    // Filter by status
    if (status && ['pending', 'success', 'failed'].includes(status)) {
      query += ' AND t.status = ?';
      queryParams.push(status);
    }

    // Filter by method
    if (method) {
      query += ' AND t.method = ?';
      queryParams.push(method);
    }

    query += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(parseInt(limit), parseInt(offset));

    const [topups] = await pool.execute(query, queryParams);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM topups WHERE customer_id = ?';
    const countParams = [customerId];

    if (status && ['pending', 'success', 'failed'].includes(status)) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    if (method) {
      countQuery += ' AND method = ?';
      countParams.push(method);
    }

    const [countResult] = await pool.execute(countQuery, countParams);

    res.json({
      success: true,
      message: 'ดึงข้อมูลการเติมเงินทั้งหมดสำเร็จ',
      data: topups,
      pagination: {
        total: countResult[0].total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    console.error('Error fetching all topups:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
      error: error.message
    });
  }
});

// Get single topup details (Admin only)
app.get('/api/admin/topups/:id', authenticateToken, requirePermission('can_view_reports'), async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = req.customer_id;

    const [topups] = await pool.execute(
      `SELECT 
        t.*,
        u.fullname,
        u.email,
        u.money as user_balance
      FROM topups t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.id = ? AND t.customer_id = ?`,
      [id, customerId]
    );

    if (topups.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบรายการเติมเงินที่ระบุ'
      });
    }

    res.json({
      success: true,
      message: 'ดึงข้อมูลรายการเติมเงินสำเร็จ',
      data: topups[0]
    });

  } catch (error) {
    console.error('Error fetching topup:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
      error: error.message
    });
  }
});

// Update topup status (Admin only)
app.put('/api/admin/topups/:id', authenticateToken, requirePermission('can_edit_orders'), async (req, res) => {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const { id } = req.params;
    const { status, transaction_ref } = req.body;
    const customerId = req.customer_id;

    // Validate status
    if (!status || !['pending', 'success', 'failed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'สถานะไม่ถูกต้อง'
      });
    }

    // Get current topup details
    const [topups] = await connection.execute(
      'SELECT * FROM topups WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );

    if (topups.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบรายการเติมเงินที่ระบุ'
      });
    }

    const topup = topups[0];
    const oldStatus = topup.status;

    // Update topup status
    const updateFields = ['status = ?'];
    const updateValues = [status];

    if (transaction_ref !== undefined) {
      updateFields.push('transaction_ref = ?');
      updateValues.push(transaction_ref);
    }

    updateValues.push(id, customerId);

    await connection.execute(
      `UPDATE topups SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ? AND customer_id = ?`,
      updateValues
    );

    // If status changed from pending to success, update user's money
    if (oldStatus !== 'success' && status === 'success') {
      await connection.execute(
        'UPDATE users SET money = money + ? WHERE id = ?',
        [topup.amount, topup.user_id]
      );
    }

    // If status changed from success to failed/pending, deduct money
    if (oldStatus === 'success' && status !== 'success') {
      await connection.execute(
        'UPDATE users SET money = money - ? WHERE id = ?',
        [topup.amount, topup.user_id]
      );
    }

    await connection.commit();

    // Get updated topup
    const [updatedTopups] = await connection.execute(
      `SELECT 
        t.*,
        u.fullname,
        u.email,
        u.money as user_balance
      FROM topups t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'อัปเดตสถานะการเติมเงินสำเร็จ',
      data: updatedTopups[0]
    });

  } catch (error) {
    await connection.rollback();
    console.error('Error updating topup:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการอัปเดต',
      error: error.message
    });
  } finally {
    connection.release();
  }
});

// Delete topup (Admin only)
app.delete('/api/admin/topups/:id', authenticateToken, requirePermission('can_edit_orders'), async (req, res) => {
  try {
    const { id } = req.params;
    const customerId = req.customer_id;

    // Check if topup exists
    const [topups] = await pool.execute(
      'SELECT * FROM topups WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );

    if (topups.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'ไม่พบรายการเติมเงินที่ระบุ'
      });
    }

    const topup = topups[0];

    // Prevent deletion of successful topups
    if (topup.status === 'success') {
      return res.status(400).json({
        success: false,
        message: 'ไม่สามารถลบรายการเติมเงินที่สำเร็จแล้ว'
      });
    }

    // Delete topup
    await pool.execute(
      'DELETE FROM topups WHERE id = ? AND customer_id = ?',
      [id, customerId]
    );

    res.json({
      success: true,
      message: 'ลบรายการเติมเงินสำเร็จ'
    });

  } catch (error) {
    console.error('Error deleting topup:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการลบ',
      error: error.message
    });
  }
});

// Get topup statistics (Admin only)
app.get('/api/admin/topups/stats/summary', authenticateToken, requirePermission('can_view_reports'), async (req, res) => {
  try {
    const customerId = req.customer_id;
    const { start_date, end_date } = req.query;

    let dateCondition = '';
    const queryParams = [customerId];

    if (start_date && end_date) {
      dateCondition = 'AND created_at BETWEEN ? AND ?';
      queryParams.push(start_date, end_date);
    }

    // Get overall statistics
    const [stats] = await pool.execute(
      `SELECT 
        COUNT(*) as total_topups,
        SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_count,
        SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END) as total_amount,
        AVG(CASE WHEN status = 'success' THEN amount ELSE NULL END) as avg_amount
      FROM topups
      WHERE customer_id = ? ${dateCondition}`,
      queryParams
    );

    // Get by method
    const [methodStats] = await pool.execute(
      `SELECT 
        method,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'success' THEN amount ELSE 0 END) as total_amount
      FROM topups
      WHERE customer_id = ? ${dateCondition}
      GROUP BY method`,
      queryParams
    );

    res.json({
      success: true,
      message: 'ดึงสถิติการเติมเงินสำเร็จ',
      data: {
        overall: stats[0],
        by_method: methodStats
      }
    });

  } catch (error) {
    console.error('Error fetching topup stats:', error);
    res.status(500).json({
      success: false,
      message: 'เกิดข้อผิดพลาดในการดึงสถิติ',
      error: error.message
    });
  }
});



// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await pool.end();
  process.exit(0);
});
