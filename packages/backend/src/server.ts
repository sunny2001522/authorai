/**
 * Express 伺服器
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

// Import routers
import { chatRouter } from './chat/routes';
import { adminRouter } from './admin/routes';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS 設定
// /chat 路由開放給所有網站（因為 widget 會被嵌入到各種網站）
// /admin 路由只允許特定來源
const adminAllowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3002',
  'http://localhost:5173',
  process.env.ADMIN_URL,
].filter(Boolean) as string[];

app.use('/chat', cors({ origin: true }));  // Chat API 開放所有來源

app.use('/admin', cors({
  origin: (origin: any, callback: any) => {
    if (!origin) return callback(null, true);
    if (adminAllowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
app.use(express.json());

// Routes
app.use('/chat', chatRouter);
app.use('/admin', adminRouter);

// Health check
app.get('/health', (_req: any, res: any) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Backend server running at http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/health`);
  console.log(`💬 Chat API: http://localhost:${PORT}/chat`);
  console.log(`🔧 Admin API: http://localhost:${PORT}/admin`);
});
