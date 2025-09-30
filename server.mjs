import express from 'express';
import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

// JWT Secret Key
const JWT_SECRET = '32670cc39ca9333bedb30406cc22c4bc';

// Database configuration
const dbConfig = {
  host: 'gondola.proxy.rlwy.net',
  port: 11555,
  user: 'root',
  password: 'tzspZOlqqEvABEgEeCCbDbAFdkGiQSYQ',
  database: 'railway',
  ssl: {
    rejectUnauthorized: false
  }
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

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
    const { fullname, email, password } = req.body;

    // Validate required fields
    if (!fullname || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Fullname, email, and password are required'
      });
    }

    // Check if user already exists
    const [existingUsers] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
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

    // Insert new user
    const [result] = await pool.execute(
      'INSERT INTO users (fullname, email, password) VALUES (?, ?, ?)',
      [fullname, email, hashedPassword]
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: result.insertId, 
        email: email,
        fullname: fullname
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
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email
    const [users] = await pool.execute(
      'SELECT id, fullname, email, password, money, points, role FROM users WHERE email = ?',
      [email]
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
        fullname: user.fullname
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
    const [users] = await pool.execute(
      'SELECT id, fullname, email, money, points, role, created_at FROM users WHERE id = ?',
      [req.user.id]
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

// Logout endpoint (client-side token removal)
app.post('/logout', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful. Please remove token from client-side storage.'
  });
});

// Verify token endpoint
app.get('/verify-token', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token is valid',
    user: {
      id: req.user.id,
      email: req.user.email,
      fullname: req.user.fullname
    }
  });
});

// Get first theme settings endpoint
app.get('/theme-settings', async (req, res) => {
  try {
    // Get first theme settings only
    const [themes] = await pool.execute(
      'SELECT * FROM theme_settings ORDER BY id LIMIT 1'
    );

    if (themes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No theme settings found'
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

// Get web config endpoint
app.get('/get-web-config', async (req, res) => {
  try {
    // Get first config only
    const [configs] = await pool.execute(
      'SELECT * FROM config ORDER BY id LIMIT 1'
    );

    if (configs.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No web config found'
      });
    }

    const config = configs[0];

    res.json({
      success: true,
      message: 'Web config retrieved successfully',
      config: {
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
        background_image: config.background_image,
        footer_image: config.footer_image,
        load_logo: config.load_logo,
        footer_logo: config.footer_logo,
        theme: config.theme,
        created_at: config.created_at,
        updated_at: config.updated_at
      }
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

// Get categories endpoint (hierarchical structure)
app.get('/categories', async (req, res) => {
  try {
    // Get all categories ordered by priority and title
    const [categories] = await pool.execute(
      'SELECT id, parent_id, title, subtitle, image, category, featured, isActive, priority, created_at FROM categories WHERE isActive = 1 ORDER BY priority DESC, title ASC'
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
    // Get all categories in flat structure ordered by priority and title
    const [categories] = await pool.execute(
      'SELECT id, parent_id, title, subtitle, image, category, featured, isActive, priority, created_at FROM categories WHERE isActive = 1 ORDER BY priority DESC, title ASC'
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
    // Get all categories ordered by priority and title
    const [categories] = await pool.execute(
      'SELECT id, parent_id, title, subtitle, image, category, featured, isActive, priority, created_at FROM categories WHERE isActive = 1 ORDER BY priority DESC, title ASC'
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
    const categoryId = req.params.categoryId;

    // Validate category ID
    if (!categoryId || isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Valid category ID is required'
      });
    }

    // Check if category exists
    const [categoryCheck] = await pool.execute(
      'SELECT id, title FROM categories WHERE id = ? AND isActive = 1',
      [categoryId]
    );

    if (categoryCheck.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Category not found or inactive'
      });
    }

    // Get products for the category
    const [products] = await pool.execute(
      `SELECT 
        id, category_id, title, subtitle, price, reseller_price, stock, 
        duration, image, download_link, isSpecial, featured, isActive, 
        isWarrenty, warrenty_text, primary_color, secondary_color, 
        created_at, priority, discount_percent
      FROM products 
      WHERE category_id = ? AND isActive = 1 
      ORDER BY priority DESC, title ASC`,
      [categoryId]
    );

    res.json({
      success: true,
      message: 'Products retrieved successfully',
      category: categoryCheck[0],
      products: products,
      total: products.length
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
    const productId = req.params.productId;

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
        p.id, p.category_id, p.title, p.subtitle, p.price, p.reseller_price, p.stock, 
        p.duration, p.image, p.download_link, p.isSpecial, p.featured, p.isActive, 
        p.isWarrenty, p.warrenty_text, p.primary_color, p.secondary_color, 
        p.created_at, p.priority, p.discount_percent,
        c.title as category_title, c.category as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.id = ? AND p.isActive = 1`,
      [productId]
    );

    if (products.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Product not found or inactive'
      });
    }

    const product = products[0];

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
      'SELECT id, title, price, stock FROM products WHERE id = ? AND isActive = 1',
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
    const totalPrice = product.price * quantity;

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
      'INSERT INTO transactions (bill_number, user_id, total_price) VALUES (?, ?, ?)',
      [billNumber, userId, totalPrice]
    );

    const transactionId = transactionResult.insertId;

    // Create transaction items and update product_stock
    const transactionItems = [];
    for (let i = 0; i < quantity; i++) {
      const stockItem = availableStock[i];
      
      // Create transaction item
      const [itemResult] = await connection.execute(
        'INSERT INTO transaction_items (bill_number, transaction_id, product_id, quantity, price, license_id) VALUES (?, ?, ?, 1, ?, ?)',
        [billNumber, transactionId, product_id, product.price, stockItem.id]
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
        price: product.price,
        quantity: quantity
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
    // Get all products with category information
    const [products] = await pool.execute(
      `SELECT 
        p.id, p.category_id, p.title, p.subtitle, p.price, p.reseller_price, p.stock, 
        p.duration, p.image, p.download_link, p.isSpecial, p.featured, p.isActive, 
        p.isWarrenty, p.warrenty_text, p.primary_color, p.secondary_color, 
        p.created_at, p.priority, p.discount_percent,
        c.title as category_title, c.category as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.isActive = 1
      ORDER BY p.priority DESC, p.title ASC`
    );

    res.json({
      success: true,
      message: 'Products retrieved successfully',
      products: products,
      total: products.length
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
        p.title as product_title, p.image as product_image
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

// Get statistics endpoint
app.get('/get-stats', async (req, res) => {
  try {
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

    // Get total users count
    const [userCountResult] = await pool.execute(
      'SELECT COUNT(*) as total_users FROM users'
    );
    const totalUsers = userCountResult[0].total_users;

    // Get total sold items count (from transaction_items)
    const [soldItemsResult] = await pool.execute(
      'SELECT COUNT(*) as total_sold FROM transaction_items'
    );
    const totalSoldItems = soldItemsResult[0].total_sold;

    // Get unsold product stock count
    const [unsoldStockResult] = await pool.execute(
      'SELECT COUNT(*) as total_unsold FROM product_stock WHERE sold = 0'
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






// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Test database connection at: http://localhost:${PORT}/test-db`);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  await pool.end();
  process.exit(0);
});
