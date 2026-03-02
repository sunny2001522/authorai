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

// CORS 設定 - 開放所有來源（簡化部署）
app.use(cors({ origin: true, credentials: true }));
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
