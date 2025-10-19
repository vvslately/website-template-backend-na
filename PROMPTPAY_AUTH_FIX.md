# PromptPay API Authentication Fix - Complete Solution

## ✅ Problem Identified and Fixed

The issue was that the PromptPay API endpoints were not using proper authentication middleware. The frontend was trying to get user ID from localStorage, but the backend endpoints weren't properly secured.

## 🔧 Changes Made

### 1. **Updated PromptPay Endpoints with Authentication**

All PromptPay endpoints now use `authenticateToken` middleware:

```javascript
// Before (insecure)
app.post('/api/promptpay/create', async (req, res) => {
  const { amount, user_id } = req.body; // ❌ user_id from request body
  // ...
});

// After (secure)
app.post('/api/promptpay/create', authenticateToken, async (req, res) => {
  const { amount } = req.body; // ✅ Only amount needed
  // Uses req.user.id from JWT token
  // ...
});
```

### 2. **Security Improvements**

- **Authentication Required**: All endpoints now require valid JWT token
- **User Isolation**: Payments are tied to authenticated user (`req.user.id`)
- **Customer Validation**: Ensures user belongs to correct customer/tenant
- **Payment Ownership**: Users can only access their own payments

### 3. **Updated Endpoints**

#### Create Payment
```bash
POST /api/promptpay/create
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "amount": 100
}
```

#### Verify Payment
```bash
POST /api/promptpay/verify
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "payment_id": 123,
  "amount": 100
}
```

#### Get Payment Status
```bash
GET /api/promptpay/status/123
Authorization: Bearer <jwt_token>
```

## 🎯 Frontend Integration Guide

### 1. **Update API Functions**

The frontend should use the JWT token from login:

```javascript
// utils/api.js
const API_BASE = 'http://localhost:3001';

// Get token from localStorage (set after login)
const getAuthToken = () => {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
};

// Create PromptPay payment
export const createPromptPayPayment = async (amount) => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('กรุณาเข้าสู่ระบบก่อน');
  }

  const response = await fetch(`${API_BASE}/api/promptpay/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Origin': window.location.origin
    },
    body: JSON.stringify({ amount })
  });

  return await response.json();
};

// Verify PromptPay payment
export const verifyPromptPayPayment = async (paymentId, amount) => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('กรุณาเข้าสู่ระบบก่อน');
  }

  const response = await fetch(`${API_BASE}/api/promptpay/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Origin': window.location.origin
    },
    body: JSON.stringify({ payment_id: paymentId, amount })
  });

  return await response.json();
};

// Get PromptPay status
export const getPromptPayStatus = async (paymentId) => {
  const token = getAuthToken();
  if (!token) {
    throw new Error('กรุณาเข้าสู่ระบบก่อน');
  }

  const response = await fetch(`${API_BASE}/api/promptpay/status/${paymentId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Origin': window.location.origin
    }
  });

  return await response.json();
};
```

### 2. **Update Frontend Component**

Remove the user ID logic from the frontend:

```javascript
// Before (problematic)
const handleCreatePromptPay = async () => {
  const userStr = localStorage.getItem('user') || sessionStorage.getItem('user');
  const user = userStr ? JSON.parse(userStr) : null;
  
  if (!user || !user.id) {
    throw new Error('กรุณาเข้าสู่ระบบก่อน');
  }

  const result = await createPromptPayPayment(parseFloat(promptPayAmount), user.id);
  // ...
};

// After (correct)
const handleCreatePromptPay = async () => {
  const result = await createPromptPayPayment(parseFloat(promptPayAmount));
  // ...
};
```

## 🧪 Testing the Fix

### 1. **Test Authentication**
```bash
# This should return "Access token required"
curl -X POST http://localhost:3001/api/promptpay/create \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}'
```

### 2. **Test with Valid Token**
```bash
# First login to get token
curl -X POST http://localhost:3001/login \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"email": "user@example.com", "password": "password"}'

# Then use token for PromptPay
curl -X POST http://localhost:3001/api/promptpay/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Origin: http://localhost:3000" \
  -d '{"amount": 100}'
```

## 🔒 Security Benefits

1. **Token-Based Authentication**: Uses JWT tokens instead of user ID in request body
2. **User Isolation**: Each user can only access their own payments
3. **Customer Validation**: Ensures users belong to correct tenant
4. **Automatic User Context**: No need to pass user ID manually
5. **Consistent Security**: Same authentication pattern as other protected endpoints

## 📋 Next Steps

1. **Update Frontend**: Modify the React component to use proper authentication
2. **Test Integration**: Verify the complete flow works end-to-end
3. **Error Handling**: Add proper error handling for authentication failures
4. **Token Refresh**: Implement token refresh logic if needed

The PromptPay system is now properly secured and follows the same authentication pattern as the rest of the application!
