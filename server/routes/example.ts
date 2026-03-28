import { Router, Request, Response } from 'express';
import logger from '../config/logger';

const router = Router();

// Example GET endpoint
router.get('/', (req: Request, res: Response) => {
  logger.debug('Example GET endpoint accessed');
  res.json({ message: 'Example route working' });
});

// Example POST endpoint
router.post('/', (req: Request, res: Response) => {
  const { data } = req.body;
  
  logger.info('Data received on example endpoint', { 
    dataLength: data?.length,
    hasData: !!data 
  });
  
  res.json({ 
    message: 'Data received',
    received: data,
  });
});

export default router;
