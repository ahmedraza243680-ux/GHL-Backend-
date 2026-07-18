import { createBusinessWithLocation } from '../services/businesses.service.js';

export async function createBusiness(req, res, next) {
  try {
    const result = await createBusinessWithLocation(req.body);
    return res.status(201).json({
      success: true,
      data: result,
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}
