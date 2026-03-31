import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error(`[ERROR] ${err.message}`);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Map known error messages to status codes
  if (err.message.includes('Order not found')) {
    return res.status(404).json({ error: err.message });
  }
  if (err.message.includes('Invalid transition') || err.message.includes('being packed by')) {
    return res.status(409).json({ error: err.message });
  }
  if (err.message.includes('Insufficient stock')) {
    return res.status(422).json({ error: err.message });
  }

  res.status(500).json({ error: 'Internal Server Error' });
}
