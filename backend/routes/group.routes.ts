import express from "express";
import {
    createGroup,
    updateGroupName,
    addParticipant,
    removeParticipant,
    makeAdmin,
    dismissAdmin,
    getGroupDetails,
    updateGroup,
    deleteGroup,
} from "../controllers/group.controller.ts";
import protectRoute from "../middleware/protectRoute.ts";
import validate from "../middleware/validate.ts";
import {
    addParticipantSchema,
    createGroupSchema,
    dismissAdminSchema,
    groupIdSchema,
    groupNameSchema,
    makeAdminSchema,
    removeParticipantSchema,
    updateGroupSchema,
} from "../validation/schemas.ts";

const router = express.Router();

router.post("/create", protectRoute, validate(createGroupSchema), createGroup);
router.put("/:groupId/update", protectRoute, validate(updateGroupSchema), updateGroup);
router.delete("/:groupId/delete", protectRoute, validate(groupIdSchema), deleteGroup);
router.get("/:groupId", protectRoute, validate(groupIdSchema), getGroupDetails);
router.put("/:groupId/name", protectRoute, validate(groupNameSchema), updateGroupName);
router.put("/:groupId/participants/add", protectRoute, validate(addParticipantSchema), addParticipant);
router.put("/:groupId/participants/remove", protectRoute, validate(removeParticipantSchema), removeParticipant);
router.put("/:groupId/admins/add", protectRoute, validate(makeAdminSchema), makeAdmin);
router.put("/:groupId/admins/remove", protectRoute, validate(dismissAdminSchema), dismissAdmin);

export default router;
