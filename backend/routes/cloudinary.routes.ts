import express from 'express';
import { getGroupIconSignature, getMediaCloudinarySignature, getProfilePicSignature } from "../controllers/cloudinary.controller.ts";
import protectRoute from '../middleware/protectRoute.ts';

const router = express.Router();

router.get('/signature', protectRoute, getMediaCloudinarySignature);
router.get('/signature/profile-pic', protectRoute, getProfilePicSignature);
router.get('/signature/group-icon', protectRoute, getGroupIconSignature);

export default router;
