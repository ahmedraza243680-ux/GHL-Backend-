import {
  createBusinessWithLocation,
  deleteBusinessById,
} from '../services/businesses.service.js';

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

export async function deleteBusiness(req, res, next) {
  try {
    const deleted = await deleteBusinessById(req.params.businessId);
    return res.json({
      success: true,
      data: deleted,
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}
