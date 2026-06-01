import {
  getLocationSchedule,
  updateLocationSchedule,
} from '../services/schedule.service.js';

export async function getLocationScheduleHandler(req, res, next) {
  try {
    const schedule = await getLocationSchedule(req.params.locationId);
    return res.json({
      success: true,
      data: { schedule },
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}

export async function putLocationScheduleHandler(req, res, next) {
  try {
    const schedule = await updateLocationSchedule(req.params.locationId, req.body ?? {});
    return res.json({
      success: true,
      data: { schedule },
      requestId: req.requestId,
    });
  } catch (e) {
    next(e);
  }
}
