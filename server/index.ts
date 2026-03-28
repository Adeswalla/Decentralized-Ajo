import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import logger from './config/logger';
import { requestLogger } from './middleware/requestLogger';
import { startAjoCycleCronJob } from './services/ajo-cycle-cron';

const app = express();

// Security middleware
app.use(helmet());

const allowedOrigins = [
  'http://localhost:3000',
  /\\.vercel\\.app$/,
  /\\.netlify\\.app$/
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g., mobile apps, curl)
    if (!origin) return callback(null, true);
    
    // Check dynamic and static allowed origins
    for (const allowed of allowedOrigins) {
      if (typeof allowed === 'string' && origin === allowed) {
        return callback(null, true);
      }
      if (allowed instanceof RegExp && allowed.test(origin)) {
        return callback(null, true);
      }
    }

    // Fallback to explicit env origins
    if (process.env.ALLOWED_ORIGINS?.split(',').includes(origin)) {
      return callback(null, true);
    }

    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: any) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
  });
  
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  logger.info(`Express server active on port :${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Log level: ${logger.level}`);
  startAjoCycleCronJob();
});

export default app;
